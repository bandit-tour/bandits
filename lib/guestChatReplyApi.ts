import { Platform } from 'react-native';

import { resolveTravelerSession } from '@/lib/pilotSession';

const DEFAULT_PRODUCTION_API_ORIGIN = 'https://bandits-two.vercel.app';

function isLocalWebHost(): boolean {
  if (typeof window === 'undefined') return true;
  const host = window.location?.hostname;
  if (host == null || typeof host !== 'string') return true;
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
}

function apiOrigin(): string | null {
  const fromEnv = String(process.env.EXPO_PUBLIC_AVATAR_API_BASE ?? '').trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (Platform.OS !== 'web') return DEFAULT_PRODUCTION_API_ORIGIN;
  if (__DEV__) return null;
  const origin =
    typeof window !== 'undefined' && window.location?.origin ? String(window.location.origin).trim() : '';
  if (origin && !isLocalWebHost()) return origin.replace(/\/$/, '');
  return DEFAULT_PRODUCTION_API_ORIGIN;
}

/** Persist a guest Chat follow-up and route it to Local Friend / banDiTEAM. */
export async function sendGuestChatReplyViaApi(args: {
  threadRootId: string;
  message: string;
  title?: string;
}): Promise<{ replyId: string }> {
  const base = apiOrigin();
  if (!base) throw new Error('chat_reply_api_missing');
  const traveler = await resolveTravelerSession();
  if (!traveler) throw new Error('Session required.');
  const token = traveler.accessToken;
  if (!token) throw new Error('Session required.');

  const res = await fetch(`${base}/api/guest-chat-reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      threadRootId: args.threadRootId,
      message: args.message,
      title: args.title || 'Traveler',
    }),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string; replyId?: string };
  if (!res.ok) throw new Error((j.error && String(j.error)) || 'Could not send reply.');
  return { replyId: String(j.replyId || '') };
}
