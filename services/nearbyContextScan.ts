import { haversineKm, walkMinutesFromKm } from '@/lib/geo';
import {
  appendNearbyNotification,
  getLastNearbyScanAt,
  markNearbyKeySeen,
  setLastNearbyScanAt,
  wasNearbyKeyRecent,
  type NearbyInboxEntry,
} from '@/lib/nearbyAlertsStorage';
import { getPilotCurrentLocation } from '@/lib/currentLocation';
import { getEvents } from '@/app/services/events';
import { supabase } from '@/lib/supabase';

/** ~350 m — small pilot radius */
const RADIUS_KM = 0.35;
/** Don’t scan more often than this */
const MIN_SCAN_GAP_MS = 8 * 60 * 1000;
/** Same logical place: don’t repeat within ~5 days */
const DEDUPE_WINDOW_MS = 5 * 24 * 60 * 60 * 1000;
const MAX_NEW_PER_SCAN = 2;

type SpotRow = {
  id: string;
  name: string | null;
  bandit_id: string | null;
  location_lat: number | null;
  location_lng: number | null;
};

type ScamRow = {
  id: string;
  title: string;
  location: string;
  city: string;
  location_lat: number | null;
  location_lng: number | null;
};

type EventRow = {
  id: string;
  name: string;
  genre: string;
  start_time: string;
  location_lat: number;
  location_lng: number;
  description?: string | null;
};

function firstName(full: string | null | undefined): string {
  const t = String(full ?? '').trim();
  if (!t) return 'A local';
  return t.split(/\s+/)[0] ?? t;
}

function moodPlaceWord(name: string | null | undefined): 'bakery' | 'café' | 'spot' {
  const n = String(name ?? '').toLowerCase();
  if (/bakery|boulanger|φούρνος|fournos/i.test(n)) return 'bakery';
  if (/café|cafe|coffee|καφέ|roastery/i.test(n)) return 'café';
  return 'spot';
}

function eventMentionsJazz(e: EventRow): boolean {
  const blob = `${e.name ?? ''} ${e.description ?? ''}`.toLowerCase();
  return /jazz|τζαζ/i.test(blob);
}

function minutesUntilStart(iso: string): number | null {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - Date.now()) / 60000);
}

function buildCandidates(
  userLat: number,
  userLng: number,
  spots: SpotRow[],
  banditNames: Map<string, string>,
  events: EventRow[],
  scams: ScamRow[],
): { entry: NearbyInboxEntry; dedupeKey: string; weight: number }[] {
  const out: { entry: NearbyInboxEntry; dedupeKey: string; weight: number }[] = [];

  for (const s of scams) {
    if (s.location_lat == null || s.location_lng == null) continue;
    const d = haversineKm(userLat, userLng, s.location_lat, s.location_lng);
    if (d > RADIUS_KM) continue;
    const place = s.location?.trim() || s.city?.trim() || 'this area';
    out.push({
      weight: 100,
      dedupeKey: `scam:${s.id}`,
      entry: {
        id: `nearby-scam-${s.id}`,
        type: 'nearby_scam',
        title: 'Scam alert',
        message: `Scam alert reported near ${place}.`,
        created_at: new Date().toISOString(),
        route: { pathname: '/explore', params: {} },
      },
    });
  }

  for (const e of events) {
    if (e.location_lat == null || e.location_lng == null) continue;
    const d = haversineKm(userLat, userLng, e.location_lat, e.location_lng);
    if (d > RADIUS_KM) continue;
    const mins = minutesUntilStart(e.start_time);
    if (mins != null && mins < -30) continue;
    if (mins != null && mins > 24 * 60) continue;
    const walkM = walkMinutesFromKm(d);
    const when =
      mins == null
        ? 'soon'
        : mins <= 0
          ? 'now'
          : mins < 120
            ? `in ${mins} minutes`
            : 'later today';
    let line: string;
    if (mins != null && mins >= 0 && mins <= 180 && eventMentionsJazz(e)) {
      line = `Live jazz starts in ${mins} minutes nearby.`;
    } else if (mins != null && mins >= 0 && mins <= 180) {
      line = `${e.name} starts ${when} (${walkM} min walk).`;
    } else {
      line = `${e.name} is ${walkM} minutes away — worth a look.`;
    }
    out.push({
      weight: 80 - Math.min(40, mins != null && mins >= 0 ? mins / 3 : 0),
      dedupeKey: `event:${e.id}`,
      entry: {
        id: `nearby-event-${e.id}`,
        type: 'nearby_event',
        title: 'Nearby from the city',
        message: line,
        created_at: new Date().toISOString(),
        route: { pathname: '/event/[id]', params: { id: e.id } },
      },
    });
  }

  let moodFlip = false;
  for (const sp of spots) {
    if (sp.location_lat == null || sp.location_lng == null || !sp.bandit_id) continue;
    const d = haversineKm(userLat, userLng, sp.location_lat, sp.location_lng);
    if (d > RADIUS_KM) continue;
    const walkM = walkMinutesFromKm(d);
    const bName = firstName(banditNames.get(sp.bandit_id) ?? '');
    moodFlip = !moodFlip;
    const isMood = moodFlip;
    const place = sp.name?.trim() || '';
    const message = isMood
      ? `${bName}'s favorite ${moodPlaceWord(sp.name)} is close to you right now${place ? ` — ${place}.` : '.'}`
      : `You're ${walkM} minutes from a hidden spot ${bName} loves${place ? ` — ${place}.` : '.'}`;
    out.push({
      weight: isMood ? 55 : 54,
      dedupeKey: isMood ? `mood:${sp.id}` : `spot:${sp.id}`,
      entry: {
        id: `nearby-${isMood ? 'mood' : 'spot'}-${sp.id}`,
        type: isMood ? 'nearby_mood' : 'nearby_spot',
        title: isMood ? 'Right here right now' : 'Around you',
        message,
        created_at: new Date().toISOString(),
        route: { pathname: '/bandit/[id]', params: { id: sp.bandit_id } },
      },
    });
  }

  return out.sort((a, b) => b.weight - a.weight);
}

