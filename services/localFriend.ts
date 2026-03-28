import { supabase } from '@/lib/supabase';
import { trackEvent } from '@/lib/analytics';

export type BackendStatus = {
  enabled: boolean;
  reason?: string;
  requiresLogin?: boolean;
};

export function getOperatorUserId(): string | null {
  const v = String(process.env.EXPO_PUBLIC_OPERATOR_USER_ID ?? '').trim();
  return v.length > 0 ? v : null;
}

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
  const operatorUserId = getOperatorUserId();
  if (!operatorUserId) {
    throw new Error('Operator routing is not configured. Set EXPO_PUBLIC_OPERATOR_USER_ID.');
  }

  const { error } = await supabase.from('notifications').insert({
    user_id: operatorUserId,
    type: 'local_friend',
    title: 'Local Friend request',
    message: trimmed,
    reference_id: user.id,
    reference_type: 'local_friend_request',
  });

  if (error) {
    if (isPersistenceBlocked(error)) {
      throw new Error('Local Friend is temporarily unavailable. Please try again later.');
    }
    throw new Error(error.message || 'Could not send your message.');
  }

  void trackEvent({
    eventName: 'local_friend_message_sent',
    referenceType: 'chat',
    referenceId: user.id,
  });
}

export async function sendPilotLiveAlert(args: {
  title: string;
  message: string;
}): Promise<{ recipientCount: number }> {
  const title = args.title.trim();
  const message = args.message.trim();
  if (!title) throw new Error('Alert title is required.');
  if (!message) throw new Error('Alert message is required.');

  const operatorUserId = getOperatorUserId();
  if (!operatorUserId) {
    throw new Error('Operator routing is not configured. Set EXPO_PUBLIC_OPERATOR_USER_ID.');
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw new Error(userError.message || 'Could not verify your session.');
  if (!user) throw new Error('Sign in required.');
  if (user.id !== operatorUserId) throw new Error('Only operator account can send live alerts.');

  const { data: rows, error: rowsError } = await supabase.from('notifications').select('user_id').limit(5000);
  if (rowsError) throw new Error(rowsError.message || 'Could not load recipients.');

  const recipientIds = Array.from(
    new Set(
      (rows || [])
        .map((r: any) => String(r.user_id || '').trim())
        .filter((id) => id && id !== operatorUserId),
    ),
  );

  if (recipientIds.length === 0) {
    throw new Error('No pilot recipients found yet. Ask users to send one message first.');
  }

  const payload = recipientIds.map((uid) => ({
    user_id: uid,
    type: 'live_alert',
    title,
    message,
    reference_id: operatorUserId,
    reference_type: 'pilot_live_alert',
  }));

  const { error: insertError } = await supabase.from('notifications').insert(payload);
  if (insertError) throw new Error(insertError.message || 'Could not send live alert.');

  return { recipientCount: recipientIds.length };
}
