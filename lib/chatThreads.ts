import { BANDIT_QUESTION_GUEST_ECHO_REF } from '@/lib/askMeMessageFormat';
import { inboxPreviewForType, isSignalBottleInboxType } from '@/lib/bottleThreadText';
import { isLocalFriendBottleInboxType, isLocalFriendOceanFoundRef } from '@/lib/localFriendOcean';
import { OCEAN_THREAD_REPLY_REF } from '@/lib/oceanBottleChat';
import { getDismissedNotificationIds } from '@/lib/dismissedThreads';
import { readGuestFlipSignalCache } from '@/lib/signals';
import { isDeletedThreadRef } from '@/lib/threadDelete';
import { supabase } from '@/lib/supabase';

export type ChatThreadSummary = {
  threadKey: string;
  floatId?: string;
  title: string;
  preview: string;
  lastAt: string;
  unreadCount: number;
  /** Best notification row to open /chat */
  openNotificationId: string;
  openNotificationType: string;
  openReferenceId: string;
  openReferenceType: string;
  openTitle: string;
  openMessage: string;
};

type NotifRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  reference_id: string | null;
  reference_type: string | null;
  is_read: boolean;
  created_at: string;
};

const BANDIT_REPLY_REFS = new Set([
  'operator_reply',
  'operator_reply_local_friend',
  'operator_reply_bandit_question',
  OCEAN_THREAD_REPLY_REF,
]);

const NOTIF_SELECT =
  'id, type, title, message, reference_id, reference_type, is_read, created_at';

function threadKeyForRow(n: NotifRow): string | null {
  const t = String(n.type || '').trim();
  const rt = String(n.reference_type || '').trim();
  const ref = String(n.reference_id || '').trim();

  if (isSignalBottleInboxType(t)) {
    if (ref) return `signal:${ref}`;
    return `signal-notif:${n.id}`;
  }

  if (t === 'bandit_reply' && ref && BANDIT_REPLY_REFS.has(rt)) {
    if (rt === OCEAN_THREAD_REPLY_REF) return `ocean:${ref}`;
    return `reply:${ref}`;
  }

  if (t === 'local_friend' && (rt === 'local_friend_guest_echo' || rt === 'local_friend_request')) {
    if (ref) return `local_friend:${ref}`;
    return `local_friend-notif:${n.id}`;
  }

  if (isLocalFriendBottleInboxType(t)) {
    if (!ref) return `local_friend-notif:${n.id}`;
    if (rt === 'local_friend_ocean_claim') return `ocean:${ref}`;
    if (rt === 'local_friend_ocean_peer' || rt === OCEAN_THREAD_REPLY_REF) return `ocean:${ref}`;
    return `local_friend:${ref}`;
  }

  if (t === 'bandit_question' && rt === BANDIT_QUESTION_GUEST_ECHO_REF) {
    if (ref) return `ask:${ref}`;
    return `ask-notif:${n.id}`;
  }

  if (t === 'bandit_reply' && rt === BANDIT_QUESTION_GUEST_ECHO_REF && ref) {
    return `ask:${ref}`;
  }

  return null;
}

function titleForThread(n: NotifRow): string {
  const t = String(n.title || '').trim();
  if (t && !/^message in a bottle$/i.test(t) && t !== 'You') return t;
  if (isLocalFriendBottleInboxType(n.type) || isSignalBottleInboxType(n.type)) {
    return 'Message in a bottle';
  }
  return t || 'Chat';
}

function previewForThread(n: NotifRow): string {
  const msg = String(n.message || '').trim();
  const title = String(n.title || '').trim();
  return inboxPreviewForType(n.type, msg, title) || msg || title || 'New message';
}

function isEligibleChatRow(n: NotifRow, dismissed: Set<string>): boolean {
  return (
    !dismissed.has(String(n.id)) &&
    !isDeletedThreadRef(n.reference_type) &&
    !isLocalFriendOceanFoundRef(n.reference_type) &&
    threadKeyForRow(n) != null
  );
}

