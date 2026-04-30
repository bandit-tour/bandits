import { supabase } from '@/lib/supabase';

export type PilotInboxHostBandit = {
  banditId: string;
  rosterName: string;
  avatarUrl: string;
};

let cache: { at: number; value: PilotInboxHostBandit | null } | null = null;
const TTL_MS = 60_000;

/**
 * One real `bandit` row for pilot inbox/chat when we surface “Local banDit” —
 * real photo + real `/bandit/[id]`, not a placeholder asset.
 */
export async function getPilotInboxHostBandit(): Promise<PilotInboxHostBandit | null> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.value;

  const { data: rows, error } = await supabase
    .from('bandit')
    .select('id, name, face_image_url, image_url')
    .order('name', { ascending: true })
    .limit(48);

  if (error || !rows?.length) {
    cache = { at: now, value: null };
    return null;
  }

  const withFace = (b: { face_image_url?: string | null; image_url?: string | null }) =>
    String(b.face_image_url || b.image_url || '').trim();

  const pick =
    rows.find((b) => /local/i.test(String(b.name || '')) && /ban/i.test(String(b.name || ''))) ||
    rows.find((b) => withFace(b)) ||
    rows[0];

  const id = pick?.id != null ? String(pick.id).trim() : '';
  if (!id) {
    cache = { at: now, value: null };
    return null;
  }

  const rosterName = String(pick.name || '').trim() || 'banDit';
  const avatarUrl = withFace(pick);
  const value: PilotInboxHostBandit = { banditId: id, rosterName, avatarUrl };
  cache = { at: now, value };
  return value;
}
