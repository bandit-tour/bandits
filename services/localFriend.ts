import { supabase } from '@/lib/supabase';

export async function sendLocalFriendMessage(message: string): Promise<void> {
  const trimmed = message?.trim();
  if (!trimmed) throw new Error('Message is required');

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('User not authenticated');

  // We persist Local Friend messages in the notifications table
  // so Inbox can render them by `type`.
  const { error } = await supabase.from('notifications').insert({
    user_id: user.id,
    type: 'local_friend',
    title: 'Local Friend',
    message: trimmed,
    reference_id: null,
    reference_type: null,
  });

  if (error) throw error;
}

