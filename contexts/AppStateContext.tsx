import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { DeviceEventEmitter } from 'react-native';
import { isBenignAuthStateMessage } from '@/lib/authSafe';
import { BANDIT_QUESTION_GUEST_ECHO_REF } from '@/lib/askMeMessageFormat';
import { BANDITS_NOTIFICATIONS_REFRESH } from '@/lib/notificationEvents';
import { CanonicalSignalThread, resolveCanonicalSignalThreadByDelivery } from '@/lib/canonicalSignalThread';
import { getDismissedNotificationIds } from '@/lib/dismissedThreads';
import { isSyntheticDisplayName, normalizeDisplayName } from '@/lib/displayName';
import { getOperatorUserId } from '@/lib/operatorConfig';
import { supabase } from '@/lib/supabase';
import { isDeletedThreadRef } from '@/lib/threadDelete';

type NotificationLite = {
  id: string;
  user_id: string;
  type: string;
  is_read: boolean;
  reference_id: string | null;
  reference_type: string | null;
  created_at: string;
};

type ActiveIdentity = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
};

type AuthUser = { id: string; email: string | null; user_metadata: any; created_at?: string };

function toAuthUser(user: any): AuthUser {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const fromRoot = typeof user?.email === 'string' ? user.email.trim() : '';
  const fromMeta = typeof meta.email === 'string' ? meta.email.trim() : '';
  return {
    id: String(user?.id || ''),
    email: fromRoot || fromMeta || null,
    user_metadata: user?.user_metadata ?? {},
    created_at: typeof user?.created_at === 'string' ? user.created_at : undefined,
  };
}

type AppStateContextType = {
  /** Active notification rows for the signed-in user (inbox tab badge). */
  unreadCount: number;
  notificationsVersion: number;
  activeIdentity: ActiveIdentity | null;
  signalThreads: Record<string, CanonicalSignalThread>;
  getCurrentUser: () => Promise<AuthUser | null>;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  ensureSignalThread: (deliveryId: string, userId?: string | null) => Promise<CanonicalSignalThread | null>;
  updateActiveAvatar: (url: string | null) => void;
  updateActiveDisplayName: (name: string) => void;
};

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

/**
 * Mirror of the equivalent helper in `app/(tabs)/notifications.tsx`. We keep
 * the function around for symmetry but always return `false`: Ask Me /
 * Local Friend operator-bound rows now count toward the inbox badge and
 * appear in the Notifications tab (just like bandiTEAM reports).
 */
function isOperatorInboundRequestRowForDualRoleUser(
  _n: NotificationLite,
  _currentUserId: string,
  _operatorUserId: string,
): boolean {
  return false;
}

const ASK_ME_GUEST_BANDIT_REPLY_REFS = new Set(['operator_reply', 'operator_reply_bandit_question']);

function isAskMeGuestSideNotification(n: NotificationLite): boolean {
  const rt = String(n.reference_type || '').trim();
  if (rt === BANDIT_QUESTION_GUEST_ECHO_REF) return true;
  const t = String(n.type || '').trim();
  return t === 'bandit_reply' && ASK_ME_GUEST_BANDIT_REPLY_REFS.has(rt);
}

function shouldHideAskGuestMirrorForPilotOperator(
  n: NotificationLite,
  currentUserId: string,
  operatorUserId: string,
): boolean {
  if (!currentUserId || !operatorUserId) return false;
  if (currentUserId.toLowerCase() !== operatorUserId.toLowerCase()) return false;
  return isAskMeGuestSideNotification(n);
}

function dedupeAskMeGuestNotifications(rows: NotificationLite[]): NotificationLite[] {
  const askGuest = rows.filter(isAskMeGuestSideNotification);
  const rest = rows.filter((n) => !isAskMeGuestSideNotification(n));
  const byRoot = new Map<string, NotificationLite[]>();
  for (const n of askGuest) {
    const root = String(n.reference_id || '').trim();
    if (!root) {
      rest.push(n);
      continue;
    }
    const g = byRoot.get(root) ?? [];
    g.push(n);
    byRoot.set(root, g);
  }
  const kept: NotificationLite[] = [];
  for (const group of byRoot.values()) {
    group.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    kept.push(group[0]);
  }
  return [...rest, ...kept];
}

