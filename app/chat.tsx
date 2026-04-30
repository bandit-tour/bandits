import { useNavigation } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BANDIT_QUESTION_GUEST_ECHO_REF,
  bodyAfterAskMeAboutLine,
  parseAboutBanditFromAskMessage,
} from '@/lib/askMeMessageFormat';
import { firstBubbleBodyForType, isSignalBottleInboxType } from '@/lib/bottleThreadText';
import { trackEvent } from '@/lib/analytics';
import { resolveCanonicalSignalThreadByDelivery } from '@/lib/canonicalSignalThread';
import { type PilotThreadIdentity, fetchPilotThreadIdentity } from '@/lib/pilotThreadIdentity';
import { fetchSignalLineForDelivery } from '@/lib/signalDelivery';
import { addDismissedNotificationId } from '@/lib/dismissedThreads';
import { BANDITS_NOTIFICATIONS_REFRESH, requestNotificationsRefresh } from '@/lib/notificationEvents';
import { syncLatestArrivalNotificationMessageFromDelivery } from '@/lib/syncArrivalNotification';
import { supabase } from '@/lib/supabase';
import { deleteNotificationThread } from '@/lib/threadDelete';
import { useAppState } from '@/contexts/AppStateContext';
import { usePremiumRefreshControl } from '@/lib/mobilePullToRefresh';
import { getOperatorUserId } from '@/services/localFriend';

type ChatRole = 'user' | 'bandit' | 'traveler';

type ChatMessage = {
  id: string;
  role: ChatRole;
  body: string;
  sentAt: string;
  /** Inbound Ask on pilot desk: label for the traveler’s question bubble. */
  senderLabel?: string;
};

