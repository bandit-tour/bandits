import { supabase } from '@/lib/supabase';

export type BackendStatus = {
  enabled: boolean;
  reason?: string;
  requiresLogin?: boolean;
};

function isPersistenceBlocked(error: { message?: string; code?: string }): boolean {
  const msg = (error.message ?? '').toLowerCase();
  const code = error.code ?? '';

  if (code === '23503' || code === '42501' || code === '42P01' || code === 'PGRST205') return true;
  if (
    /foreign key|violates foreign key|row-level security|permission denied|rls|policy|relation .* does not exist|could not find the table/i.test(
      msg,
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Validates whether notifications-backed features are usable in this environment.
 */
export async function getNotificationsBackendStatus(): Promise<BackendStatus> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) return { enabled: false, reason: userError.message || 'Could not verify your session.' };
  if (!user) return { enabled: false, reason: 'Sign in to use this feature.', requiresLogin: true };

  const { error } = await supabase.from('notifications').select('id').eq('user_id', user.id).limit(1);
  if (!error) return { enabled: true };

  if (isPersistenceBlocked(error)) {
    return {
      enabled: false,
      reason: 'Notifications backend is unavailable for this account right now.',
    };
  }

  return { enabled: false, reason: error.message || 'Notifications backend is unavailable.' };
}

export async function sendLocalFriendMessage(message: string): Promise<void> {
  const trimmed = message?.trim();
  if (!trimmed) throw new Error('Message is required');

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw new Error(userError.message || 'Could not verify your session.');
  if (!user) throw new Error('Sign in to send a Local Friend message.');

  const { error } = await supabase.from('notifications').insert({
    user_id: user.id,
    type: 'local_friend',
    title: 'Local Friend request',
    message: trimmed,
    reference_id: null,
    reference_type: null,
  });

  if (error) {
    if (isPersistenceBlocked(error)) {
      throw new Error('Local Friend is temporarily unavailable. Please try again later.');
    }
    throw new Error(error.message || 'Could not send your message.');
  }
}
