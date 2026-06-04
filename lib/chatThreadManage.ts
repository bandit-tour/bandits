import { addDismissedNotificationId } from '@/lib/dismissedThreads';
import { deleteNotificationThread } from '@/lib/threadDelete';
import { supabase } from '@/lib/supabase';

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

/** Delete the whole conversation (same as removing from Notifications inbox). */
export async function deleteEntireChatConversation(rootNotificationId: string): Promise<void> {
  const root = String(rootNotificationId || '').trim();
  if (!root) return;
  try {
    await deleteNotificationThread(root);
  } catch {
    /* still hide locally */
  }
  await addDismissedNotificationId(root);
}
