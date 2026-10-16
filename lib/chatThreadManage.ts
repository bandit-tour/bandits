import {
  addDismissedChatThreadKey,
  addDismissedNotificationIds,
} from '@/lib/dismissedThreads';
import { deleteNotificationThread, hideOwnedNotificationRowsForUser } from '@/lib/threadDelete';
import { supabase } from '@/lib/supabase';
import type { ChatThreadSummary } from '@/lib/chatThreads';
import { notificationMatchesChatThreadKey } from '@/lib/chatThreads';

/** Server-backed chat row id from UI id (`r-{notificationId}`). */
export function chatMessageNotificationId(messageId: string): string | null {
  const raw = String(messageId || '').trim();
  const m = raw.match(/^r-(.+)$/);
  return m?.[1]?.trim() || null;
}

export async function deleteChatMessagesByIds(messageIds: string[]): Promise<void> {
  const ids = [...new Set(messageIds.map(chatMessageNotificationId).filter(Boolean))] as string[];
  if (ids.length === 0) return;
  const { error } = await supabase.from('notifications').delete().in('id', ids);
  if (error) throw new Error(error.message || 'Could not delete messages.');
}

/** Remove reply rows for this thread; keeps the root notification row. */
export async function clearChatThreadReplies(rootNotificationId: string): Promise<void> {
  const root = String(rootNotificationId || '').trim();
  if (!root) return;
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('reference_id', root)
    .eq('type', 'bandit_reply');
  if (error) throw new Error(error.message || 'Could not clear chat history.');
}

/**
 * Delete the whole conversation for the current user only.
 * Does not delete peer notifications, ocean float rows, or peer messages.
 */
export async function deleteEntireChatConversation(rootNotificationId: string): Promise<void> {
  const root = String(rootNotificationId || '').trim();
  if (!root) return;
  await addDismissedChatThreadKey(`reply:${root}`);
  await addDismissedChatThreadKey(`ask:${root}`);
  await addDismissedChatThreadKey(`ocean:${root}`);
  await addDismissedChatThreadKey(`local_friend:${root}`);
  await addDismissedChatThreadKey(`signal:${root}`);
  await addDismissedChatThreadKey(`moment:${root}`);
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const uid = String(user?.id || '').trim();
    if (uid) {
      await hideOwnedNotificationRowsForUser([root], uid);
    }
  } catch {
    /* local dismiss still holds */
  }
  try {
    await deleteNotificationThread(root);
  } catch {
    /* soft-hide + dismiss still hide */
  }
  await addDismissedNotificationIds([root]);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Remove a Chat inbox thread for this user only (delete-for-me / hide-from-my-inbox).
 * Peer data (ocean floats, their inbox) stays intact.
 *
 * Durability layers (in order):
 * 1. Local dismiss by threadKey + timestamp (blocks refetch / moment merge resurrection)
 * 2. Soft-hide owned notification rows (reference_type = deleted_thread) — survives login
 * 3. Best-effort hard delete of owned rows
 *
 * Product rule: thread stays gone until a genuinely newer message arrives
 * (created_at > dismissedAt), which resurrects it for this user only.
 */
export async function deleteChatThreadForUser(
  thread: ChatThreadSummary,
  userId: string,
): Promise<void> {
  const uid = String(userId || '').trim();
  const key = String(thread.threadKey || '').trim();
  if (!key) return;

  const dismissedAt = new Date().toISOString();
  /** Persist hide first so any concurrent refetch cannot resurrect. */
  await addDismissedChatThreadKey(key, dismissedAt);

  if (key.startsWith('moment:')) {
    const momentThreadId = key.slice('moment:'.length);
    try {
      const { removeMomentChatThread } = await import('@/lib/guest-moment/store');
      await removeMomentChatThread(momentThreadId);
    } catch {
      /* best-effort */
    }
  }

  const ids = new Set<string>();
  const openId = String(thread.openNotificationId || '').trim();
  if (openId && UUID_RE.test(openId)) ids.add(openId);

  if (uid) {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, title, message, reference_id, reference_type, is_read, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });
    if (!error && data?.length) {
      for (const row of data as Array<{
        id: string;
        type: string;
        title: string;
        message: string;
        reference_id: string | null;
        reference_type: string | null;
        is_read: boolean;
        created_at: string;
      }>) {
        if (notificationMatchesChatThreadKey(row, key)) {
          ids.add(String(row.id));
        }
      }
    }
  }

  const idList = [...ids];

  if (uid && idList.length) {
    try {
      await hideOwnedNotificationRowsForUser(idList, uid);
    } catch {
      /* local threadKey dismiss still holds */
    }
  }

  for (const id of idList) {
    try {
      await deleteNotificationThread(id);
    } catch {
      /* soft-hide + dismiss still hide */
    }
  }

  if (idList.length) {
    await addDismissedNotificationIds(idList);
  } else if (openId) {
    /** Non-UUID local moment open id — still dismiss so reload stays clean. */
    await addDismissedNotificationIds([openId]);
  }
}
