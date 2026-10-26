/**
 * QR hotel welcome → Chat inbox (durable, idempotent).
 * The exact line shown under the QR becomes the opening Chat message.
 * Guest replies route to Local Friend / banDiTEAM (operator) — not a local mock.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { insertGuestEchoViaApi } from '@/lib/guestNotificationEchoApi';
import { requestNotificationsRefresh } from '@/lib/notificationEvents';
import { bootstrapMainAppSession, resolveTravelerSession } from '@/lib/pilotSession';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export const HOTEL_QR_WELCOME_REF = 'hotel_qr_welcome' as const;
export const HOTEL_QR_GUEST_REPLY_REF = 'hotel_qr_guest_reply' as const;

const LOCAL_SEED_PREFIX = '@bandits_qr_welcome_chat_v1:';

/** Stable UUID from seed (version-4 shape) so API + DB accept the id. */
export function deterministicUuidFromSeed(seed: string): string {
  let h1 = 2166136261;
  let h2 = 2166136261;
  const s = String(seed || '');
  for (let i = 0; i < s.length; i++) {
    h1 ^= s.charCodeAt(i);
    h1 = Math.imul(h1, 16777619);
    h2 ^= s.charCodeAt(s.length - 1 - i);
    h2 = Math.imul(h2, 16777619);
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  const raw = `${hex(h1)}${hex(h2)}${hex(h1 ^ h2)}${hex(~h1)}`.slice(0, 32);
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-4${raw.slice(13, 16)}-8${raw.slice(17, 20)}-${raw.slice(20, 32)}`;
}

function localSeedKey(userId: string, hotelSlug: string): string {
  return `${LOCAL_SEED_PREFIX}${userId}:${hotelSlug}`;
}

async function readLocalSeed(userId: string, hotelSlug: string): Promise<string | null> {
  const key = localSeedKey(userId, hotelSlug);
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function writeLocalSeed(userId: string, hotelSlug: string, threadRootId: string): Promise<void> {
  const key = localSeedKey(userId, hotelSlug);
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      localStorage.setItem(key, threadRootId);
      return;
    }
    await AsyncStorage.setItem(key, threadRootId);
  } catch {
    /* best-effort cache */
  }
}

async function findExistingWelcomeRow(
  userId: string,
  threadRootId: string,
  deliveryId: string | null,
): Promise<{ id: string; referenceId: string } | null> {
  if (!isSupabaseConfigured()) return null;

  if (deliveryId) {
    const { data } = await supabase
      .from('notifications')
      .select('id, reference_id')
      .eq('user_id', userId)
      .eq('type', 'signal_peer_delivery')
      .eq('reference_id', deliveryId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) {
      return { id: String(data.id), referenceId: String(data.reference_id || deliveryId) };
    }
  }

  const { data: byRoot } = await supabase
    .from('notifications')
    .select('id, reference_id')
    .eq('user_id', userId)
    .eq('reference_id', threadRootId)
    .in('reference_type', [HOTEL_QR_WELCOME_REF, 'signal_delivery', 'signal_delivery_peer'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (byRoot?.id) {
    return { id: String(byRoot.id), referenceId: String(byRoot.reference_id || threadRootId) };
  }

  const { data: byType } = await supabase
    .from('notifications')
    .select('id, reference_id')
    .eq('user_id', userId)
    .eq('type', 'signal_peer_delivery')
    .eq('reference_type', HOTEL_QR_WELCOME_REF)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (byType?.id) {
    return { id: String(byType.id), referenceId: String(byType.reference_id || threadRootId) };
  }

  return null;
}

export type EnsureQrWelcomeChatArgs = {
  hotelSlug: string;
  /** Exact text shown beneath the QR / bottle flip. */
  welcomeMessage: string;
  /** When assign_signal_delivery already created a durable delivery. */
  deliveryId?: string | null;
  threadNotificationId?: string | null;
};

export type EnsureQrWelcomeChatResult = {
  ok: boolean;
  detail: string;
  threadRootId?: string;
  notificationId?: string;
};

/**
 * Deliver the QR welcome line into Chat once per traveler+hotel.
 * Prefers an existing signal delivery thread; otherwise seeds via guest-echo API.
 */
export async function ensureQrWelcomeChat(
  args: EnsureQrWelcomeChatArgs,
): Promise<EnsureQrWelcomeChatResult> {
  const hotelSlug = String(args.hotelSlug || '').trim();
  const welcomeMessage = String(args.welcomeMessage || '').trim();
  const deliveryId = String(args.deliveryId || '').trim() || null;
  const explicitNotifId = String(args.threadNotificationId || '').trim() || null;

  if (!hotelSlug || !welcomeMessage) {
    return { ok: false, detail: 'missing_message' };
  }

  try {
    await bootstrapMainAppSession().catch(() => undefined);
    const traveler = await resolveTravelerSession();
    const userId = String(traveler?.user?.id || '').trim();
    if (!userId) return { ok: false, detail: 'no_session' };

    const threadRootId = deliveryId || deterministicUuidFromSeed(`qr-welcome:${userId}:${hotelSlug}`);

    if (explicitNotifId) {
      await writeLocalSeed(userId, hotelSlug, threadRootId);
      requestNotificationsRefresh();
      return { ok: true, detail: 'existing_delivery_thread', threadRootId, notificationId: explicitNotifId };
    }

    const existing = await findExistingWelcomeRow(userId, threadRootId, deliveryId);
    if (existing) {
      await writeLocalSeed(userId, hotelSlug, existing.referenceId);
      requestNotificationsRefresh();
      return {
        ok: true,
        detail: 'already_seeded',
        threadRootId: existing.referenceId,
        notificationId: existing.id,
      };
    }

    const localCached = await readLocalSeed(userId, hotelSlug);
    if (localCached && localCached === threadRootId) {
      const again = await findExistingWelcomeRow(userId, threadRootId, deliveryId);
      if (again) {
        return {
          ok: true,
          detail: 'already_seeded_local',
          threadRootId,
          notificationId: again.id,
        };
      }
    }

    if (deliveryId && isSupabaseConfigured()) {
      const { data: inserted } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: 'signal_peer_delivery',
          title: 'Local Friend',
          message: welcomeMessage,
          reference_id: deliveryId,
          reference_type: 'signal_delivery',
          is_read: false,
        })
        .select('id')
        .limit(1)
        .maybeSingle();
      if (inserted?.id) {
        await writeLocalSeed(userId, hotelSlug, deliveryId);
        requestNotificationsRefresh();
        return {
          ok: true,
          detail: 'seeded_delivery',
          threadRootId: deliveryId,
          notificationId: String(inserted.id),
        };
      }
    }

    await insertGuestEchoViaApi({
      kind: 'hotel_qr_welcome',
      threadRootId,
      title: 'Local Friend',
      message: welcomeMessage,
    });

    await writeLocalSeed(userId, hotelSlug, threadRootId);
    requestNotificationsRefresh();

    const seeded = await findExistingWelcomeRow(userId, threadRootId, deliveryId);
    return {
      ok: true,
      detail: 'seeded_api',
      threadRootId,
      notificationId: seeded?.id,
    };
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'seed_failed';
    return { ok: false, detail };
  }
}
