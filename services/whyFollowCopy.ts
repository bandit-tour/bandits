import { Database } from '@/lib/database.types';

type Bandit = Database['public']['Tables']['bandit']['Row'];

export function getWhyFollowSupplement(bandit: Bandit): string | null {
  const city = bandit.city?.trim() || 'Athens';
  const role = bandit.occupation?.trim() || 'local guide';
  const name = bandit.name?.trim() || 'This banDit';
  const roleKey = role.toLowerCase();

  if (roleKey.includes('music') || roleKey.includes('dj') || roleKey.includes('jazz')) {
    return `• ${name} knows where ${city} actually goes after dark, beyond tourist nightlife strips.
• Routes are tuned for sound and atmosphere: intimate venues, vinyl bars, and late sets.
• Follow for evenings that feel local, curated, and easy to navigate stop by stop.`;
  }
  if (roleKey.includes('food') || roleKey.includes('chef') || roleKey.includes('coffee')) {
    return `• ${name} curates food and coffee routes in ${city} built from local quality, not hype.
• Recommendations prioritize neighborhood kitchens, daily rhythm, and practical walking flow.
• Follow for authentic spots where service, taste, and atmosphere stay consistently strong.`;
  }
  if (roleKey.includes('design') || roleKey.includes('artist') || roleKey.includes('illustrator')) {
    return `• ${name} maps creative corners of ${city}: studios, concept spaces, and culture-forward stops.
• Picks focus on visual identity and local craft rather than generic checklist attractions.
• Follow for routes with strong aesthetic direction and clear cultural context.`;
  }
  if (roleKey.includes('market') || roleKey.includes('shop') || roleKey.includes('retail')) {
    return `• ${name} knows the right retail pockets in ${city}, from independents to trusted market lanes.
• Routes avoid tourist pricing traps and keep recommendations relevant to style and value.
• Follow for shopping paths that feel local, intentional, and time-efficient.`;
  }

  return `• ${name} curates routes in ${city} based on current local rhythms.
• Works from lived local context as a ${role}, not generic tourist lists.
• Follow for neighborhood-level recommendations with clear next stops and practical flow.`;
}

/**
 * Final why-follow body: DB `why_follow` if non-empty, else supplement.
 */
export function resolveWhyFollowText(bandit: Bandit): string {
  const raw = (bandit.why_follow || '').trim();
  if (raw) return raw;
  return getWhyFollowSupplement(bandit) || '';
}