function buildSummariesFromRows(rows: NotifRow[]): ChatThreadSummary[] {
  const byKey = new Map<string, { rows: NotifRow[] }>();
  for (const n of rows) {
    const key = threadKeyForRow(n)!;
    const g = byKey.get(key) ?? { rows: [] };
    g.rows.push(n);
    byKey.set(key, g);
  }

  const summaries: ChatThreadSummary[] = [];
  for (const [threadKey, { rows: group }] of byKey.entries()) {
    group.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const latest = group[0]!;
    const unreadCount = group.filter((r) => !r.is_read).length;
    const floatId = threadKey.startsWith('ocean:') ? threadKey.slice(6) : undefined;

    summaries.push({
      threadKey,
      floatId,
      title: titleForThread(latest),
      preview: previewForThread(latest),
      lastAt: latest.created_at,
      unreadCount,
      openNotificationId: latest.id,
      openNotificationType: latest.type,
      openReferenceId: String(latest.reference_id || ''),
      openReferenceType: String(latest.reference_type || ''),
      openTitle: latest.title || '',
      openMessage: latest.message || '',
    });
  }

  summaries.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
  return summaries;
}

/** Bottle scan: merge inbox row from flip cache when the main query races onboarding. */
async function mergeGuestBottleThreads(
  userId: string,
  summaries: ChatThreadSummary[],
  dismissed: Set<string>,
): Promise<ChatThreadSummary[]> {
  const flip = await readGuestFlipSignalCache().catch(() => null);
  const deliveryId = String(flip?.deliveryId || '').trim();
  const threadNotificationId = String(flip?.threadNotificationId || '').trim();
  if (!deliveryId && !threadNotificationId) return summaries;

  const existingKeys = new Set(summaries.map((s) => s.threadKey));
  if (deliveryId && existingKeys.has(`signal:${deliveryId}`)) return summaries;
  if (threadNotificationId && summaries.some((s) => s.openNotificationId === threadNotificationId)) {
    return summaries;
  }

  let row: NotifRow | null = null;
  if (threadNotificationId) {
    const { data } = await supabase
      .from('notifications')
      .select(NOTIF_SELECT)
      .eq('user_id', userId)
      .eq('id', threadNotificationId)
      .maybeSingle();
    if (data) row = data as NotifRow;
  }
  if (!row && deliveryId) {
    const { data } = await supabase
      .from('notifications')
      .select(NOTIF_SELECT)
      .eq('user_id', userId)
      .eq('type', 'signal_peer_delivery')
      .eq('reference_id', deliveryId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) row = data as NotifRow;
  }

  if (!row || !isEligibleChatRow(row, dismissed)) return summaries;

  const bottleSummary = buildSummariesFromRows([row])[0]!;
  return [bottleSummary, ...summaries].sort(
    (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
  );
}

/**
 * Active conversations for the bottom Chat tab (unified notification threads).
 */
export async function loadChatThreadSummaries(userId: string): Promise<ChatThreadSummary[]> {
  const uid = String(userId || '').trim();
  if (!uid) return [];

  const dismissed = await getDismissedNotificationIds();
  const { data, error } = await supabase
    .from('notifications')
    .select(NOTIF_SELECT)
    .eq('user_id', uid)
    .order('created_at', { ascending: false });

  if (error && __DEV__) {
    // eslint-disable-next-line no-console
    console.warn('[chatThreads] load notifications', error.message);
  }

  const rows = ((data || []) as NotifRow[]).filter((n) => isEligibleChatRow(n, dismissed));
  let summaries = buildSummariesFromRows(rows);
  summaries = await mergeGuestBottleThreads(uid, summaries, dismissed);
  return summaries;
}

export async function loadChatTabUnreadCount(userId: string): Promise<number> {
  const threads = await loadChatThreadSummaries(userId);
  return threads.reduce((sum, t) => sum + t.unreadCount, 0);
}
