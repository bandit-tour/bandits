import { supabase } from '@/lib/supabase';

export type PilotThreadIdentity = {
  thread_root_notification_id: string;
  recipient_user_id: string;
  sender_persona_bandit_id: string | null;
  sender_persona_display_name: string;
  sender_persona_avatar_url: string;
  opening_message: string;
};

export async function fetchPilotThreadIdentity(
  threadRootNotificationId: string,
): Promise<PilotThreadIdentity | null> {
  const id = String(threadRootNotificationId || '').trim();
  if (!id) return null;
  const { data, error } = await supabase
    .from('pilot_thread_identity')
    .select('*')
    .eq('thread_root_notification_id', id)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  return {
    thread_root_notification_id: String(row.thread_root_notification_id),
    recipient_user_id: String(row.recipient_user_id),
    sender_persona_bandit_id: row.sender_persona_bandit_id != null ? String(row.sender_persona_bandit_id) : null,
    sender_persona_display_name: String(row.sender_persona_display_name || '').trim() || 'banDit',
    sender_persona_avatar_url: String(row.sender_persona_avatar_url || '').trim(),
    opening_message: String(row.opening_message || '').trim(),
  };
}

/** Keeps `opening_message` aligned when the arrival notification body is patched from `network_signal`. */
export async function syncPilotThreadOpeningMessage(
  threadRootNotificationId: string,
  openingMessage: string,
): Promise<void> {
  const id = String(threadRootNotificationId || '').trim();
  const body = String(openingMessage || '').trim();
  if (!id || !body) return;
  const { error } = await supabase
    .from('pilot_thread_identity')
    .update({ opening_message: body, updated_at: new Date().toISOString() } as never)
    .eq('thread_root_notification_id', id);
  if (error && __DEV__) console.warn('[syncPilotThreadOpeningMessage]', error.message);
}
