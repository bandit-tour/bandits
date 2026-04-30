import { ensureOperatorUserId, getOperatorUserId } from '@/lib/operatorConfig';
import { ensureAnonymousSession } from '@/lib/pilotSession';
import { requestNotificationsRefresh } from '@/lib/notificationEvents';
import { fetchSenderBanditIdentity } from '@/lib/signalDelivery';
import { supabase } from '@/lib/supabase';
import { trackEvent } from '@/lib/analytics';

const DEFAULT_PRODUCTION_API_ORIGIN = 'https://bandits-two.vercel.app';

function isLocalWebHost(): boolean {
  if (typeof window === 'undefined') return true;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local');
}

function getApiBaseUrl(): string | null {
  const fromEnv = String(process.env.EXPO_PUBLIC_AVATAR_API_BASE ?? '').trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (__DEV__) return null;
  if (typeof window !== 'undefined' && !isLocalWebHost()) return window.location.origin;
  return DEFAULT_PRODUCTION_API_ORIGIN;
}

export type BackendStatus = {
  enabled: boolean;
  reason?: string;
  requiresLogin?: boolean;
};

export { ensureOperatorUserId, getOperatorUserId };

export function isPersistenceBlocked(error: { message?: string; code?: string }): boolean {
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
  let user: { id: string } | null = null;
  await ensureAnonymousSession().catch(() => undefined);
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (session?.user) {
    user = { id: session.user.id };
  } else if (sessionError) {
    return { enabled: false, reason: sessionError.message || 'Could not verify your session.' };
  }

  if (!user) {
    return {
      enabled: false,
      reason: 'A quick app session is required for notifications. Open the app and try again.',
      requiresLogin: false,
    };
  }

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

  await ensureAnonymousSession().catch(() => undefined);
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw new Error(sessionError.message || 'Could not verify your session.');
  const user = session?.user;
  if (!user) throw new Error('Could not start a session. Open the app and try again in a moment.');
  const operatorUserId = await ensureOperatorUserId();
  if (!operatorUserId) {
    throw new Error(
      'Operator inbox is not configured. Set EXPO_PUBLIC_OPERATOR_USER_ID or add operator_user_id in Supabase table app_public_config (see migration 014).',
    );
  }

  const { data: prof } = await supabase.from('user_profile').select('name').eq('id', user.id).maybeSingle();
  const fromProfile = String((prof as { name?: string } | null)?.name || '').trim();
  const linked = await fetchSenderBanditIdentity(user.id);
  const fromLink = linked?.displayName?.trim() || '';
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const metaName =
    (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
    (typeof meta.name === 'string' && meta.name.trim()) ||
    '';
  const personaTitle = (fromProfile || fromLink || metaName || 'Traveler').trim() || 'Traveler';

  const row = {
    user_id: operatorUserId,
    type: 'local_friend' as const,
    title: personaTitle,
    message: trimmed,
    reference_id: user.id,
    reference_type: 'local_friend_request' as const,
  };
  const { error: insErr } = await supabase.from('notifications').insert(row);
  if (insErr) {
    if (isPersistenceBlocked(insErr)) {
      throw new Error('Local Friend is temporarily unavailable. Please try again later.');
    }
    throw new Error(insErr.message || 'Could not send your message.');
  }

  requestNotificationsRefresh();

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

  const operatorUserId = await ensureOperatorUserId();
  if (!operatorUserId) {
    throw new Error(
      'Operator inbox is not configured. Set EXPO_PUBLIC_OPERATOR_USER_ID or add operator_user_id in app_public_config.',
    );
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw new Error(sessionError.message || 'Could not verify your session.');
  const user = session?.user;
  if (!user) throw new Error('Session required. Open the app and try again.');
  if (user.id !== operatorUserId) throw new Error('Only operator account can send live alerts.');

  const apiBase = getApiBaseUrl();
  if (apiBase) {
    try {
      const res = await fetch(`${apiBase}/api/pilot-live-alert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ title, message }),
      });
      const j = (await res.json().catch(() => ({}))) as { recipientCount?: number; error?: string };
      if (res.ok) {
        return { recipientCount: Number(j.recipientCount) || 0 };
      }
      if (res.status !== 404) {
        throw new Error((j.error && String(j.error)) || 'Could not send live alert.');
      }
    } catch (e) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[pilot-live-alert] api fallback', e);
      }
    }
  }

  const { data: rows, error: rowsError } = await supabase.from('notifications').select('user_id').limit(5000);
  if (rowsError) throw new Error(rowsError.message || 'Could not load recipients.');

  const recipientIds = Array.from(
    new Set(
      (rows || [])
        .map((r: any) => String(r.user_id || '').trim())
        .filter((id) => id),
    ),
  );
  if (!recipientIds.includes(operatorUserId)) recipientIds.push(operatorUserId);
  if (recipientIds.length === 0) {
    throw new Error('No active travelers available right now. Recipients appear after first guest interaction.');
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

  requestNotificationsRefresh();

  return { recipientCount: recipientIds.length };
}