function pickTravelerLabel(
  candidate: string,
  personaName: string,
  fallbackName: string,
): string {
  const c = String(candidate || '').trim();
  const p = String(personaName || '').trim();
  if (c && (!p || c.toLowerCase() !== p.toLowerCase())) return c;
  return String(fallbackName || '').trim() || 'Traveler';
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const router = useRouter();
  const { refreshNotifications } = useAppState();
  const {
    banditName: rawName,
    notificationId: rawNotificationId,
    notificationType: rawNotificationType,
    referenceId: rawReferenceId,
    referenceType: rawReferenceType,
    notificationTitle: rawNotificationTitle,
    notificationMessage: rawNotificationMessage,
    demoMode: rawDemoMode,
  } = useLocalSearchParams<{
    banditName?: string;
    notificationId?: string;
    notificationType?: string;
    referenceId?: string;
    referenceType?: string;
    notificationTitle?: string;
    notificationMessage?: string;
    demoMode?: string;
  }>();
  const banditName = useMemo(() => {
    const v = Array.isArray(rawName) ? rawName[0] : rawName;
    return (v && v.trim()) || 'Local banDit';
  }, [rawName]);
  const notificationId = Array.isArray(rawNotificationId) ? rawNotificationId[0] : rawNotificationId;
  const notificationType = Array.isArray(rawNotificationType) ? rawNotificationType[0] : rawNotificationType;
  const referenceId = Array.isArray(rawReferenceId) ? rawReferenceId[0] : rawReferenceId;
  const referenceTypeParam = Array.isArray(rawReferenceType) ? rawReferenceType[0] : rawReferenceType;
  const notificationTitle = Array.isArray(rawNotificationTitle) ? rawNotificationTitle[0] : rawNotificationTitle;
  const notificationMessage = Array.isArray(rawNotificationMessage)
    ? rawNotificationMessage[0]
    : rawNotificationMessage;

  const incomingNotifId = String(notificationId || '').trim();
  const demoModeOn = (Array.isArray(rawDemoMode) ? rawDemoMode[0] : rawDemoMode) === '1';
  const canUseChat = incomingNotifId.length > 0 || demoModeOn;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loadingThread, setLoadingThread] = useState(() => !incomingNotifId);
  const [operatorMode, setOperatorMode] = useState(false);
  const [requesterUserId, setRequesterUserId] = useState<string | null>(null);
  const [banditOptions, setBanditOptions] = useState<string[]>(['Neo', 'Elia']);
  const [replyAsBandit, setReplyAsBandit] = useState<string>('Neo');
  const [threadIdentity, setThreadIdentity] = useState<PilotThreadIdentity | null>(null);
  /** When DB row is missing, lock UI from incoming notification title (local_friend / ask). */
  const [deskPersonaLock, setDeskPersonaLock] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const firstScrollDoneRef = useRef(false);

  const displayPersona = useMemo(() => {
    const fromIdentity = threadIdentity?.sender_persona_display_name?.trim();
    if (fromIdentity) return fromIdentity;
    if (deskPersonaLock.trim()) return deskPersonaLock.trim();
    const nType = String(notificationType || '').trim();
    const route = banditName.trim();
    if (route && route !== 'Local banDit' && route !== 'Ask' && !/^ask$/i.test(route)) return route;
    const msg = typeof notificationMessage === 'string' ? notificationMessage.trim() : '';
    const routeTitle = typeof notificationTitle === 'string' ? notificationTitle.trim() : '';
    if (nType === 'bandit_question') {
      /** Guest echo: title is host name, message is plain question — avoid “Pilot” before identity hydrates. */
      if (routeTitle && msg && !msg.includes('About:')) return routeTitle;
      if (msg) {
        const about = parseAboutBanditFromAskMessage(msg);
        if (about) return about;
      }
    }
    if (nType === 'local_friend') {
      return 'Pilot';
    }
    const t = typeof notificationTitle === 'string' ? notificationTitle.trim() : '';
    if (t) return t;
    return 'Local banDit';
  }, [
    threadIdentity?.sender_persona_display_name,
    deskPersonaLock,
    banditName,
    notificationType,
    notificationMessage,
    notificationTitle,
  ]);

  const isGuestAskLocalBanDitChat = useMemo(() => {
    if (operatorMode) return false;
    return String(notificationType || '').trim() === 'bandit_question';
  }, [operatorMode, notificationType]);

  const personaBarLock =
    threadIdentity?.sender_persona_display_name?.trim() || deskPersonaLock.trim() || '';

  useLayoutEffect(() => {
    firstScrollDoneRef.current = false;
  }, [notificationId]);

  /** Fast paint: bottle/signal = message only. Other types: legacy combined preview until `loadThread` runs. */
  useLayoutEffect(() => {
    const nid = String(notificationId || '').trim();
    if (!nid) return;
    const nType = String(notificationType || '').trim();
    const title = typeof notificationTitle === 'string' ? notificationTitle.trim() : '';
    const msg = typeof notificationMessage === 'string' ? notificationMessage.trim() : '';
    const routeRefType = String(referenceTypeParam || '').trim();

    /** Guest Ask: first bubble is always the traveler (never Neo). Plain body or echo ref ⇒ fast-paint as user; `About:` without echo ref ⇒ Pilot Desk (wait for loadThread). */
    if (nType === 'bandit_question') {
      const combined = (msg || [title, msg].filter(Boolean).join('\n\n').trim()).trim();
      const askBody = bodyAfterAskMeAboutLine(combined) || combined;
      const guestAskPaint =
        routeRefType === BANDIT_QUESTION_GUEST_ECHO_REF ||
        (combined.length > 0 && !combined.includes('About:'));
      if (guestAskPaint && askBody) {
        setMessages([
          {
            id: 'notification-initial',
            role: 'user',
            body: askBody,
            sentAt: new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
          },
        ]);
      } else {
        setMessages([]);
        setLoadingThread(true);
      }
      if (!incomingNotifId) setLoadingThread(false);
      return;
    }

    const body = isSignalBottleInboxType(nType)
      ? firstBubbleBodyForType(nType, msg, title)
      : nType === 'local_friend'
        ? (msg || [title, msg].filter(Boolean).join('\n\n').trim())
        : [title, msg].filter(Boolean).join('\n\n').trim();
    if (body) {
      setMessages([
        {
          id: 'notification-initial',
          role: 'bandit',
          body,
          sentAt: new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
        },
      ]);
    } else {
      setMessages([]);
      setLoadingThread(true);
    }
    if (!incomingNotifId) setLoadingThread(false);
  }, [
    notificationId,
    notificationType,
    notificationTitle,
    notificationMessage,
    incomingNotifId,
    referenceTypeParam,
  ]);

  useEffect(() => {
    void trackEvent({
      eventName: 'chat_opened',
      referenceType: 'chat',
      referenceId: notificationId || banditName,
      onceKey: `chat_opened:${notificationId || banditName}`,
    });
  }, [notificationId, banditName]);

  const loadThread = useCallback(
    async (silent?: boolean) => {
      try {
        if (!silent) setLoadingThread(true);
        setDeskPersonaLock('');
        const operatorUserId = getOperatorUserId();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const user = session?.user;
        const userMeta = (user?.user_metadata && typeof user.user_metadata === 'object' ? user.user_metadata : {}) || {};
        const metaDisplayName =
          (typeof userMeta.full_name === 'string' && userMeta.full_name.trim()) ||
          (typeof userMeta.name === 'string' && userMeta.name.trim()) ||
          '';
        const { data: selfProfile } = user?.id
          ? await supabase.from('user_profile').select('name').eq('id', user.id).maybeSingle()
          : { data: null };
        const selfDisplayName =
          String((selfProfile as { name?: string } | null)?.name || '').trim() || String(metaDisplayName || '').trim();
        const isOperator = !!operatorUserId && user?.id === operatorUserId;

        const nid = String(notificationId || '').trim();
        const nType = String(notificationType || '').trim();
        const refId = String(referenceId || '').trim();

        const anchorSelect = 'type, title, message, reference_id, reference_type, ask_target_bandit_id' as const;
        type NotifAnchor = {
          type?: string;
          title?: string;
          message?: string;
          reference_id?: string | null;
          reference_type?: string | null;
          ask_target_bandit_id?: string | null;
        };
        let anchor: NotifAnchor | null = null;
        if (user?.id && nid) {
          const { data: a0 } = await supabase
            .from('notifications')
            .select(anchorSelect)
            .eq('id', nid)
            .eq('user_id', user.id)
            .maybeSingle();
          anchor = a0 as NotifAnchor;
          if (anchor && isSignalBottleInboxType(String(anchor.type))) {
            await syncLatestArrivalNotificationMessageFromDelivery().catch(() => undefined);
            const { data: a1 } = await supabase
              .from('notifications')
              .select(anchorSelect)
              .eq('id', nid)
              .eq('user_id', user.id)
              .maybeSingle();
            if (a1) anchor = a1 as NotifAnchor;
          }
        }

        const effectiveType = nType || String(anchor?.type || '').trim();
        const refFromAnchor = String(refId || anchor?.reference_id || '').trim();
        const anchorRefType = String(anchor?.reference_type || '').trim();
        /**
         * Same account can act as traveler and operator; guest Ask echo threads must stay on traveler-side UI.
         */
        const routeRefType = String(referenceTypeParam || '').trim();
        const isAskGuestEchoThread =
          effectiveType === 'bandit_question' &&
          (anchorRefType === BANDIT_QUESTION_GUEST_ECHO_REF || routeRefType === BANDIT_QUESTION_GUEST_ECHO_REF);
        /** Operator opening a traveler-side thread (`bandit_reply` or Ask guest echo) — not Pilot Desk compose. */
        const viewAsGuest = !!user && (notificationType === 'bandit_reply' || isAskGuestEchoThread);
        const isOperatorRequestThread =
          ['bandit_question_request', 'local_friend_request'].includes(anchorRefType) ||
          ['bandit_question_request', 'local_friend_request'].includes(routeRefType);
        /**
         * Dual-role account safety: operator compose mode is only for explicit operator request threads.
         * Traveler-side chat must never flip into operator mode just because user.id matches operator_user_id.
         */
        const operatorNav = isOperator && !viewAsGuest && isOperatorRequestThread;
        setOperatorMode(operatorNav);
        /** `pilot_thread_identity` is keyed by the *operator thread root* id (see guest echo rows). */
        let identityKey = effectiveType === 'bandit_reply' && refFromAnchor ? refFromAnchor : nid;
        if (anchorRefType === BANDIT_QUESTION_GUEST_ECHO_REF && refFromAnchor) {
          identityKey = refFromAnchor;
        }
        const identity = identityKey ? await fetchPilotThreadIdentity(identityKey).catch(() => null) : null;
        setThreadIdentity(identity);

        const replyTypes = ['operator_reply', 'operator_reply_local_friend', 'operator_reply_bandit_question'];

        let anchorType = effectiveType;
        let anchorTitle = String(anchor?.title || '').trim();
        if (operatorNav && nid && !anchor) {
          const { data: anchorRow } = await supabase.from('notifications').select(anchorSelect).eq('id', nid).maybeSingle();
          if (anchorRow) anchor = anchorRow as NotifAnchor;
          const ar = anchor;
          if (!anchorType && ar?.type) anchorType = String(ar.type);
          anchorTitle = String(ar?.title || '').trim();
        } else if (operatorNav && !anchorTitle) {
          const { data: anchorRow } = await supabase.from('notifications').select(anchorSelect).eq('id', nid).maybeSingle();
          if (anchorRow) {
            const next = anchorRow as NotifAnchor;
            anchor = anchor ? { ...anchor, ...next } : next;
          }
          const ar = anchor;
          if (!anchorType && ar?.type) anchorType = String(ar.type);
          anchorTitle = String(ar?.title || '').trim();
        }

        let lockedPersona = identity?.sender_persona_display_name?.trim() || '';
        if (!lockedPersona) {
          if (anchorType === 'bandit_question' && String(anchor?.ask_target_bandit_id || '').trim()) {
            const bid = String(anchor?.ask_target_bandit_id).trim();
            if (bid) {
              const { data: bRow } = await supabase.from('bandit').select('name').eq('id', bid).maybeSingle();
              lockedPersona = String((bRow as { name?: string } | null)?.name || '').trim();
            }
          } else if (anchorType === 'local_friend') {
            const rid = String(anchor?.reference_id || refFromAnchor || refId).trim();
            if (rid) {
              const { data: ub } = await supabase.from('user_bandit').select('bandit_id').eq('user_id', rid).limit(1).maybeSingle();
              const bId = String((ub as { bandit_id?: string } | null)?.bandit_id || '').trim();
              if (bId) {
                const { data: bRow } = await supabase.from('bandit').select('name').eq('id', bId).maybeSingle();
                lockedPersona = String((bRow as { name?: string } | null)?.name || '').trim();
              }
            }
          }
        }
        if (!lockedPersona && anchorType === 'bandit_question' && String(anchor?.message || '').trim()) {
          lockedPersona = parseAboutBanditFromAskMessage(String(anchor?.message)) || '';
        }
        if (
          !lockedPersona &&
          anchorType === 'bandit_question' &&
          !String(anchor?.message || '').includes('About:') &&
          String(anchorTitle || '').trim()
        ) {
          /** Legacy: title was the bandit (persona) name, message had no `About` line. */
          lockedPersona = String(anchorTitle).trim();
        }

        if (isSignalBottleInboxType(effectiveType) && !lockedPersona) {
          const senderFromRow = String(anchor?.title || '').trim();
          if (senderFromRow) {
            setDeskPersonaLock(senderFromRow);
            setBanditOptions([senderFromRow]);
            setReplyAsBandit(senderFromRow);
          } else {
            setDeskPersonaLock('');
            void supabase
              .from('bandit')
              .select('name')
              .limit(12)
              .then(
                ({ data: bandits }) => {
                  const names = (bandits || [])
                    .map((b: { name?: string }) => String(b.name || '').trim())
                    .filter(Boolean);
                  if (names.length > 0) {
                    setBanditOptions(names);
                    setReplyAsBandit((prev) => (names.includes(prev) ? prev : names[0]));
                  }
                },
                () => undefined,
              );
          }
        } else if (lockedPersona) {
          setDeskPersonaLock(lockedPersona);
          setBanditOptions([lockedPersona]);
          setReplyAsBandit(lockedPersona);
        } else {
          setDeskPersonaLock('');
          void supabase
            .from('bandit')
            .select('name')
            .limit(12)
            .then(
              ({ data: bandits }) => {
                const names = (bandits || [])
                  .map((b: { name?: string }) => String(b.name || '').trim())
                  .filter(Boolean);
                if (names.length > 0) {
                  setBanditOptions(names);
                  setReplyAsBandit((prev) => (names.includes(prev) ? prev : names[0]));
                }
              },
              () => undefined,
            );
        }

        if ((!operatorNav || viewAsGuest) && user && nid) {
          const pTitle = typeof notificationTitle === 'string' ? notificationTitle.trim() : '';
          const pMsg = typeof notificationMessage === 'string' ? notificationMessage.trim() : '';
          const aTitle = String(anchor?.title || '').trim();
          const aMsg = String(anchor?.message || '').trim();

          const operatorRootFromEcho =
            anchorRefType === BANDIT_QUESTION_GUEST_ECHO_REF && refFromAnchor ? refFromAnchor : '';
          const rootThreadId =
            operatorRootFromEcho ||
            (viewAsGuest && String(refId || refFromAnchor || '').trim()
              ? String(refId || refFromAnchor).trim()
              : String(nid));
          let openBody = '';
          let guestRootType = '';

          if (viewAsGuest) {
            const fallbackOpen = [pTitle, pMsg].filter(Boolean).join('\n\n').trim();
            openBody = (identity?.opening_message || '').trim() || fallbackOpen;
            if (rootThreadId) {
              const { data: rootRow } = await supabase
                .from('notifications')
                .select('type, message, reference_id')
                .eq('id', rootThreadId)
                .maybeSingle();
              const r = rootRow as { type?: string; message?: string; reference_id?: string } | null;
              guestRootType = String(r?.type || '').trim();
              let rm = String(r?.message || '').trim();
              if (!rm && String(r?.type || '') === 'bandit_reply') {
                const chain = String(r?.reference_id || '').trim();
                if (chain) {
                  const { data: up } = await supabase
                    .from('notifications')
                    .select('message, type')
                    .eq('id', chain)
                    .maybeSingle();
                  const upRow = up as { message?: string; type?: string } | null;
                  rm = String(upRow?.message || '').trim();
                  if (!guestRootType) guestRootType = String(upRow?.type || '').trim();
                }
              }
              if (rm) openBody = rm;
            }
            if (guestRootType === 'bandit_question') {
              openBody = bodyAfterAskMeAboutLine(openBody) || openBody;
            }
          } else if (isSignalBottleInboxType(effectiveType)) {
            const deliveryId = String(refFromAnchor || '').trim();
            const canonical =
              deliveryId.length >= 32
                ? await resolveCanonicalSignalThreadByDelivery(deliveryId, user.id).catch(() => null)
                : null;
            const lineFromDelivery = deliveryId ? await fetchSignalLineForDelivery(deliveryId).catch(() => null) : null;
            openBody =
              (identity?.opening_message || '').trim() ||
              (canonical?.signal_text || '').trim() ||
              firstBubbleBodyForType('signal_peer_delivery', aMsg || pMsg, aTitle || pTitle) ||
              (aMsg || pMsg).trim() ||
              (lineFromDelivery || '').trim() ||
              '';
          } else if (effectiveType === 'bandit_question') {
            const rawOpen =
              anchorRefType === BANDIT_QUESTION_GUEST_ECHO_REF
                ? (aMsg || pMsg).trim()
                : (identity?.opening_message || '').trim() || `${aMsg || pMsg}`.trim();
            openBody =
              bodyAfterAskMeAboutLine(rawOpen) || bodyAfterAskMeAboutLine(aMsg || pMsg) || rawOpen;
          } else {
            const fallbackOpen = [aTitle || pTitle, aMsg || pMsg].filter(Boolean).join('\n\n').trim();
            openBody =
              (identity?.opening_message || '').trim() || aMsg || pMsg || fallbackOpen;
          }

          const { data: replies } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .eq('type', 'bandit_reply')
            .eq('reference_id', rootThreadId)
            .in('reference_type', replyTypes)
            .order('created_at', { ascending: true });

          const thread: ChatMessage[] = [];
          const guestAskFirstBubble =
            (effectiveType === 'bandit_question' && !viewAsGuest && !isSignalBottleInboxType(effectiveType)) ||
            (viewAsGuest &&
              (guestRootType === 'bandit_question' ||
                /** Opening from a `bandit_reply` route still belongs to a guest-originated Ask thread. */
                effectiveType === 'bandit_reply'));
          if (openBody.trim() || (replies || []).length > 0) {
            if (openBody.trim()) {
              const rawOpeningSender = String((aTitle || pTitle || '').trim());
              const openingSender = guestAskFirstBubble
                ? pickTravelerLabel(rawOpeningSender, displayPersona, selfDisplayName)
                : displayPersona;
              thread.push({
                id: `open-${nid}`,
                role: guestAskFirstBubble ? 'user' : 'bandit',
                senderLabel: openingSender,
                body: openBody.trim(),
                sentAt: new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
              });
            }
            (replies || []).forEach((row: { id: string; created_at?: string; message?: string }) => {
              const created = String(row.created_at || '');
              const sentAt = created
                ? new Date(created).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
                : 'Sent';
              thread.push({
                id: `r-${row.id}`,
                role: 'bandit',
                body: String(row.message || ''),
                sentAt,
              });
            });
            /**
             * Safety: guest Ask threads always start with traveler-authored question on the right,
             * even when opening from a later `bandit_reply` notification route.
             */
            const isGuestAskThread =
              !operatorNav && (effectiveType === 'bandit_question' || guestRootType === 'bandit_question');
            if (isGuestAskThread && thread.length > 0) {
              const first = thread[0];
              const rawFirstSender = String((aTitle || pTitle || '').trim());
              thread[0] = {
                ...first,
                role: 'user',
                senderLabel:
                  first.senderLabel ||
                  pickTravelerLabel(rawFirstSender, displayPersona, selfDisplayName),
              };
            }
            setMessages(thread);
          } else {
            setMessages([]);
          }
          setRequesterUserId(null);
          return;
        }

        if (!operatorNav || !nid) {
          return;
        }

        const rid =
          identity?.recipient_user_id?.trim() ||
          String(anchor?.reference_id || referenceId || '').trim();
        if (!rid) {
          return;
        }

        setRequesterUserId(rid);
        const [{ data: requestNotif }, { data: replies }] = await Promise.all([
          supabase.from('notifications').select('*').eq('id', nid).maybeSingle(),
          supabase
            .from('notifications')
            .select('*')
            .eq('user_id', rid)
            .eq('reference_id', nid)
            .in('reference_type', replyTypes)
            .order('created_at', { ascending: true }),
        ]);

        const thread: ChatMessage[] = [];
        if (requestNotif) {
          const rawOpen = String((requestNotif as { message?: string }).message || '');
          const opening =
            (identity?.opening_message || '').trim() ||
            bodyAfterAskMeAboutLine(rawOpen) ||
            rawOpen.trim();
          if (opening.trim()) {
            let travelerLabel = String((requestNotif as { title?: string }).title || '').trim();
            if (!travelerLabel && rid) {
              const { data: requesterProfile } = await supabase
                .from('user_profile')
                .select('name')
                .eq('id', rid)
                .maybeSingle();
              travelerLabel = String((requesterProfile as { name?: string } | null)?.name || '').trim();
            }
            thread.push({
              id: `open-${nid}`,
              role: 'traveler',
              senderLabel: travelerLabel || 'Traveler',
              body: opening.trim(),
              sentAt: 'Thread',
            });
          }
        }
        (replies || []).forEach((row: any, idx: number) => {
          thread.push({
            id: `r-${row.id || idx}`,
            role: 'bandit',
            body: String(row.message || ''),
            sentAt: 'Sent',
          });
        });
        setMessages(thread.length > 0 ? thread : []);
      } finally {
        setLoadingThread(false);
      }
    },
    [notificationId, notificationType, referenceId, referenceTypeParam, notificationTitle, notificationMessage],
  );

  useEffect(() => {
    void loadThread(false);
  }, [loadThread]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(BANDITS_NOTIFICATIONS_REFRESH, () => void loadThread(true));
    return () => sub.remove();
  }, [loadThread]);

  const onRefreshThread = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadThread(true);
    } finally {
      setRefreshing(false);
    }
  }, [loadThread]);

  const threadRefreshControl = usePremiumRefreshControl(refreshing, onRefreshThread);

  const send = useCallback(() => {
    const t = draft.trim();
    if (!t) return;
    void (async () => {
      if (operatorMode && requesterUserId && notificationId) {
        /** `operator_reply` matches legacy RLS (migration 025 adds granular types). */
        const replyReferenceType = 'operator_reply';
        const personaTitle = (personaBarLock || replyAsBandit).trim() || 'Neo';
        const { error } = await supabase.from('notifications').insert({
          user_id: requesterUserId,
          type: 'bandit_reply',
          title: personaTitle,
          message: t,
          reference_id: notificationId,
          reference_type: replyReferenceType,
        });
        if (error) return;
        const now = new Date();
        const sentAt = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        const next: ChatMessage = {
          id: `b-${now.getTime()}`,
          role: 'bandit',
          body: t,
          sentAt,
        };
        setMessages((prev) => [...prev, next]);
        setDraft('');
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
        return;
      }
      const now = new Date();
      const sentAt = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      const next: ChatMessage = {
        id: `u-${now.getTime()}`,
        role: 'user',
        body: t,
        sentAt,
      };
      setMessages((prev) => [...prev, next]);
      setDraft('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    })();
  }, [
    draft,
    operatorMode,
    requesterUserId,
    notificationId,
    replyAsBandit,
    notificationType,
    personaBarLock,
  ]);

  const renderItem = useCallback(({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    const leftLabel = item.role === 'traveler' ? item.senderLabel || 'Traveler' : displayPersona;
    const showUserLabel = isUser && !!item.senderLabel;
    return (
      <View style={[styles.row, isUser ? styles.rowUser : styles.rowBandit]}>
        {showUserLabel && <Text style={styles.userSenderLabel}>{item.senderLabel}</Text>}
        {!isUser && <Text style={styles.senderLabel}>{leftLabel}</Text>}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBandit]}>
          <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextBandit]}>
            {item.body}
          </Text>
          <Text style={[styles.time, isUser && styles.timeUser]}>{item.sentAt}</Text>
        </View>
      </View>
    );
  }, [displayPersona, operatorMode]);

  if (!canUseChat) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: 'Chat', headerBackTitle: 'Back' }} />
        <View style={[styles.flex, { justifyContent: 'center', paddingHorizontal: 20, backgroundColor: '#F0F2F5' }]}>
          <Text style={{ fontSize: 15, color: '#333', lineHeight: 22, textAlign: 'center' }}>
            Chat is available only when you have an active conversation. Open a thread from Notifications, or use Ask Me /
            Local Friend to start.
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: displayPersona, headerBackTitle: 'Back' }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {loadingThread ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" />
          </View>
        ) : (
          <FlatList
            testID="chat-thread-list"
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={styles.thread}
            onContentSizeChange={() => {
              const animated = firstScrollDoneRef.current;
              firstScrollDoneRef.current = true;
              listRef.current?.scrollToEnd({ animated });
            }}
            refreshControl={threadRefreshControl}
            ListEmptyComponent={<Text style={styles.emptyState}>No replies yet.</Text>}
            ListHeaderComponent={
              operatorMode ? null : (
                <Text style={styles.threadHint}>
                  {isGuestAskLocalBanDitChat
                    ? `Your question to ${displayPersona} is on the right. Replies from ${displayPersona} appear below on the left.`
                    : `Chat with ${displayPersona}. Notifications are one-off updates; this screen is the two-way thread.`}
                </Text>
              )
            }
          />
        )}
        {operatorMode && (
          <View style={styles.operatorBar}>
            {personaBarLock ? (
              <Text style={styles.sendAsLocked}>
                Reply as <Text style={styles.sendAsLockedName}>{personaBarLock}</Text>
              </Text>
            ) : (
              <>
                <Text style={styles.operatorLabel}>Reply as Neo:</Text>
                <View style={styles.operatorBandits}>
                  {banditOptions.slice(0, 4).map((name) => {
                    const active = replyAsBandit === name;
                    return (
                      <Pressable
                        key={name}
                        onPress={() => setReplyAsBandit(name)}
                        style={[styles.operatorChip, active && styles.operatorChipActive]}
                      >
                        <Text style={[styles.operatorChipText, active && styles.operatorChipTextActive]}>{name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </View>
        )}
        <View style={[styles.composer, { paddingBottom: 10 + insets.bottom }]}>
          <TextInput
            style={styles.input}
            placeholder="Write a message..."
            placeholderTextColor="#888"
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={2000}
            editable
          />
          <Pressable
            testID="chat-send-button"
            accessibilityState={{ disabled: !draft.trim() }}
            style={[styles.sendBtn, !draft.trim() && styles.sendBtnDisabled]}
            onPress={send}
            disabled={!draft.trim()}
          >
            <Text style={styles.sendBtnText}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F0F2F5' },
  thread: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  threadHint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 14,
    lineHeight: 17,
  },
  emptyState: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingVertical: 20,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    marginBottom: 10,
    maxWidth: '100%',
  },
  rowUser: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  rowBandit: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  senderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#555',
    marginBottom: 4,
    marginLeft: 2,
  },
  userSenderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#555',
    marginBottom: 4,
    marginRight: 2,
    textAlign: 'right',
  },
  bubble: {
    maxWidth: '88%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: '#111',
    borderBottomRightRadius: 4,
  },
  bubbleBandit: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E2E2',
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  bubbleTextUser: { color: '#FFFFFF' },
  bubbleTextBandit: { color: '#222' },
  time: {
    marginTop: 6,
    fontSize: 10,
    color: '#888',
    alignSelf: 'flex-end',
  },
  timeUser: { color: '#CCC' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#DDD',
    backgroundColor: '#FFF',
    gap: 8,
  },
  operatorBar: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 2,
    backgroundColor: '#FFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4E4E4',
  },
  operatorLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
    fontWeight: '700',
  },
  sendAsLocked: {
    fontSize: 13,
    color: '#444',
    fontWeight: '600',
  },
  sendAsLockedName: {
    color: '#111',
    fontWeight: '800',
  },
  operatorBandits: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  operatorChip: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  operatorChipActive: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  operatorChipText: {
    fontSize: 12,
    color: '#222',
    fontWeight: '700',
  },
  operatorChipTextActive: {
    color: '#FFF',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDD',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111',
  },
  sendBtn: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 20,
    marginBottom: 2,
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  sendBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
