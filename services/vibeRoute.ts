import { Database } from '@/lib/database.types';

type Event = Database['public']['Tables']['event']['Row'];

export type VibeStop = {
  key: string;
  kind: 'event' | 'spot';
  order: number;
  name: string;
  category: string;
  vibeLine: string;
  address: string;
  imageCandidates: string[];
  eventId?: string;
  spotId?: string;
};

function cleanUrl(u: string | null | undefined): string | null {
  const t = u?.trim();
  if (!t) return null;
  const l = t.toLowerCase();
  if (l.includes('logobanditourapp') || l.includes('bandit-tour')) return null;
  return t;
}

export function eventImageCandidates(event: Event): string[] {
  const out: string[] = [];
  const add = (raw: string | null | undefined) => {
    const c = cleanUrl(raw);
    if (c && !out.includes(c)) out.push(c);
  };
  if (event.image_gallery) {
    try {
      const parsed = JSON.parse(event.image_gallery);
      if (Array.isArray(parsed)) {
        parsed.forEach((x: unknown) => typeof x === 'string' && add(x));
      }
    } catch {
      event.image_gallery.split(',').forEach((x) => add(x.trim()));
    }
  }
  add(event.image_url);
  return out;
}

function truncateVibe(text: string, max = 140): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function vibeLineForEvent(
  event: Event,
  personalTip: string | null | undefined,
): string {
  if (personalTip?.trim()) return truncateVibe(personalTip.trim());
  if (event.description?.trim()) return truncateVibe(event.description.trim());
  return `${event.genre} pick — locals actually go here.`;
}

/** Prefer one strong pick per genre, then fill by rating for a walkable “sequence”. */
export function buildVibeStopsFromEvents(
  events: Event[],
  tipsByEventId: Record<string, string | null | undefined>,
  max = 5,
): VibeStop[] {
  const sorted = [...events].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  const genres = ['Food', 'Culture', 'Nightlife', 'Shopping', 'Coffee'] as const;
  const picked: Event[] = [];
  const seen = new Set<string>();

  for (const g of genres) {
    const e = sorted.find((ev) => ev.genre === g && !seen.has(ev.id));
    if (e) {
      seen.add(e.id);
      picked.push(e);
    }
    if (picked.length >= max) break;
  }

  for (const e of sorted) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    picked.push(e);
    if (picked.length >= max) break;
  }

  const n = Math.min(Math.max(picked.length, 0), max);
  const slice = picked.slice(0, n);

  return slice.map((event, i) => ({
    key: `event-${event.id}`,
    kind: 'event' as const,
    order: i + 1,
    name: event.name || 'Place',
    category: event.genre,
    vibeLine: vibeLineForEvent(event, tipsByEventId[event.id]),
    address: [event.address, event.neighborhood, event.city].filter(Boolean).join(', '),
    imageCandidates: eventImageCandidates(event),
    eventId: event.id,
  }));
}

type SpotRow = {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  description?: string | null;
  image_url?: string | null;
  category?: string | null;
};

export function buildVibeStopsFromSpots(spots: SpotRow[], startOrder: number, max: number): VibeStop[] {
  const out: VibeStop[] = [];
  for (let i = 0; i < spots.length && out.length < max; i++) {
    const s = spots[i];
    const imgs: string[] = [];
    const c = cleanUrl(s.image_url);
    if (c) imgs.push(c);
    const desc = s.description?.trim();
    out.push({
      key: `spot-${s.id}`,
      kind: 'spot',
      order: startOrder + out.length,
      name: s.name || 'Spot',
      category: (s.category || 'Local').trim() || 'Local',
      vibeLine: desc ? truncateVibe(desc) : 'A local-coded stop on this thread.',
      address: [s.address, s.city].filter(Boolean).join(', ') || '',
      imageCandidates: imgs,
      spotId: s.id,
    });
  }
  return out;
}

/**
 * Produce 3–5 ordered stops: events first (curated sequence), then spots until at least 3 stops (if data exists).
 */
export function mergeVibeSequence(
  events: Event[],
  tipsByEventId: Record<string, string | null | undefined>,
  spots: SpotRow[],
): VibeStop[] {
  const fromEvents = buildVibeStopsFromEvents(events, tipsByEventId, 5);
  if (fromEvents.length >= 3) {
    return fromEvents.map((s, i) => ({ ...s, order: i + 1 }));
  }

  const usedNames = new Set(fromEvents.map((s) => s.name.toLowerCase()));
  const extraSpots = spots.filter((s) => !usedNames.has((s.name || '').toLowerCase()));
  const slotsLeft = 5 - fromEvents.length;
  const need = Math.min(slotsLeft, Math.max(0, 3 - fromEvents.length));
  const spotStops = buildVibeStopsFromSpots(extraSpots, fromEvents.length + 1, need);

  const merged = [...fromEvents, ...spotStops].slice(0, 5);
  return merged.map((s, i) => ({ ...s, order: i + 1 }));
}
