import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { mapOperatorApiHttpError } from '@/lib/userFacingMessagingError';

const DEFAULT_PRODUCTION_API_ORIGIN = 'https://bandits-two.vercel.app';

function isLocalWebHost(): boolean {
  if (typeof window === 'undefined') return true;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local');
}

function notifyApiOrigin(): string | null {
  const fromEnv = String(
    process.env.EXPO_PUBLIC_MESSAGING_API_BASE ?? process.env.EXPO_PUBLIC_AVATAR_API_BASE ?? '',
  ).trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (typeof window !== 'undefined' && !isLocalWebHost()) {
    return window.location.origin.replace(/\/$/, '');
  }
  return DEFAULT_PRODUCTION_API_ORIGIN;
}

export type RouteAskMeApiPayload = {
  kind: 'ask_me';
  threadRootId: string;
  askTargetBanditId: string;
  title: string;
  message: string;
  operatorMessage: string;
  guestTitle: string;
};

export type RouteLocalFriendApiPayload = {
  kind: 'local_friend';
  threadRootId: string;
  title: string;
  message: string;
  guestTitle?: string;
};

type RoutePayload = RouteAskMeApiPayload | RouteLocalFriendApiPayload;

async function postOperatorRoute(base: string, token: string, payload: RoutePayload): Promise<void> {
  const body =
    payload.kind === 'ask_me'
      ? {
          routeOperator: true,
          kind: 'ask_me',
          threadRootId: payload.threadRootId,
          askTargetBanditId: payload.askTargetBanditId,
          operatorTitle: payload.title,
          operatorMessage: payload.operatorMessage,
          title: payload.guestTitle,
          message: payload.message,
        }
      : {
          routeOperator: true,
          kind: 'local_friend',
          threadRootId: payload.threadRootId,
          operatorTitle: payload.title,
          operatorMessage: payload.message,
          title: payload.guestTitle ?? 'Local Friend request sent',
          message: payload.message,
        };

  const endpoints = ['/api/operator-message', '/api/notifications-guest-echo'];
  let lastError = 'Could not deliver message.';

  for (const path of endpoints) {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(
        path.endsWith('operator-message')
          ? payload
          : body,
      ),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    if (res.ok) return;
    lastError = mapOperatorApiHttpError(res.status, j.error);
    if (res.status !== 404) break;
  }

  throw new Error(lastError);
}

/** Service-role route: operator inbox row + traveler echo (bypasses notifications RLS). */
export async function routeOperatorMessageViaApi(payload: RoutePayload): Promise<void> {
  const base = notifyApiOrigin();
  if (!base) {
    throw new Error('messaging_api_missing');
  }
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw new Error(sessionError.message || 'Session error.');
  const token = String(session?.access_token ?? '').trim();
  if (!token) throw new Error('Session required.');

  await postOperatorRoute(base, token, payload);
}

/** Native installed builds: prefer API routing (RLS-safe) before direct Supabase insert. */
export function shouldPreferOperatorMessageApi(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}
