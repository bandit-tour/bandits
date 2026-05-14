type EventLike = {
  id?: string | null;
  name?: string | null;
  genre?: string | null;
};

function normalizeName(v: string | null | undefined): string {
  return String(v ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Curated lookup tables were previously hand-mapped Pexels/Unsplash photos by
 * venue name. They are intentionally empty now: per the global image policy a
 * wrong image is worse than no image, and the runtime falls through to the
 * verified Google Places photo (or a category-specific neutral placeholder)
 * instead of an unrelated stock photo that "matches" only the genre.
 */
const CURATED_BY_ID: Record<string, string[]> = {};
const CURATED_BY_NAME: Record<string, string[]> = {};

export function getCuratedEventImageCandidates(event: EventLike): string[] {
  const out: string[] = [];
  const id = String(event.id ?? '').trim();
  if (id && CURATED_BY_ID[id]) out.push(...CURATED_BY_ID[id]);

  const name = normalizeName(event.name);
  if (name && CURATED_BY_NAME[name]) out.push(...CURATED_BY_NAME[name]);

  return Array.from(new Set(out.filter(Boolean)));
}

