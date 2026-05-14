import { supabase } from '@/lib/supabase';

const DEFAULT_PRODUCTION_API_ORIGIN = 'https://bandits-two.vercel.app';

function isLocalWebHost(): boolean {
  if (typeof window === 'undefined') return true;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local');
}

function notifyApiOrigin(): string | null {
  const fromEnv = String(process.env.EXPO_PUBLIC_AVATAR_API_BASE ?? '').trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (__DEV__) return null;
  if (typeof window !== 'undefined' && !isLocalWebHost()) return window.location.origin.replace(/\/$/, '');
  return DEFAULT_PRODUCTION_API_ORIGIN;
}

export type GuestEchoAskApiPayload = {
  kind: 'ask_me';
  threadRootId: string;
  askTargetBanditId: string;
  title: string;
  message: string;
};

export type GuestEchoLocalFriendApiPayload = {
  kind: 'local_friend';
  threadRootId: string;
  title: string;
  message: string;
};

/** Inserts the traveler-visible notification row via Vercel (service role); used when Supabase guest insert hits RLS. */
export async function insertGuestEchoViaApi(
  payload: GuestEchoAskApiPayload | GuestEchoLocalFriendApiPayload,
): Promise<void> {
  const base = notifyApiOrigin();
  if (!base) {
    throw new Error('notifications_api_missing');
  }
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw new Error(sessionError.message || 'Session error.');
  const token = String(session?.access_token ?? '').trim();
  if (!token) throw new Error('Session required.');

  const res = await fetch(`${base}/api/notifications-guest-echo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error((j.error && String(j.error)) || 'Notification echo failed.');
}
