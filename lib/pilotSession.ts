import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { DEFAULT_HOTEL_SLUG, HOTEL_WHITE_LABELS, isKnownHotelSlug, normalizeHotelSlug } from '@/lib/hotelWhiteLabel';
import { getUserEmailForAdminCheck } from '@/lib/appAdminAccess';
import {
  assignInitialSignalIfNeeded,
  maybeRotateUserSignal24h,
  rotateSignalOnHotelSlugChange,
} from '@/lib/signalRotation';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const HOTEL_ENTRY_KEY = '@bandits_hotel_entry_v1';
let ensureAnonInFlight: Promise<void> | null = null;
let lastAnonAttemptMs = 0;
let lastAnonFailureMs = 0;
const ANON_ATTEMPT_MIN_GAP_MS = 5000;
const ANON_FAILURE_BACKOFF_MS = 30000;

const DEFAULT_PLAY_GUEST_ENTRY_URL = 'https://bandits-two.vercel.app/hotel/play-theatrou';

function resolvePlayGuestEntryUrl(): string {
  const fromEnv =
    typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_PLAY_GUEST_ENTRY_URL
      ? String(process.env.EXPO_PUBLIC_PLAY_GUEST_ENTRY_URL).trim()
      : '';
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const fromExtra =
    typeof extra?.EXPO_PUBLIC_PLAY_GUEST_ENTRY_URL === 'string'
      ? extra.EXPO_PUBLIC_PLAY_GUEST_ENTRY_URL.trim()
      : '';
  const pick = fromEnv || fromExtra;
  if (pick && /^https:\/\//i.test(pick)) {
    try {
      return new URL(pick).toString().replace(/\/$/, '');
    } catch {
      /* fall through */
    }
  }
  return DEFAULT_PLAY_GUEST_ENTRY_URL;
}

/**
 * Official PLAY Theatrou Athens guest entry — use for QR, Wi‑Fi cards, emails, and all hotel touchpoints.
 * Web opens the PWA in-browser; no app-store redirect in the product flow.
 * Set `EXPO_PUBLIC_PLAY_GUEST_ENTRY_URL` in Vercel (same project as `npm run build`) so this matches the host you deploy.
 * If a URL still shows an old UI, that deployment is serving an older build — redeploy from current `main`.
 */
export const PLAY_THEATROU_GUEST_ENTRY_URL: string = resolvePlayGuestEntryUrl();

/** Same destination as the public URL path (Expo Router). */
export const PLAY_THEATROU_GUEST_ENTRY_PATH = '/hotel/play-theatrou' as const;

export const PLAY_THEATROU_SLUG = 'play-theatrou' as const;
export const NYX_ATHENS_SLUG = 'nyx-athens' as const;
export const ALUMA_ATHENS_SLUG = 'aluma-athens' as const;

/** Pilot: known hotel slugs (path segment after /hotel/). */
export const HOTEL_BY_SLUG: Record<string, { hotelId: string; displayName: string }> = {
  [PLAY_THEATROU_SLUG]: {
    hotelId: HOTEL_WHITE_LABELS[PLAY_THEATROU_SLUG].hotelId,
    displayName: HOTEL_WHITE_LABELS[PLAY_THEATROU_SLUG].displayName,
  },
  [NYX_ATHENS_SLUG]: {
    hotelId: HOTEL_WHITE_LABELS[NYX_ATHENS_SLUG].hotelId,
    displayName: HOTEL_WHITE_LABELS[NYX_ATHENS_SLUG].displayName,
  },
  [ALUMA_ATHENS_SLUG]: {
    hotelId: HOTEL_WHITE_LABELS[ALUMA_ATHENS_SLUG].hotelId,
    displayName: HOTEL_WHITE_LABELS[ALUMA_ATHENS_SLUG].displayName,
  },
};

export const NYX_ATHENS_GUEST_ENTRY_PATH = '/hotel/nyx-athens' as const;
/** Branded path alias — resolves to the same hotel as `NYX_ATHENS_GUEST_ENTRY_PATH` via `normalizeHotelSlug`. */
export const NYX_THEATROU_GUEST_ENTRY_PATH = '/hotel/nyx-theatrou' as const;
export const ALUMA_ATHENS_GUEST_ENTRY_PATH = '/hotel/aluma-athens' as const;

const BASE_GUEST_ENTRY_ORIGIN = (() => {
  try {
    const url = new URL(PLAY_THEATROU_GUEST_ENTRY_URL);
    return `${url.protocol}//${url.host}`;
  } catch {
    return 'https://bandits-two.vercel.app';
  }
})();

export const NYX_ATHENS_GUEST_ENTRY_URL = `${BASE_GUEST_ENTRY_ORIGIN}${NYX_ATHENS_GUEST_ENTRY_PATH}`;
export const NYX_THEATROU_GUEST_ENTRY_URL = `${BASE_GUEST_ENTRY_ORIGIN}${NYX_THEATROU_GUEST_ENTRY_PATH}`;
export const ALUMA_ATHENS_GUEST_ENTRY_URL = `${BASE_GUEST_ENTRY_ORIGIN}${ALUMA_ATHENS_GUEST_ENTRY_PATH}`;

export type HotelEntry = {
  slug: string;
  hotelId: string;
  displayName: string;
  /** How the guest arrived; QR and universal link share the same URL for PLAY Theatrou. */
  entrySource: 'guest_universal' | 'hotel_link' | 'hotel_qr';
};

