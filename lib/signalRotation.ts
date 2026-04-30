import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadSignalBank, type NetworkSignalRow } from '@/lib/signals';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const LAST_PROFILE_HOTEL_SLUG_KEY = '@bandits_last_profile_hotel_slug_v1';
const MAX_HISTORY = 8;
const MS_24H = 24 * 60 * 60 * 1000;

function pickRandomExcluding(bank: NetworkSignalRow[], exclude: Set<string>): NetworkSignalRow | null {
  const pool = bank.filter((b) => !exclude.has(b.id));
  if (pool.length === 0) {
    const fallback = bank.filter((b) => b.id !== [...exclude][0]);
    if (fallback.length === 0) return bank[0] ?? null;
    return fallback[Math.floor(Math.random() * fallback.length)]!;
  }
  return pool[Math.floor(Math.random() * pool.length)]!;
}

/**
 * First profile row: assign a signal from the curated bank (no repeat logic yet).
 */
export async function assignInitialSignalIfNeeded(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const { data: row } = await supabase.from('user_profile').select('current_signal_id').eq('id', userId).maybeSingle();
    if (row?.current_signal_id) return;

    const bank = await loadSignalBank();
    if (bank.length === 0) return;
    const pick = pickRandomExcluding(bank, new Set());
    if (!pick) return;

    await supabase
      .from('user_profile')
      .update({
        current_signal_id: pick.id,
        last_signal_at: new Date().toISOString(),
        signal_history_ids: [pick.id],
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
  } catch {
    /* non-blocking */
  }
}

/**
 * When the guest moves to a different hotel context (QR), rotate to a new line (avoid recent history).
 */
export async function rotateSignalOnHotelSlugChange(userId: string, hotelSlug: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const prev = await AsyncStorage.getItem(LAST_PROFILE_HOTEL_SLUG_KEY);
    await AsyncStorage.setItem(LAST_PROFILE_HOTEL_SLUG_KEY, hotelSlug);
    if (prev == null || prev === hotelSlug) return;

    const { data: profile } = await supabase
      .from('user_profile')
      .select('current_signal_id, signal_history_ids')
      .eq('id', userId)
      .maybeSingle();
    if (!profile) return;

    await applyRotation(userId, profile.current_signal_id, profile.signal_history_ids ?? []);
  } catch {
    /* non-blocking */
  }
}

/**
 * If last rotation was more than 24h ago, pick a new signal.
 */
export async function maybeRotateUserSignal24h(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const { data: profile } = await supabase
      .from('user_profile')
      .select('current_signal_id, last_signal_at, signal_history_ids')
      .eq('id', userId)
      .maybeSingle();
    if (!profile?.last_signal_at) return;
    const last = new Date(profile.last_signal_at).getTime();
    if (Number.isNaN(last) || Date.now() - last < MS_24H) return;

    await applyRotation(userId, profile.current_signal_id, profile.signal_history_ids ?? []);
  } catch {
    /* non-blocking */
  }
}

async function applyRotation(
  userId: string,
  currentId: string | null,
  historyIds: string[],
): Promise<void> {
  const bank = await loadSignalBank();
  if (bank.length === 0) return;

  const exclude = new Set<string>(historyIds);
  if (currentId) exclude.add(currentId);
  const pick = pickRandomExcluding(bank, exclude);
  if (!pick) return;

  const nextHist = Array.from(new Set([...historyIds, ...(currentId ? [currentId] : []), pick.id])).slice(-MAX_HISTORY);

  await supabase
    .from('user_profile')
    .update({
      current_signal_id: pick.id,
      last_signal_at: new Date().toISOString(),
      signal_history_ids: nextHist,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
}
