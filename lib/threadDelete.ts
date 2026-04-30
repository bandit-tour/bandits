import { isMissingPostgrestRpcError } from '@/lib/rpcFallback';
import { supabase } from '@/lib/supabase';

const DELETED_REF_TYPE = 'deleted_thread';

export function isDeletedThreadRef(referenceType: string | null | undefined): boolean {
  return String(referenceType || '').trim() === DELETED_REF_TYPE;
}

export async function deleteNotificationThread(notificationId: string): Promise<void> {
  const id = String(notificationId || '').trim();
  if (!id) return;

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