/** Tab badge: exact unread count from same filtered inbox logic. */
async function loadInboxTabBadgeCount(userId: string): Promise<number> {
  const dismissed = await getDismissedNotificationIds();
  const operatorId = String(getOperatorUserId() || '').trim();
  const { data } = await supabase
    .from('notifications')
    .select('id,user_id,type,is_read,reference_id,reference_type,created_at')
    .eq('user_id', userId);
  const rows = (data || []) as NotificationLite[];
  let filteredRows = rows.filter(
    (n) =>
      !dismissed.has(String(n.id || '').trim()) &&
      !isDeletedThreadRef(n.reference_type) &&
      !isOperatorInboundRequestRowForDualRoleUser(n, userId, operatorId),
  );
  filteredRows = filteredRows.filter((n) => !shouldHideAskGuestMirrorForPilotOperator(n, userId, operatorId));
  filteredRows = dedupeAskMeGuestNotifications(filteredRows);
  return filteredRows.filter((n) => !n.is_read).length;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsVersion, setNotificationsVersion] = useState(0);
  const [activeIdentity, setActiveIdentity] = useState<ActiveIdentity | null>(null);
  const [signalThreads, setSignalThreads] = useState<Record<string, CanonicalSignalThread>>({});
  const refreshNotificationsChainRef = useRef<Promise<void>>(Promise.resolve());
  const refreshNotificationsQueuedRef = useRef(false);
  const refreshNotificationsFnRef = useRef<() => Promise<void>>(async () => {});

  const authUserInFlightRef = useRef<Promise<AuthUser | null> | null>(null);
  const lastStableUserRef = useRef<AuthUser | null>(null);
  const lastUnreadCountRef = useRef<number | null>(null);

  const getAuthUserSerialized = useCallback(async (): Promise<AuthUser | null> => {
    if (!authUserInFlightRef.current) {
      authUserInFlightRef.current = (async () => {
        try {
          const {
            data: { session },
            error: sessionError,
          } = await supabase.auth.getSession();
          if (sessionError) {
            const msg = String(sessionError.message || '');
            if (isBenignAuthStateMessage(msg)) {
              lastStableUserRef.current = null;
              return null;
            }
            console.warn('[AppState] getSession:', sessionError.message);
            return lastStableUserRef.current;
          }
          if (session?.user) {
            const mapped = toAuthUser(session.user);
            lastStableUserRef.current = mapped;
            return mapped;
          }
          lastStableUserRef.current = null;
          return null;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (isBenignAuthStateMessage(msg)) {
            lastStableUserRef.current = null;
            return null;
          }
          console.warn('[AppState] getAuthUserSerialized:', msg);
          return lastStableUserRef.current;
        }
      })().finally(() => {
        authUserInFlightRef.current = null;
      });
    }
    return authUserInFlightRef.current;
  }, []);

  const refreshIdentity = async () => {
    const user = await getAuthUserSerialized();
    if (!user) {
      setActiveIdentity(null);
      return;
    }
    const meta = (user.user_metadata || {}) as Record<string, unknown>;
    const metaName = typeof meta.full_name === 'string' ? meta.full_name : typeof meta.name === 'string' ? meta.name : '';
    const metaAvatar = typeof meta.avatar_url === 'string' ? meta.avatar_url.trim() : '';
    let row: { name?: string; avatar_url?: string | null } | null = null;
    try {
      const res = await supabase.from('user_profile').select('name, avatar_url').eq('id', user.id).maybeSingle();
      row = res.data as typeof row;
    } catch (e) {
      console.warn('[AppState] refreshIdentity user_profile:', e instanceof Error ? e.message : e);
    }
    const profileNameRaw = normalizeDisplayName(String(row?.name || ''));
    const metaNameRaw = normalizeDisplayName(String(metaName || ''));
    const profileName = profileNameRaw && !isSyntheticDisplayName(profileNameRaw) ? profileNameRaw : '';
    const metaNameOk = metaNameRaw && !isSyntheticDisplayName(metaNameRaw) ? metaNameRaw : '';
    const profileAvatar = String(row?.avatar_url || '').trim();
    const fallback = 'Guest';
    const displayName = profileName || metaNameOk || fallback;
    setActiveIdentity((prev) => {
      const next = {
        userId: user.id,
        displayName,
        avatarUrl: profileAvatar || metaAvatar || null,
      };
      if (
        prev &&
        prev.userId === next.userId &&
        prev.displayName === next.displayName &&
        prev.avatarUrl === next.avatarUrl
      ) {
        return prev;
      }
      return next;
    });
  };

  const refreshNotifications = useCallback(async () => {
    refreshNotificationsQueuedRef.current = true;
    refreshNotificationsChainRef.current = refreshNotificationsChainRef.current
      .catch(() => undefined)
      .then(async () => {
        if (!refreshNotificationsQueuedRef.current) return;
        refreshNotificationsQueuedRef.current = false;
        const user = await getAuthUserSerialized().catch(() => null);
        if (!user) {
          lastUnreadCountRef.current = null;
          setUnreadCount(0);
          return;
        }
        const count = await loadInboxTabBadgeCount(user.id);
        if (lastUnreadCountRef.current !== count) {
          lastUnreadCountRef.current = count;
          setUnreadCount(count);
          setNotificationsVersion((v) => v + 1);
        }
      });
    return refreshNotificationsChainRef.current;
  }, [getAuthUserSerialized]);

  refreshNotificationsFnRef.current = refreshNotifications;

  const markNotificationRead = useCallback(
    async (id: string) => {
      const nid = String(id || '').trim();
      if (!nid) return;
      setUnreadCount((c) => Math.max(0, c - 1));
      try {
        await supabase.from('notifications').update({ is_read: true }).eq('id', nid);
      } catch {
        await refreshNotifications();
        return;
      }
      await refreshNotifications();
    },
    [refreshNotifications],
  );

  const ensureSignalThread = useCallback(async (deliveryId: string, userId?: string | null) => {
    const did = String(deliveryId || '').trim();
    if (!did) return null;
    const canonical = await resolveCanonicalSignalThreadByDelivery(did, userId).catch(() => null);
    if (!canonical) return null;
    setSignalThreads((prev) => {
      const current = prev[did];
      if (
        current &&
        current.signal_text === canonical.signal_text &&
        current.sender_name === canonical.sender_name &&
        current.sender_avatar === canonical.sender_avatar &&
        current.unread === canonical.unread &&
        current.created_at === canonical.created_at &&
        current.notification_id === canonical.notification_id &&
        current.bandit_profile_id === canonical.bandit_profile_id
      ) {
        return prev;
      }
      return { ...prev, [did]: canonical };
    });
    return canonical;
  }, []);

  const updateActiveAvatar = useCallback((url: string | null) => {
    setActiveIdentity((prev) => (prev ? { ...prev, avatarUrl: url } : prev));
  }, []);

  const updateActiveDisplayName = useCallback((name: string) => {
    const t = String(name || '').trim();
    if (!t) return;
    setActiveIdentity((prev) => (prev ? { ...prev, displayName: t } : prev));
  }, []);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(BANDITS_NOTIFICATIONS_REFRESH, () => {
      void refreshNotificationsFnRef.current();
      setNotificationsVersion((v) => v + 1);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    void refreshIdentity();
    void refreshNotifications();
    // Polling cadence relaxed from 10 s/15 s to 60 s/120 s. The previous values
    // generated a network round-trip and a provider re-render every 10 seconds
    // — which cascaded into every screen consuming `useAppState()` (the
    // entire tabs shell). DeviceEventEmitter / auth-state-change still trigger
    // immediate refreshes for user-driven mutations, so the perceived latency
    // for "your new notification shows up" is unchanged.
    const notifTimer = setInterval(() => void refreshNotifications(), 60000);
    const identityTimer = setInterval(() => void refreshIdentity(), 120000);
    const auth = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        lastStableUserRef.current = null;
        lastUnreadCountRef.current = null;
        setActiveIdentity(null);
        setUnreadCount(0);
        setSignalThreads({});
      }
      void refreshIdentity();
      void refreshNotifications();
    });
    return () => {
      clearInterval(notifTimer);
      clearInterval(identityTimer);
      auth.data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AppStateContextType>(
    () => ({
      unreadCount,
      notificationsVersion,
      activeIdentity,
      signalThreads,
      getCurrentUser: getAuthUserSerialized,
      refreshNotifications,
      markNotificationRead,
      ensureSignalThread,
      updateActiveAvatar,
      updateActiveDisplayName,
    }),
    [
      unreadCount,
      notificationsVersion,
      activeIdentity,
      signalThreads,
      getAuthUserSerialized,
      refreshNotifications,
      markNotificationRead,
      ensureSignalThread,
      updateActiveAvatar,
      updateActiveDisplayName,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