/**
 * Runs a single foreground scan; appends up to two new inbox lines when the user is near content.
 * No-op if permission denied, too soon since last scan, or nothing in range.
 */
export async function runNearbyContextScan(): Promise<void> {
  const last = await getLastNearbyScanAt();
  if (last != null && Date.now() - last < MIN_SCAN_GAP_MS) return;

  const pos = await getPilotCurrentLocation();
  if (!pos) return;

  let events: EventRow[] = [];
  try {
    const ev = await getEvents({});
    events = (ev as EventRow[]).filter(
      (e) =>
        e.location_lat != null &&
        e.location_lng != null &&
        Number.isFinite(Number(e.location_lat)) &&
        Number.isFinite(Number(e.location_lng)),
    );
  } catch {
    events = [];
  }

  let spots: SpotRow[] = [];
  try {
    const spotsRes = await supabase
      .from('spots')
      .select('id, name, bandit_id, location_lat, location_lng')
      .not('location_lat', 'is', null)
      .not('location_lng', 'is', null)
      .limit(80);
    if (spotsRes.error) throw spotsRes.error;
    spots = (spotsRes.data as SpotRow[] | null) ?? [];
  } catch {
    spots = [];
  }

  let scams: ScamRow[] = [];
  try {
    const scamsRes = await supabase
      .from('scam_alerts')
      .select('id, title, location, city, location_lat, location_lng')
      .not('location_lat', 'is', null)
      .not('location_lng', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30);
    if (scamsRes.error) throw scamsRes.error;
    scams = (scamsRes.data as ScamRow[] | null) ?? [];
  } catch {
    scams = [];
  }

  const banditIds = [...new Set(spots.map((s) => s.bandit_id).filter(Boolean))] as string[];
  const banditNames = new Map<string, string>();
  if (banditIds.length > 0) {
    const { data: bandits } = await supabase.from('bandit').select('id, name').in('id', banditIds);
    for (const b of bandits ?? []) {
      const row = b as { id: string; name: string };
      if (row?.id) banditNames.set(row.id, row.name ?? '');
    }
  }

  const candidates = buildCandidates(pos.lat, pos.lng, spots, banditNames, events, scams);
  await setLastNearbyScanAt(Date.now());

  let added = 0;
  for (const c of candidates) {
    if (added >= MAX_NEW_PER_SCAN) break;
    if (await wasNearbyKeyRecent(c.dedupeKey, DEDUPE_WINDOW_MS)) continue;
    await appendNearbyNotification(c.entry);
    await markNearbyKeySeen(c.dedupeKey);
    added += 1;
  }
}
