import { ensureOperatorUserId, getOperatorUserId } from '@/lib/operatorConfig';
import {
  deliverOperatorMessage,
  shouldRequireOperatorMessageApi,
} from '@/lib/operatorMessageDelivery';
import { ensureAnonymousSession } from '@/lib/pilotSession';
import { insertGuestEchoViaApi } from '@/lib/guestNotificationEchoApi';
import { requestNotificationsRefresh } from '@/lib/notificationEvents';
import { fetchSenderBanditIdentity } from '@/lib/signalDelivery';
import { supabase } from '@/lib/supabase';
import { trackEvent } from '@/lib/analytics';
import { userFacingMessagingError } from '@/lib/userFacingMessagingError';

const DEFAULT_PRODUCTION_API_ORIGIN = 'https://bandits-two.vercel.app';

function isLocalWebHost(): boolean {
  if (typeof window === 'undefined') return true;
  const host = window.location?.hostname;
  if (host == null || typeof host !== 'string') return true;
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
}

function getApiBaseUrl(): string | null {
  const fromEnv = String(process.env.EXPO_PUBLIC_AVATAR_API_BASE ?? '').trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (__DEV__) return null;
  const origin = typeof window !== 'undefined' && window.location?.origin ? String(window.location.origin).trim() : '';
  if (origin && !isLocalWebHost()) return origin.replace(/\/$/, '');
  return DEFAULT_PRODUCTION_API_ORIGIN;
}

export type BackendStatus = {
  enabled: boolean;
  reason?: string;
  requiresLogin?: boolean;
};

export { ensureOperatorUserId, getOperatorUserId };

function createClientUuid(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (c?.randomUUID) return c.randomUUID();
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${s4()}${s4()}-${s4()}-4${s4().slice(0, 3)}-${((8 + Math.floor(Math.random() * 4)).toString(16) + s4().slice(0, 3))}-${s4()}${s4()}${s4()}`;
}

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
 * Lightweight probe only (never use this to hard-block messaging).
 * Prefer `getUser()` after `ensureAnonymousSession()` — fewer false negatives than stale `getSession()`.
 */
export async function getNotificationsBackendStatus(): Promise<BackendStatus> {
  await ensureAnonymousSession().catch(() => undefined);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) {
    return { enabled: false, reason: userError.message || 'Could not verify your session.' };
  }

  if (!user?.id) {
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
  if (sessionError) throw userFacingMessagingError(sessionError);
  const user = session?.user;
  if (!user) throw userFacingMessagingError(new Error('Session required.'));
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
  const rootId = createClientUuid();

  const apiPayload = {
    kind: 'local_friend' as const,
    threadRootId: rootId,
    title: personaTitle,
    message: trimmed,
    guestTitle: 'Local Friend request sent',
  };

  if (shouldRequireOperatorMessageApi()) {
    await deliverOperatorMessage(apiPayload);
    requestNotificationsRefresh();
    void trackEvent({
      eventName: 'local_friend_message_sent',
      referenceType: 'chat',
      referenceId: user.id,
    });
    return;
  }

  try {
    await deliverOperatorMessage(apiPayload);
    requestNotificationsRefresh();
    void trackEvent({
      eventName: 'local_friend_message_sent',
      referenceType: 'chat',
      referenceId: user.id,
    });
    return;
  } catch {
    /* local dev: optional direct insert below */
  }

  const row = {
    id: rootId,
    user_id: operatorUserId,
    type: 'local_friend' as const,
    title: personaTitle,
    message: trimmed,
    reference_id: String(user.id || '').trim(),
    reference_type: 'local_friend_request' as const,
  };
  const { error: insErr } = await supabase.from('notifications').insert(row);
  if (insErr) {
    if (isPersistenceBlocked(insErr)) {
      try {
        await deliverOperatorMessage(apiPayload);
        requestNotificationsRefresh();
        void trackEvent({
          eventName: 'local_friend_message_sent',
          referenceType: 'chat',
          referenceId: user.id,
        });
        return;
      } catch (err) {
        throw userFacingMessagingError(err);
      }
    }
    throw userFacingMessagingError(insErr);
  }
  // Guest-side Notifications mirror row: keeps traveler notifications/badge in sync.
  const guestRow = {
    user_id: String(user.id || '').trim(),
    type: 'local_friend' as const,
    title: 'Local Friend request sent',
    message: trimmed,
    reference_id: rootId || null,
    reference_type: 'local_friend_guest_echo' as const,
    is_read: false,
  };
  const { error: guestEchoError } = await supabase.from('notifications').insert(guestRow as never);
  if (guestEchoError) {
    try {
      await insertGuestEchoViaApi({
        kind: 'local_friend',
        threadRootId: rootId,
        title: guestRow.title,
        message: guestRow.message,
      });
    } catch {
      throw userFacingMessagingError(guestEchoError);
    }
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
