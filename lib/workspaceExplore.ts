/**
 * Workspace -> Guest App Explore bridge (ROUTING-001: the Workspace owns the record).
 *
 * Reads ONLY the Workspace authorized-publication feed (`/api/public/explore`). The feed returns
 * a record only after source verification, editorial approval, licensed imagery, building-level
 * coordinates and an explicit human authorization — and is empty until then, so nothing here can
 * surface draft research.
 *
 * Unknown values stay null (rating / image_url / start_time / end_time) — never invented.
 * This bridge never writes to Supabase.
 */
import { workspaceGet } from '@/lib/workspace/client';
import type { Database } from '@/lib/database.types';

type Event = Database['public']['Tables']['event']['Row'];

export type WorkspaceExploreRecord = {
  id: string;
  workspaceRecordId: string;
  name: string;
  genre: string;
  address: string;
  city: string;
  neighborhood: string;
  description: string;
  location_lat: number;
  location_lng: number;
  link: string | null;
  timing_info: string | null;
  image_url: string | null;
  image_gallery: string[] | null;
  google_place_id: string | null;
  rating: null;
  start_time: null;
  end_time: null;
  verifiedAt: string;
};

type Feed = { ok: boolean; count: number; records: WorkspaceExploreRecord[] };

export function workspaceRecordToEvent(r: WorkspaceExploreRecord): Event {
  return {
    id: `ws:${r.workspaceRecordId}`,
    created_at: r.verifiedAt,
    name: r.name,
    genre: r.genre,
    description: r.description,
    rating: r.rating,
    image_url: r.image_url,
    link: r.link,
    address: r.address,
    city: r.city,
    neighborhood: r.neighborhood,
    start_time: r.start_time,
    end_time: r.end_time,
    location_lat: r.location_lat,
    location_lng: r.location_lng,
    image_gallery: r.image_gallery,
    timing_info: r.timing_info,
    google_place_id: r.google_place_id,
  } as unknown as Event;
}

export async function fetchAuthorizedWorkspaceExplore(
  filters: { genre?: string; city?: string; neighborhood?: string; searchQuery?: string } = {},
): Promise<Event[]> {
  const res = await workspaceGet<Feed>('/api/public/explore');
  if (!res.ok || !res.data?.ok || !Array.isArray(res.data.records)) return [];
  const q = (filters.searchQuery || '').trim().toLowerCase();
  return res.data.records
    .filter((r) => Number.isFinite(r.location_lat) && Number.isFinite(r.location_lng))
    .filter((r) => !filters.genre || r.genre === filters.genre)
    .filter((r) => !filters.city || r.city === filters.city)
    .filter((r) => !filters.neighborhood || r.neighborhood === filters.neighborhood)
    .filter((r) => !q || `${r.name} ${r.description}`.toLowerCase().includes(q))
    .map(workspaceRecordToEvent);
}

/** Merge without duplicates (same Google place id, or same normalized name within ~75 m). */
export function mergeWorkspaceExplore(existing: Event[], incoming: Event[]): Event[] {
  if (incoming.length === 0) return existing;
  const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9α-ω]+/g, ' ').trim();
  const near = (a: Event, b: Event) =>
    Math.abs(a.location_lat - b.location_lat) < 0.0007 && Math.abs(a.location_lng - b.location_lng) < 0.0009;
  const out = [...existing];
  for (const inc of incoming) {
    const dup = existing.some(
      (e) =>
        (inc.google_place_id && e.google_place_id === inc.google_place_id) ||
        (norm(e.name) === norm(inc.name) && near(e, inc)),
    );
    if (!dup) out.push(inc);
  }
  return out;
}
