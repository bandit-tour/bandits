import { isMissingPostgrestRpcError } from '@/lib/rpcFallback';
import { supabase } from '@/lib/supabase';

export const DELETED_THREAD_REF = 'deleted_thread';

export function isDeletedThreadRef(referenceType: string | null | undefined): boolean {
  return String(referenceType || '').trim() === DELETED_THREAD_REF;
}

/**
 * Soft-hide owned notification rows (delete-for-me). Peer rows are untouched.
 * Survives refetch / logout-login. A later new message uses a normal reference_type
 * and resurrects the thread in Chat.
 */
export async function hideOwnedNotificationRowsForUser(
  notificationIds: string[],
  userId: string,
): Promise<void> {
  const uid = String(userId || '').trim();
  const ids = [...new Set(notificationIds.map((x) => String(x || '').trim()).filter(Boolean))];
  if (!uid || !ids.length) return;
  const { error } = await supabase
    .from('notifications')
    .update({ reference_type: DELETED_THREAD_REF, is_read: true })
    .eq('user_id', uid)
    .in('id', ids);
  if (error) {
    throw new Error(error.message || 'Could not hide conversation.');
  }
}

function isPilotCascadeBenignFailure(err: { message?: string }): boolean {
  const m = (err.message || '').toLowerCase();
  return (
    m.includes('only pilot operator') ||
    m.includes('incoming thread not found') ||
    m.includes('not deletable')
  );
}

export async function deleteNotificationThread(notificationId: string): Promise<void> {
  const id = String(notificationId || '').trim();
  if (!id) return;

  const { error: cascadeErr } = await supabase.rpc(
    'delete_pilot_incoming_thread_cascade',
    { p_thread_root_id: id } as never,
  );
  if (!cascadeErr) return;

  if (!isMissingPostgrestRpcError(cascadeErr) && !isPilotCascadeBenignFailure(cascadeErr)) {
    throw new Error(cascadeErr.message || 'Could not delete thread.');
  }

  const { error: rpcError } = await supabase.rpc('delete_notification_if_owner', { p_id: id } as never);
  if (!rpcError) return;

  if (!isMissingPostgrestRpcError(rpcError)) {
    throw new Error(rpcError.message || 'Could not delete thread.');
  }

  const { data, error: delErr } = await supabase.from('notifications').delete().eq('id', id).select('id');
  if (delErr) {
    throw new Error(delErr.message || 'Could not delete thread.');
  }
  if (!data?.length) {
    throw new Error('Could not delete notification. Apply migration 028, or you may not own this row.');
  }
}
