import { ensureAnonymousSession } from '@/lib/pilotSession';
import { supabase } from '@/lib/supabase';

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

export type OceanFloatClaimResult = {
  ok: boolean;
  reason?: string;
  floatId?: string;
  message?: string;
  notificationId?: string;
};

export type OceanFloatRevealResult = {
  ok: boolean;
  senderUserId?: string;
  senderPersonaName?: string;
};

/** Enqueue after Local Friend send (dev direct-insert path; production uses operator-message API). */
export async function enqueueLocalFriendOceanFloat(args: {
  threadRootId: string;
  senderUserId: string;
  messageBody: string;
  senderPersonaName: string;
}): Promise<string | null> {
  const { data, error } = await supabase.rpc('enqueue_local_friend_ocean_float', {
    p_thread_root_id: args.threadRootId,
    p_sender_user_id: args.senderUserId,
    p_message_body: args.messageBody,
    p_sender_persona_name: args.senderPersonaName,
  });
  if (error) {
    console.warn('[enqueueLocalFriendOceanFloat]', error.message);
    return null;
  }
  return data != null ? String(data) : null;
}

async function postOceanApi(path: string, body: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  await ensureAnonymousSession().catch(() => undefined);
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) {
    throw new Error('Session required. Open the app and try again.');
  }
  const apiBase = getApiBaseUrl();
  if (!apiBase) {
    throw new Error('Ocean API unavailable in this environment.');
  }
  const res = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((j.error && String(j.error)) || 'Request failed.');
  }
  return j;
}

function mapClaimRpcRow(row: Record<string, unknown>): OceanFloatClaimResult {
  return {
    ok: !!row.ok,
    reason: row.reason != null ? String(row.reason) : undefined,
    floatId: row.float_id != null ? String(row.float_id) : undefined,
    message: row.message != null ? String(row.message) : undefined,
    notificationId: row.notification_id != null ? String(row.notification_id) : undefined,
  };
}

async function claimViaRpc(): Promise<OceanFloatClaimResult> {
  await ensureAnonymousSession().catch(() => undefined);
  const { data, error } = await supabase.rpc('claim_local_friend_ocean_float');
  if (error) throw new Error(error.message || 'Could not claim message');
  return mapClaimRpcRow((data || {}) as Record<string, unknown>);
}

/** Claim one floating Local Friend message (bottle QR scan). Falls back to RPC when API is unavailable. */
export async function claimLocalFriendOceanFloat(): Promise<OceanFloatClaimResult> {
  const apiBase = getApiBaseUrl();
  if (!apiBase) {
    return claimViaRpc();
  }
  try {
    const j = await postOceanApi('/api/local-friend-ocean-claim');
    return {
      ok: !!j.ok,
      reason: j.reason != null ? String(j.reason) : undefined,
      floatId: j.float_id != null ? String(j.float_id) : j.floatId != null ? String(j.floatId) : undefined,
      message: j.message != null ? String(j.message) : undefined,
      notificationId:
        j.notification_id != null
          ? String(j.notification_id)
          : j.notificationId != null
            ? String(j.notificationId)
            : undefined,
    };
  } catch (apiErr) {
    if (__DEV__) {
      try {
        return await claimViaRpc();
      } catch {
        throw apiErr;
      }
    }
    throw apiErr;
  }
}

async function revealViaRpc(floatId: string): Promise<OceanFloatRevealResult> {
  const { data, error } = await supabase.rpc('reveal_local_friend_ocean_float', { p_float_id: floatId });
  if (error) throw new Error(error.message || 'Could not reveal sender');
  const row = (data || {}) as Record<string, unknown>;
  return {
    ok: !!row.ok,
    senderUserId: row.sender_user_id != null ? String(row.sender_user_id) : undefined,
    senderPersonaName: row.sender_persona_name != null ? String(row.sender_persona_name) : undefined,
  };
}

/** Receiver reveals who sent the floating message. */
export async function revealLocalFriendOceanFloat(floatId: string): Promise<OceanFloatRevealResult> {
  const fid = String(floatId || '').trim();
  if (!fid) throw new Error('Missing bottle thread.');
  const apiBase = getApiBaseUrl();
  if (!apiBase) {
    return revealViaRpc(fid);
  }
  try {
    const j = await postOceanApi('/api/local-friend-ocean-reveal', { floatId: fid });
    return {
      ok: !!j.ok,
      senderUserId: j.sender_user_id != null ? String(j.sender_user_id) : undefined,
      senderPersonaName:
        j.sender_persona_name != null
          ? String(j.sender_persona_name)
          : j.senderPersonaName != null
            ? String(j.senderPersonaName)
            : undefined,
    };
  } catch (apiErr) {
    if (__DEV__) {
      try {
        return await revealViaRpc(fid);
      } catch {
        throw apiErr;
      }
    }
    throw apiErr;
  }
}

export async function fetchOceanFloatMeta(floatId: string): Promise<{
  message_body: string;
  sender_persona_name: string;
  reveal_status: string;
  sender_user_id: string;
  claimed_by_user_id: string | null;
  status: string;
} | null> {
  const { data, error } = await supabase
    .from('local_friend_ocean_float')
    .select('message_body, sender_persona_name, reveal_status, sender_user_id, claimed_by_user_id, status')
    .eq('id', floatId)
    .maybeSingle();
  if (error || !data) return null;
  return data as {
    message_body: string;
    sender_persona_name: string;
    reveal_status: string;
    sender_user_id: string;
    claimed_by_user_id: string | null;
    status: string;
  };
}

export async function fetchOceanPeerMessages(floatId: string): Promise<
  { id: string; author_user_id: string; body: string; created_at: string }[]
> {
  const { data, error } = await supabase
    .from('local_friend_ocean_message')
    .select('id, author_user_id, body, created_at')
    .eq('ocean_float_id', floatId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data as { id: string; author_user_id: string; body: string; created_at: string }[];
}

async function sendPeerViaTable(floatId: string, text: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) throw new Error('Session required.');
  const { error: insErr } = await supabase.from('local_friend_ocean_message').insert({
    ocean_float_id: floatId,
    author_user_id: user.id,
    body: text.slice(0, 4000),
  });
  if (insErr) throw new Error(insErr.message || 'Could not send message');
}

/** Post a peer reply in a claimed ocean thread; notifies the other participant. */
export async function sendLocalFriendOceanPeerMessage(floatId: string, body: string): Promise<void> {
  const fid = String(floatId || '').trim();
  const text = String(body || '').trim();
  if (!fid || !text) throw new Error('Message is required.');
  const apiBase = getApiBaseUrl();
  if (!apiBase) {
    await sendPeerViaTable(fid, text);
    return;
  }
  try {
    await postOceanApi('/api/local-friend-ocean-reply', { floatId: fid, message: text });
  } catch (apiErr) {
    if (__DEV__) {
      try {
        await sendPeerViaTable(fid, text);
        return;
      } catch {
        throw apiErr;
      }
    }
    throw apiErr;
  }
}

export function isLocalFriendBottleInboxType(type: string | null | undefined): boolean {
  return String(type || '').trim() === 'local_friend_bottle';
}

export function isLocalFriendOceanClaimRef(refType: string | null | undefined): boolean {
  const rt = String(refType || '').trim();
  return rt === 'local_friend_ocean_claim' || rt === 'local_friend_ocean_found';
}