export async function persistHotelEntry(
  slug: string,
  source: HotelEntry['entrySource'] = 'guest_universal',
): Promise<boolean> {
  const norm = normalizeHotelSlug(slug);
  if (!isKnownHotelSlug(norm)) {
    const fallback = HOTEL_WHITE_LABELS[DEFAULT_HOTEL_SLUG];
    const fallbackPayload: HotelEntry = {
      slug: DEFAULT_HOTEL_SLUG,
      hotelId: fallback.hotelId,
      displayName: fallback.displayName,
      entrySource: source,
    };
    try {
      await AsyncStorage.setItem(HOTEL_ENTRY_KEY, JSON.stringify(fallbackPayload));
    } catch {
      /* ignore */
    }
    return false;
  }
  const meta = HOTEL_BY_SLUG[norm];
  if (!meta) return false;
  const payload: HotelEntry = {
    slug: norm,
    hotelId: meta.hotelId,
    displayName: meta.displayName,
    entrySource: source,
  };
  try {
    await AsyncStorage.setItem(HOTEL_ENTRY_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
  return true;
}

export async function getHotelEntry(): Promise<HotelEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(HOTEL_ENTRY_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== 'object') return null;
    return p as HotelEntry;
  } catch {
    return null;
  }
}

/**
 * Hotel guest pilot: anonymous Supabase session, no signup UI.
 */
export async function ensureAnonymousSession(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const now = Date.now();
  if (ensureAnonInFlight) return ensureAnonInFlight;
  if (now - lastAnonAttemptMs < ANON_ATTEMPT_MIN_GAP_MS) return;
  if (lastAnonFailureMs > 0 && now - lastAnonFailureMs < ANON_FAILURE_BACKOFF_MS) return;
  lastAnonAttemptMs = now;
  try {
    ensureAnonInFlight = (async () => {
      // Prefer local session — avoids getUser() errors when the session was just cleared (logout).
      const {
        data: { session: s0 },
      } = await supabase.auth.getSession();
      if (s0?.user) return;
      // Hydration race: persisted email/password session may not be in memory yet — wait once before anon.
      await new Promise((r) => setTimeout(r, 220));
      const {
        data: { session: sessionAfterWait },
      } = await supabase.auth.getSession();
      if (sessionAfterWait?.user) return;
      const { error } = await supabase.auth.signInAnonymously();
      if (error && !/anonymous sign-ins are disabled/i.test(error.message ?? '')) {
        lastAnonFailureMs = Date.now();
        console.warn('[pilotSession] anonymous sign-in:', error.message);
      }
    })();
    await ensureAnonInFlight;
  } catch (e) {
    lastAnonFailureMs = Date.now();
    console.warn('[pilotSession] ensureAnonymousSession', e);
  } finally {
    ensureAnonInFlight = null;
  }
}

/**
 * Main tabs: wait for persisted session to hydrate before creating an anonymous user.
 * Prevents admin/email sessions from racing `signInAnonymously()`.
 */
export async function bootstrapMainAppSession(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const web = Platform.OS === 'web';
  /** Desktop/PWA often restores localStorage session after first paint — wait longer before anon. */
  const maxIterations = web ? 30 : 8;
  const stepMs = web ? 150 : 120;

  let session = (await supabase.auth.getSession()).data.session ?? null;
  if (!session) {
    for (let i = 0; i < maxIterations; i += 1) {
      await new Promise((r) => setTimeout(r, stepMs));
      session = (await supabase.auth.getSession()).data.session ?? null;
      if (session) break;
    }
  }
  /** Nudge persisted refresh on web — `getSession()` can stay null until JWT is loaded. */
  if (!session && web) {
    try {
      await supabase.auth.getUser();
    } catch {
      /* ignore */
    }
    session = (await supabase.auth.getSession()).data.session ?? null;
  }
  const u = session?.user;
  if (u && getUserEmailForAdminCheck(u)) {
    await syncPilotHotelProfileIfNeeded();
    return;
  }
  if (u?.id) {
    await syncPilotHotelProfileIfNeeded();
    return;
  }
  await ensureAnonymousSession();
  await syncPilotHotelProfileIfNeeded();
}

/**
 * Best-effort: one row tying anonymous user to hotel context (no forms).
 */
export async function syncPilotHotelProfileIfNeeded(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const entry = await getHotelEntry();
  if (!entry) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return;
  try {
    const { data: existing } = await supabase
      .from('user_profile')
      .select('name')
      .eq('id', user.id)
      .maybeSingle();
    const existingName = String((existing as any)?.name || '').trim();
    const meta = (user.user_metadata || {}) as Record<string, unknown>;
    const metaName =
      typeof meta.full_name === 'string'
        ? meta.full_name.trim()
        : typeof meta.name === 'string'
          ? meta.name.trim()
          : '';
    const fallbackName = 'Guest';
    await supabase.from('user_profile').upsert(
      [
        {
          id: user.id,
          name: existingName || metaName || fallbackName,
          interests: [],
          city: 'Athens',
          location_permission: false,
          hotel_id: entry.hotelId,
          entry_source: entry.entrySource,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: 'id', defaultToNull: false } as { onConflict: string; defaultToNull?: boolean },
    );
    await assignInitialSignalIfNeeded(user.id);
    await rotateSignalOnHotelSlugChange(user.id, entry.slug);
    await maybeRotateUserSignal24h(user.id);
  } catch {
    /* non-blocking */
  }
}
