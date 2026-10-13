import { repairDisplayText } from '@/lib/repairTextEncoding';
import { getWhyFollowSupplement } from '@/services/whyFollowCopy';
import { pickIndexFromSeed } from '@/lib/signals';
import { SIGNAL_BANK_LINES } from '@/lib/signalBank';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type BanditRow = Database['public']['Tables']['bandit']['Row'];

export type BanditMomentPick = {
  banditId: string;
  banditName: string;
  body: string;
};

function firstWhyFollowLine(whyFollow: string | null | undefined): string {
  const wf = String(whyFollow || '').trim();
  if (!wf) return '';
  const line = wf
    .split('\n')
    .map((l) => l.trim().replace(/^•\s*/, ''))
    .find(Boolean);
  return line ? repairDisplayText(line) : '';
}

function momentBodyFromBandit(row: BanditRow): string {
  const desc = repairDisplayText(String(row.description || '').trim());
  if (desc.length >= 12) return desc;
  const why = firstWhyFollowLine(row.why_follow);
  if (why.length >= 12) return why;
  const supplement = getWhyFollowSupplement(row)
    .split('\n')
    .map((l) => l.trim().replace(/^•\s*/, ''))
    .find((l) => l.length >= 12);
  if (supplement) return repairDisplayText(supplement);
  const city = String(row.city || 'Athens').trim() || 'Athens';
  const name = String(row.name || 'A local banDit').trim();
  return `${name} is out in ${city} — follow the city rhythm they trust.`;
}

function banditDisplayName(row: BanditRow): string {
  const first = String(row.name || '').trim();
  const last = String(row.family_name || '').trim();
  return [first, last].filter(Boolean).join(' ') || 'A local banDit';
}

/**
 * Random “Moment” from Local banDit profiles (description → why_follow → supplement).
 * Uses `seed` for stable picks per scanner session/day.
 */
export async function pickRandomBanditMoment(seed: string): Promise<BanditMomentPick | null> {
  const { data, error } = await supabase
    .from('bandit')
    .select('id, name, family_name, city, occupation, description, why_follow')
    .order('created_at', { ascending: true });
  if (error || !data?.length) return null;

  const pool = (data as BanditRow[])
    .map((row) => ({
      banditId: String(row.id),
      banditName: banditDisplayName(row),
      body: momentBodyFromBandit(row),
    }))
    .filter((m) => m.body.trim().length >= 8);

  if (!pool.length) return null;
  const idx = pickIndexFromSeed(seed || 'bandit-moment', pool.length);
  return pool[idx] ?? pool[0] ?? null;
}

/** Last-resort copy when bandit rows are unavailable (still never “empty ocean”). */
export function pickSignalBankMoment(seed: string): BanditMomentPick {
  const idx = pickIndexFromSeed(`signal-bank:${seed}`, SIGNAL_BANK_LINES.length);
  const body = SIGNAL_BANK_LINES[idx] ?? SIGNAL_BANK_LINES[0] ?? 'The city is waiting.';
  return {
    banditId: '',
    banditName: 'Athens',
    body,
  };
}
