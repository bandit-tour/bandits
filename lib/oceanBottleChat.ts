import {
  fetchOceanFloatMeta,
  fetchOceanPeerMessages,
  type OceanFloatClaimResult,
} from '@/lib/localFriendOcean';
import { requestNotificationsRefresh } from '@/lib/notificationEvents';
import { ensureAnonymousSession } from '@/lib/pilotSession';
import { supabase } from '@/lib/supabase';

/** Unified peer messages for bottle threads (both parties, all platforms). */
export const OCEAN_THREAD_REPLY_REF = 'local_friend_ocean_thread' as const;

export const OCEAN_FOUND_REF = 'local_friend_ocean_found' as const;
export const OCEAN_CLAIM_REF = 'local_friend_ocean_claim' as const;
export const OCEAN_PEER_REF = 'local_friend_ocean_peer' as const;

export type OceanThreadRole = 'guest_claimer' | 'sender' | 'none';

export type OceanThreadMeta = {
  floatId: string;
  messageBody: string;
  senderUserId: string;
  claimedByUserId: string | null;
  senderPersonaName: string;
  revealStatus: 'hidden' | 'revealed';
  claimNotificationId: string | null;
  role: OceanThreadRole;
  /** Guest has sent at least one peer message — unlocks sender replies. */
  guestHasReplied: boolean;
  /** Either party has started the real chat (peer messages exist). */
  chatActivated: boolean;
};

export async function fetchOceanThreadMeta(
  floatId: string,
  userId: string,
): Promise<OceanThreadMeta | null> {
  const fid = String(floatId || '').trim();
  const uid = String(userId || '').trim();
  if (!fid || !uid) return null;

  const meta = await fetchOceanFloatMeta(fid);
  if (!meta) return null;

  const peerRows = await fetchOceanPeerMessages(fid);
  const guestHasReplied = peerRows.some(
    (r) => r.author_user_id === meta.claimed_by_user_id && meta.claimed_by_user_id,
  );
  const chatActivated = peerRows.length > 0;

  let role: OceanThreadRole = 'none';
  if (meta.sender_user_id === uid) role = 'sender';
  else if (meta.claimed_by_user_id === uid) role = 'guest_claimer';

  const { data: floatRow } = await supabase
    .from('local_friend_ocean_float')
    .select('claim_notification_id')
    .eq('id', fid)
    .maybeSingle();

  return {
    floatId: fid,
    messageBody: String(meta.message_body || '').trim(),
    senderUserId: meta.sender_user_id,
    claimedByUserId: meta.claimed_by_user_id,
    senderPersonaName: String(meta.sender_persona_name || 'Traveler').trim() || 'Traveler',
    revealStatus: meta.reveal_status === 'revealed' ? 'revealed' : 'hidden',
    claimNotificationId:
      floatRow && (floatRow as { claim_notification_id?: string }).claim_notification_id
        ? String((floatRow as { claim_notification_id: string }).claim_notification_id)
        : null,
    role,
    guestHasReplied,
    chatActivated,
  };
}

/** Sender may only write after the guest has sent the first peer message. */
export function senderMayComposeOceanThread(meta: OceanThreadMeta | null): boolean {
  if (!meta || meta.role !== 'sender') return false;
  return meta.guestHasReplied;
}

/** Guest claimer may reveal/send; sender waits for guest. */
export function userMayComposeOceanThread(meta: OceanThreadMeta | null): boolean {
  if (!meta) return false;
  if (meta.role === 'guest_claimer') return true;
  if (meta.role === 'sender') return senderMayComposeOceanThread(meta);
  return false;
}

export type OceanChatLine = {
  id: string;
  authorUserId: string;
  body: string;
  createdAt: string;
  isSelf: boolean;
};

