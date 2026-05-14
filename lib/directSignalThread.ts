import { supabase } from '@/lib/supabase';

/**
 * Guest-owned inbox row + chat root: someone from the live network reached out first;
 * thread opens with their preview line as the opening message (no cold outbound copy).
 */
export async function createGuestPresenceSignalThread(args: {
  banditName: string;
  previewMessage: string;
  banditId: string;
}): Promise<{ notificationId: string } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const title = args.banditName.trim() || 'Local banDit';
  const message =
    args.previewMessage.trim() || 'A new note in a bottle is waiting in your Notifications.';

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: user.id,
      type: 'presence_reply',
      title,
      message,
      reference_id: args.banditId,
      reference_type: 'presence_thread',
      is_read: true,
    } as never)
    .select('id')
    .maybeSingle();

  if (error || !data?.id) return null;
  return { notificationId: String(data.id) };
}
