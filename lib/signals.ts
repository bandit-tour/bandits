import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { resolveCanonicalSignalThreadByDelivery } from '@/lib/canonicalSignalThread';
import { syncPilotThreadOpeningMessage } from '@/lib/pilotThreadIdentity';
import { SIGNAL_BANK_LINES } from '@/lib/signalBank';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type NetworkSignalRow = { id: string; body: string };

export type GuestFlipSignalResult = NetworkSignalRow & {
  deliveryId: string | null;
  senderUserId: string | null;
  deliveryStatus: string | null;
  /** Receiver inbox row for this delivery — use as chat `notificationId`, not the delivery UUID. */
  threadNotificationId: string | null;
};

const FLIP_SESSION_KEY = 'bandits_flip_session_v1';
const FLIP_CACHE_KEY = 'bandits_flip_signal_cache_v1';

let memoryBank: NetworkSignalRow[] | null = null;
let memoryBankAt = 0;
const MEMORY_TTL_MS = 60 * 60 * 1000;

/** FNV-1a style — deterministic for stable guest picks. */
export function stableStringHash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function pickIndexFromSeed(seed: string, n: number): number {
  if (n <= 0) return 0;
  return stableStringHash(seed) % n;
}

export async function getOrCreateFlipSessionKey(): Promise<string> {
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    let v = sessionStorage.getItem(FLIP_SESSION_KEY);
    if (!v) {
      v =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;
      sessionStorage.setItem(FLIP_SESSION_KEY, v);
    }
    return v;
  }
  const existing = await AsyncStorage.getItem(FLIP_SESSION_KEY);
  if (existing) return existing;
  const v = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await AsyncStorage.setItem(FLIP_SESSION_KEY, v);
  return v;
}

function localFallbackBank(): NetworkSignalRow[] {
  return SIGNAL_BANK_LINES.map((body, i) => ({ id: `local-${i}`, body }));
}

/**
 * Cached active signals from Supabase, or local `signalBank` fallback (offline / demo).
 */
export async function loadSignalBank(): Promise<NetworkSignalRow[]> {
  const now = Date.now();
  if (memoryBank && memoryBank.length && now - memoryBankAt < MEMORY_TTL_MS) {
    return memoryBank;
  }
  if (!isSupabaseConfigured()) {
    memoryBank = localFallbackBank();
    memoryBankAt = now;
    return memoryBank;
  }
  try {
    const { data, error } = await supabase
      .from('network_signal')
      .select('id, body')
      .eq('is_active', true)
      .order('sort_index', { ascending: true });
    if (error || !data?.length) {
      memoryBank = localFallbackBank();
    } else {
      memoryBank = data as NetworkSignalRow[];
    }
  } catch {
    memoryBank = localFallbackBank();
  }
  memoryBankAt = now;
  return memoryBank;
}

export function dayBucketUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

type FlipCache = {
  hotelSlug: string;
  day: string;
  sessionKey: string;
  id: string;
  body: string;
  deliveryId: string | null;
  senderUserId: string | null;
  deliveryStatus: string | null;
  threadNotificationId: string | null;
};

async function patchSignalNotificationCanonical(
  notificationId: string,
  userId: string,
  deliveryId: string,
  fallbackMessage: string,
): Promise<void> {
  const canonical = await resolveCanonicalSignalThreadByDelivery(deliveryId, userId).catch(() => null);
  const msg = (canonical?.signal_text || fallbackMessage).trim();
  const title = (canonical?.sender_name || '').trim() || 'Smaragda';
  await supabase.from('notifications').update({ title, message: msg }).eq('id', notificationId);
  if (msg) await syncPilotThreadOpeningMessage(notificationId, msg);
}

