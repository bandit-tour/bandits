import { supabase } from '@/lib/supabase';
import { getHotelEntry } from '@/lib/pilotSession';

export type InboxPresenceBandit = {
  banditId: string;
  displayName: string;
  avatarUrl: string;
  vibeLine: string;
  source: 'linked_user' | 'catalog' | 'curated';
};

const PILOT_CITY = 'Athens';

function vibeFromBandit(row: {
  why_follow: string | null;
  description: string | null;
  occupation: string;
}): string {
  const w = row.why_follow?.trim();
  if (w) return w.length > 120 ? `${w.slice(0, 119)}…` : w;
  const d = row.description?.trim();
  if (d) return d.length > 120 ? `${d.slice(0, 119)}…` : d;
  const o = row.occupation?.trim();
  if (o) return `${o} · local picks nearby`;
  return 'Knows rooftop bars + hidden spots nearby.';
}

function avatarFromBandit(row: { face_image_url: string | null; image_url: string }): string {
  const f = row.face_image_url?.trim();
  if (f) return f;
  return row.image_url?.trim() || '';
}

/**
 * Pilot: surface 1–3 Local Bandit personas so the inbox never reads as an empty network.
 * Priority: bandits linked via `user_bandit` (real people on personas), then Athens catalog bandits,
 * then a single curated host line (only if the catalog query returns nothing).
 */
export async function loadInboxPresenceBandits(max = 3): Promise<InboxPresenceBandit[]> {
  const out: InboxPresenceBandit[] = [];
  const seen = new Set<string>();

  const pushBandit = (
    row: {
      id: string;
      name: string;
      face_image_url: string | null;
      image_url: string;
      city: string;
      why_follow: string | null;
      description: string | null;
      occupation: string;
    },
    source: InboxPresenceBandit['source'],
  ) => {
    if (!row?.id || seen.has(row.id)) return;
    seen.add(row.id);
    out.push({
      banditId: row.id,
      displayName: row.name.trim() || 'Local banDit',
      avatarUrl: avatarFromBandit(row),
      vibeLine: vibeFromBandit(row),
      source,
    });
  };

  try {
    const { data: ubRows, error: ubErr } = await supabase.from('user_bandit').select('bandit_id').limit(40);
    if (!ubErr && ubRows?.length) {
      const ids = [...new Set(ubRows.map((r: { bandit_id: string }) => String(r.bandit_id)).filter(Boolean))];
      if (ids.length) {
        const { data: bandRows, error: bErr } = await supabase
          .from('bandit')
          .select('id,name,face_image_url,image_url,city,why_follow,description,occupation')
          .in('id', ids.slice(0, Math.max(max * 2, 8)));
        if (!bErr && bandRows?.length) {
          const entry = await getHotelEntry();
          const slug = entry?.slug ?? '';
          const preferAthens = (r: (typeof bandRows)[0]) =>
            String(r.city || '')
              .toLowerCase()
              .includes(PILOT_CITY.toLowerCase()) ||
            slug.includes('athens') ||
            slug.includes('aluma') ||
            slug.includes('nyx') ||
            slug.includes('play');
          const sorted = [...bandRows].sort((a, b) => {
            const pa = preferAthens(a) ? 1 : 0;
            const pb = preferAthens(b) ? 1 : 0;
            return pb - pa;
          });
          for (const r of sorted) {
            pushBandit(r, 'linked_user');
            if (out.length >= max) return out;
          }
        }
      }
    }
  } catch {
    /* ignore — fall through to catalog */
  }

  if (out.length >= max) return out.slice(0, max);

  try {
    const entry = await getHotelEntry();
    const slug = entry?.slug ?? '';
    const preferAthens =
      slug.includes('athens') || slug.includes('aluma') || slug.includes('nyx') || slug.includes('play');

    const runCatalog = async (athensOnly: boolean) => {
      let q = supabase
        .from('bandit')
        .select('id,name,face_image_url,image_url,city,why_follow,description,occupation')
        .order('rating', { ascending: false })
        .limit(max * 2);
      if (athensOnly) q = q.ilike('city', `%${PILOT_CITY}%`);
      return q;
    };

    let { data: catalog, error: cErr } = await runCatalog(preferAthens);
    if ((!catalog?.length || cErr) && preferAthens) {
      const second = await runCatalog(false);
      catalog = second.data;
      cErr = second.error;
    }
    if (!cErr && catalog?.length) {
      for (const r of catalog) {
        pushBandit(r, 'catalog');
        if (out.length >= max) return out.slice(0, max);
      }
    }
  } catch {
    /* ignore */
  }

  if (out.length > 0) return out.slice(0, max);

  return [
    {
      banditId: 'pilot-curated-host',
      displayName: 'Abe 🌍',
      avatarUrl: '',
      vibeLine: 'Knows rooftop bars + hidden spots nearby.',
      source: 'curated',
    },
  ];
}
