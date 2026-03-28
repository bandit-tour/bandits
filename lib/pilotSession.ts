import AsyncStorage from '@react-native-async-storage/async-storage';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const HOTEL_ENTRY_KEY = '@bandits_hotel_entry_v1';

/**
 * Official PLAY Theatrou Athens guest entry — use for QR, Wi‑Fi cards, emails, and all hotel touchpoints.
 * Web opens the PWA in-browser; no app-store redirect in the product flow.
 * Temp: Vercel host until banditour.app DNS is ready — migrate URL only, path stays `/hotel/play-theatrou`.
 */
export const PLAY_THEATROU_GUEST_ENTRY_URL = 'https://bandit-tours.vercel.app/hotel/play-theatrou' as const;

/** Same destination as the public URL path (Expo Router). */
export const PLAY_THEATROU_GUEST_ENTRY_PATH = '/hotel/play-theatrou' as const;

export const PLAY_THEATROU_SLUG = 'play-theatrou' as const;

/** Pilot: known hotel slugs (path segment after /hotel/). */
export const HOTEL_BY_SLUG: Record<string, { hotelId: string; displayName: string }> = {
  [PLAY_THEATROU_SLUG]: {
    hotelId: '00000000-0000-4000-8000-000000000001',
    displayName: 'PLAY Theatrou',
  },
};

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
  const norm = slug.trim().toLowerCase();
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
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) return;
    const { error } = await supabase.auth.signInAnonymously();
    if (error && !/anonymous sign-ins are disabled/i.test(error.message ?? '')) {
      console.warn('[pilotSession] anonymous sign-in:', error.message);
    }
  } catch (e) {
    console.warn('[pilotSession] ensureAnonymousSession', e);
  }
}

/**
 * Best-effort: one row tying anonymous user to hotel context (no forms).
 */
export async function syncPilotHotelProfileIfNeeded(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const entry = await getHotelEntry();
  if (!entry) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  try {
    await (supabase as any).from('user_profile').upsert(
      [
        {
          id: user.id,
          name: '',
          interests: [],
          city: 'Athens',
          location_permission: false,
          hotel_id: entry.hotelId,
          entry_source: entry.entrySource,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: 'id' },
    );
  } catch {
    /* non-blocking */
  }
}