async function ensureSignalNotificationForDelivery(args: {
  userId: string;
  deliveryId: string;
  messageBody: string;
  threadNotificationId?: string | null;
}): Promise<string | null> {
  const uid = String(args.userId || '').trim();
  const did = String(args.deliveryId || '').trim();
  const body = String(args.messageBody || '').trim();
  if (!uid || !did || !body) return null;

  const explicitThreadId = String(args.threadNotificationId || '').trim();
  if (explicitThreadId) {
    const { data: byExplicit } = await supabase
      .from('notifications')
      .select('id')
      .eq('id', explicitThreadId)
      .eq('user_id', uid)
      .maybeSingle();
    if (byExplicit?.id) {
      await patchSignalNotificationCanonical(String(byExplicit.id), uid, did, body);
      return String(byExplicit.id);
    }
  }

  const { data: existing } = await supabase
    .from('notifications')
    .select('id')
    .eq('user_id', uid)
    .eq('type', 'signal_peer_delivery')
    .in('reference_type', ['signal_delivery', 'signal_delivery_peer'])
    .eq('reference_id', did)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) {
    await patchSignalNotificationCanonical(String(existing.id), uid, did, body);
    return String(existing.id);
  }

  const { data: inserted } = await supabase
    .from('notifications')
    .insert({
      user_id: uid,
      type: 'signal_peer_delivery',
      title: 'Smaragda',
      message: body,
      reference_id: did,
      reference_type: 'signal_delivery',
      is_read: false,
    })
    .select('id')
    .limit(1)
    .maybeSingle();
  const nid = String(inserted?.id || '').trim();
  if (nid) await patchSignalNotificationCanonical(nid, uid, did, body);
  return nid || null;
}

async function readFlipCache(): Promise<FlipCache | null> {
  try {
    let raw: string | null = null;
    if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
      raw = sessionStorage.getItem(FLIP_CACHE_KEY);
    } else {
      raw = await AsyncStorage.getItem(FLIP_CACHE_KEY);
    }
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<FlipCache> & Pick<FlipCache, 'hotelSlug' | 'day' | 'sessionKey' | 'id' | 'body'>;
    return {
      hotelSlug: p.hotelSlug,
      day: p.day,
      sessionKey: p.sessionKey,
      id: p.id,
      body: p.body,
      deliveryId: p.deliveryId ?? null,
      senderUserId: p.senderUserId ?? null,
      deliveryStatus: p.deliveryStatus ?? null,
      threadNotificationId: p.threadNotificationId ?? null,
    };
  } catch {
    return null;
  }
}

async function writeFlipCache(c: FlipCache): Promise<void> {
  const s = JSON.stringify(c);
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(FLIP_CACHE_KEY, s);
    return;
  }
  await AsyncStorage.setItem(FLIP_CACHE_KEY, s);
}

function parseRpcAssignPayload(raw: unknown): {
  deliveryId: string;
  signalId: string;
  body: string;
  senderUserId: string | null;
  deliveryStatus: string | null;
} | null {
  if (!raw || typeof raw !== 'object') return null;
  const j = raw as Record<string, unknown>;
  const deliveryId = j.delivery_id != null ? String(j.delivery_id) : '';
  const signalId = j.signal_id != null ? String(j.signal_id) : '';
  const body = j.body != null ? String(j.body) : '';
  if (!deliveryId || !signalId || !body) return null;
  const senderRaw = j.sender_user_id;
  const senderUserId =
    senderRaw === null || senderRaw === undefined ? null : String(senderRaw);
  const deliveryStatus = j.delivery_status != null ? String(j.delivery_status) : null;
  return { deliveryId, signalId, body, senderUserId, deliveryStatus };
}

/**
 * Guest flip line: prefers a real peer-backed assignment via `assign_signal_delivery` when
 * the user is authenticated (including anonymous) and Supabase is configured; otherwise falls
 * back to the curated bank / local cache behavior (unchanged).
 */
