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

const CURATED_BY_ID: Record<string, string[]> = {};

const CURATED_BY_NAME: Record<string, string[]> = {
  'soil restaurant': [
    'https://images.pexels.com/photos/262978/pexels-photo-262978.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
  ],
  'impact hub athens': [
    'https://images.pexels.com/photos/3183197/pexels-photo-3183197.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
  ],
  'spinster bar': [
    'https://images.pexels.com/photos/274192/pexels-photo-274192.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
  ],
  'roma gallery': [
    'https://images.pexels.com/photos/20967/pexels-photo.jpg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
  ],
  'rawbata': [
    'https://images.pexels.com/photos/2098085/pexels-photo-2098085.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
  ],
  'nolita athens': [
    'https://images.pexels.com/photos/6267/menu-restaurant-vintage-table.jpg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
  ],
  'fine mess smokehouse': [
    'https://images.pexels.com/photos/1639562/pexels-photo-1639562.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
  ],
  'the brunchers': [
    'https://images.pexels.com/photos/70497/pexels-photo-70497.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
  ],
  'tragos modern kafeneio': [
    'https://images.pexels.com/photos/1581384/pexels-photo-1581384.jpeg?auto=compress&cs=tinysrgb&w=1200&h=900&fit=crop',
  ],
};

export function getCuratedEventImageCandidates(event: EventLike): string[] {
  const out: string[] = [];
  const id = String(event.id ?? '').trim();
  if (id && CURATED_BY_ID[id]) out.push(...CURATED_BY_ID[id]);

  const name = normalizeName(event.name);
  if (name && CURATED_BY_NAME[name]) out.push(...CURATED_BY_NAME[name]);

  return Array.from(new Set(out.filter(Boolean)));
}

