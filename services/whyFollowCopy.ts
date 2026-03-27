import { Database } from '@/lib/database.types';

type Bandit = Database['public']['Tables']['bandit']['Row'];

export function getWhyFollowSupplement(bandit: Bandit): string | null {
  const city = bandit.city?.trim() || 'the city';
  const role = bandit.occupation?.trim() || 'local guide';
  const name = bandit.name?.trim() || 'This bandit';
  return `• ${name} curates routes in ${city} based on current local rhythms.
• Works from lived local context as a ${role}, not generic tourist lists.
• Best for guests who want neighborhood-level recommendations with clear next stops.`;
}

/**
 * Final why-follow body: DB `why_follow` if non-empty, else supplement.
 */
export function resolveWhyFollowText(bandit: Bandit): string {
  const raw = (bandit.why_follow || '').trim();
  if (raw) return raw;
  return getWhyFollowSupplement(bandit) || '';
}