export async function getGuestFlipSignal(hotelSlug: string): Promise<GuestFlipSignalResult> {
  const day = dayBucketUtc();
  const sessionKey = await getOrCreateFlipSessionKey();
  const cached = await readFlipCache();
  const cacheMatchesSessionDay =
    !!cached && cached.hotelSlug === hotelSlug && cached.day === day && cached.sessionKey === sessionKey;
  if (cacheMatchesSessionDay && cached?.deliveryId) {
    return {
      id: cached.id,
      body: cached.body,
      deliveryId: cached.deliveryId ?? null,
      senderUserId: cached.senderUserId ?? null,
      deliveryStatus: cached.deliveryStatus ?? null,
      threadNotificationId: cached.threadNotificationId ?? null,
    };
  }

  if (isSupabaseConfigured()) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: rpcRaw, error } = await supabase.rpc('assign_signal_delivery', {
        p_hotel_slug: hotelSlug,
      });
      if (!error && rpcRaw) {
        const parsed = parseRpcAssignPayload(rpcRaw);
        if (parsed) {
          let threadNotificationId: string | null = null;
          const { data: delRow } = await supabase
            .from('signal_delivery')
            .select('thread_notification_id')
            .eq('id', parsed.deliveryId)
            .maybeSingle();
          if (delRow?.thread_notification_id) {
            threadNotificationId = String(delRow.thread_notification_id);
          }
          const out: GuestFlipSignalResult = {
            id: parsed.signalId,
            body: parsed.body,
            deliveryId: parsed.deliveryId,
            senderUserId: parsed.senderUserId,
            deliveryStatus: parsed.deliveryStatus,
            threadNotificationId,
          };
          const ensuredThreadId = await ensureSignalNotificationForDelivery({
            userId: user.id,
            deliveryId: out.deliveryId || '',
            messageBody: out.body,
            threadNotificationId: out.threadNotificationId,
          }).catch(() => null);
          if (ensuredThreadId) out.threadNotificationId = ensuredThreadId;
          await writeFlipCache({
            hotelSlug,
            day,
            sessionKey,
            id: out.id,
            body: out.body,
            deliveryId: out.deliveryId,
            senderUserId: out.senderUserId,
            deliveryStatus: out.deliveryStatus,
            threadNotificationId: out.threadNotificationId,
          });
          return out;
        }
      }

      // If assignment RPC fails/transiently returns empty, rehydrate from latest persisted delivery.
      const { data: latestDelivery } = await supabase
        .from('signal_delivery')
        .select('id, signal_id, sender_user_id, delivery_status, thread_notification_id')
        .eq('receiver_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestDelivery?.id && latestDelivery.signal_id) {
        const { data: sig } = await supabase
          .from('network_signal')
          .select('body')
          .eq('id', latestDelivery.signal_id)
          .maybeSingle();
        const body = String((sig as { body?: string } | null)?.body || '').trim();
        if (body) {
          const out: GuestFlipSignalResult = {
            id: String(latestDelivery.signal_id),
            body,
            deliveryId: String(latestDelivery.id),
            senderUserId: latestDelivery.sender_user_id ? String(latestDelivery.sender_user_id) : null,
            deliveryStatus: latestDelivery.delivery_status ? String(latestDelivery.delivery_status) : null,
            threadNotificationId: latestDelivery.thread_notification_id
              ? String(latestDelivery.thread_notification_id)
              : null,
          };
          const ensuredThreadId = await ensureSignalNotificationForDelivery({
            userId: user.id,
            deliveryId: out.deliveryId || '',
            messageBody: out.body,
            threadNotificationId: out.threadNotificationId,
          }).catch(() => null);
          if (ensuredThreadId) out.threadNotificationId = ensuredThreadId;
          await writeFlipCache({
            hotelSlug,
            day,
            sessionKey,
            id: out.id,
            body: out.body,
            deliveryId: out.deliveryId,
            senderUserId: out.senderUserId,
            deliveryStatus: out.deliveryStatus,
            threadNotificationId: out.threadNotificationId,
          });
          return out;
        }
      }
    }
  }

  if (cacheMatchesSessionDay && cached) {
    return {
      id: cached.id,
      body: cached.body,
      deliveryId: cached.deliveryId ?? null,
      senderUserId: cached.senderUserId ?? null,
      deliveryStatus: cached.deliveryStatus ?? null,
      threadNotificationId: cached.threadNotificationId ?? null,
    };
  }

  const bank = await loadSignalBank();
  if (bank.length === 0) {
    const fb = localFallbackBank()[0]!;
    const row: GuestFlipSignalResult = {
      id: fb.id,
      body: fb.body,
      deliveryId: null,
      senderUserId: null,
      deliveryStatus: null,
      threadNotificationId: null,
    };
    await writeFlipCache({
      hotelSlug,
      day,
      sessionKey,
      id: row.id,
      body: row.body,
      deliveryId: null,
      senderUserId: null,
      deliveryStatus: null,
      threadNotificationId: null,
    });
    return row;
  }

  const idx = Math.floor(Math.random() * bank.length);
  const pick = bank[idx]!;
  const row: GuestFlipSignalResult = {
    id: pick.id,
    body: pick.body,
    deliveryId: null,
    senderUserId: null,
    deliveryStatus: null,
    threadNotificationId: null,
  };
  await writeFlipCache({
    hotelSlug,
    day,
    sessionKey,
    id: row.id,
    body: row.body,
    deliveryId: null,
    senderUserId: null,
    deliveryStatus: null,
    threadNotificationId: null,
  });
  return row;
}

export function invalidateGuestFlipSignalCache(): void {
  try {
    if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(FLIP_CACHE_KEY);
      return;
    }
    void AsyncStorage.removeItem(FLIP_CACHE_KEY);
  } catch {
    /* ignore */
  }
}