/** Load thread lines from ocean peer table (source of truth for message bodies). */
export async function loadOceanThreadLines(floatId: string, userId: string): Promise<OceanChatLine[]> {
  const rows = await fetchOceanPeerMessages(floatId);
  return rows.map((r) => ({
    id: r.id,
    authorUserId: r.author_user_id,
    body: r.body,
    createdAt: r.created_at,
    isSelf: r.author_user_id === userId,
  }));
}

async function postOceanReplyApi(floatId: string, message: string): Promise<void> {
  await ensureAnonymousSession().catch(() => undefined);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Session required. Open the app and try again.');

  const fromEnv = String(process.env.EXPO_PUBLIC_AVATAR_API_BASE ?? '').trim().replace(/\/$/, '');
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? String(window.location.origin).trim().replace(/\/$/, '')
      : '';
  const apiBase =
    fromEnv ||
    (origin && !/localhost|127\.0\.0\.1/i.test(origin) ? origin : 'https://bandits-two.vercel.app');

  const res = await fetch(`${apiBase}/api/local-friend-ocean-reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ floatId, message }),
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((j.error && String(j.error)) || 'Could not send message');
  }
}

async function sendOceanPeerViaTable(floatId: string, text: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) throw new Error('Session required.');
  const { error } = await supabase.from('local_friend_ocean_message').insert({
    ocean_float_id: floatId,
    author_user_id: user.id,
    body: text.slice(0, 4000),
  });
  if (error) throw new Error(error.message || 'Could not send message');
}

/**
 * Send a peer message through the ocean API (creates bandit_reply inbox rows for both parties).
 */
export async function sendOceanThreadMessage(floatId: string, body: string): Promise<void> {
  const fid = String(floatId || '').trim();
  const text = String(body || '').trim();
  if (!fid || !text) throw new Error('Message is required.');

  try {
    await postOceanReplyApi(fid, text);
  } catch (apiErr) {
    if (__DEV__) {
      try {
        await sendOceanPeerViaTable(fid, text);
        requestNotificationsRefresh();
        return;
      } catch {
        throw apiErr;
      }
    }
    throw apiErr;
  }
  requestNotificationsRefresh();
}

export function mapClaimToThreadFloatId(claim: OceanFloatClaimResult): string | null {
  if (!claim.ok) return null;
  return claim.floatId ? String(claim.floatId) : null;
}

export function isOceanFoundNotification(referenceType: string | null | undefined): boolean {
  return String(referenceType || '').trim() === OCEAN_FOUND_REF;
}

export function isOceanThreadNotification(
  type: string | null | undefined,
  referenceType: string | null | undefined,
): boolean {
  const t = String(type || '').trim();
  const rt = String(referenceType || '').trim();
  if (t !== 'local_friend_bottle') return false;
  return (
    rt === OCEAN_CLAIM_REF ||
    rt === OCEAN_FOUND_REF ||
    rt === OCEAN_PEER_REF ||
    rt === OCEAN_THREAD_REPLY_REF
  );
}

/** Notification id to open unified /chat for this ocean float. */
export async function resolveOceanChatNotificationId(
  floatId: string,
  userId: string,
): Promise<string | null> {
  const fid = String(floatId || '').trim();
  const uid = String(userId || '').trim();
  if (!fid || !uid) return null;

  const meta = await fetchOceanThreadMeta(fid, uid);
  if (!meta) return null;

  if (meta.role === 'guest_claimer' && meta.claimNotificationId) {
    return meta.claimNotificationId;
  }

  const { data: foundRow } = await supabase
    .from('notifications')
    .select('id')
    .eq('user_id', uid)
    .eq('reference_id', fid)
    .eq('reference_type', OCEAN_FOUND_REF)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (foundRow?.id) return String(foundRow.id);

  const { data: peerRow } = await supabase
    .from('notifications')
    .select('id')
    .eq('user_id', uid)
    .eq('reference_id', fid)
    .in('reference_type', [OCEAN_PEER_REF, OCEAN_THREAD_REPLY_REF])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return peerRow?.id ? String(peerRow.id) : null;
}
