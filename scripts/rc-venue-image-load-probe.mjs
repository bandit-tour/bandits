/**
 * Viewport-resolvable venue hero probe (NOT raw DB HTTP 200 alone).
 * Uses the same selection rules as Explore/City Guide:
 * - ephemeral Places /media URLs are NOT permanent approved photos
 * - prefers durable / live-refreshable sources
 * - optionally live-refreshes google_place_id when stored hero is stale
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnv(p) {
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnv(path.resolve('.env'));

function isEphemeralPlaces(uri) {
  const t = String(uri || '').toLowerCase();
  return t.includes('places.googleapis.com/') && t.includes('/photos/');
}

function isGoogleDerived(uri) {
  const t = String(uri || '').toLowerCase();
  return (
    t.includes('maps.googleapis.com/maps/api/place/photo') ||
    (t.includes('places.googleapis.com/') && t.includes('/media')) ||
    t.includes('googleusercontent.com') ||
    t.includes('ggpht.com')
  );
}

function isDurable(uri) {
  const t = String(uri || '');
  if (!/^https?:\/\//i.test(t) || isEphemeralPlaces(t)) return false;
  try {
    const h = new URL(t).hostname.toLowerCase();
    if (h.includes('supabase.co') || h.includes('wikimedia.org') || h.includes('googleusercontent.com') || h.includes('ggpht.com')) {
      return true;
    }
    if (!h.includes('places.googleapis.com') && !h.includes('maps.googleapis.com')) return true;
  } catch {
    return false;
  }
  return false;
}

function galleryFirst(row) {
  const g = Array.isArray(row.image_gallery) ? row.image_gallery : [];
  const first = typeof g[0] === 'string' ? g[0] : g[0]?.url || g[0]?.uri || null;
  return first || null;
}

/** Mirror getSpotDetailHeroUri selection (viewport-resolvable, not raw ephemeral). */
function viewportResolvableHero(row) {
  const candidates = [
    galleryFirst(row),
    row.image_url,
    row.google_photo_url,
    row.recommendation_place_photo_url,
  ].filter(Boolean);
  for (const c of candidates) {
    if (isDurable(c) && !isEphemeralPlaces(c)) return { uri: c, kind: 'durable' };
  }
  for (const c of candidates) {
    if (c && !isEphemeralPlaces(c) && /^https?:\/\//i.test(c)) return { uri: c, kind: 'direct' };
  }
  return { uri: null, kind: 'none', storedRaw: candidates[0] || null };
}

async function fetchLivePlacePhoto(placeId, apiKey) {
  if (!placeId || !apiKey) return null;
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'photos',
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const name = json?.photos?.[0]?.name;
    if (!name) return null;
    return `https://places.googleapis.com/v1/${name}/media?maxHeightPx=800&maxWidthPx=1200&key=${apiKey}`;
  } catch {
    return null;
  }
}

async function probeRendered(uri) {
  if (!uri) return { httpStatus: 0, bytes: 0, ok: false };
  try {
    const res = await fetch(uri, { method: 'GET', redirect: 'follow' });
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = String(res.headers.get('content-type') || '');
    const ok =
      res.status >= 200 &&
      res.status < 400 &&
      buf.length > 800 &&
      (/image\//i.test(ct) || buf[0] === 0xff || buf[0] === 0x89);
    return { httpStatus: res.status, bytes: buf.length, contentType: ct, ok };
  } catch (e) {
    return { httpStatus: 0, bytes: 0, ok: false, error: String(e?.message || e) };
  }
}

const NAMES = [
  'Spook',
  'Ergon House',
  'Kick Cafe',
  'Brunchers',
  'Tragos',
  'Fixers',
  'Avioti',
  'BeQueer',
];

const sb = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
);
const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || process.env.GOOGLE_MAPS_API_KEY || '';

const { data, error } = await sb
  .from('event')
  .select('id,name,image_url,image_gallery,google_place_id')
  .limit(500);
if (error) {
  console.log(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
}

const rows = [];
for (const want of NAMES) {
  const row = (data || []).find((r) => String(r.name).toLowerCase().includes(want.toLowerCase()));
  if (!row) {
    rows.push({ want, status: 'MISSING_ROW', viewportPass: false });
    continue;
  }
  const selected = viewportResolvableHero(row);
  let finalUri = selected.uri;
  let selection = selected.kind;
  let liveRefreshed = false;

  if (!finalUri || isEphemeralPlaces(finalUri) || (isGoogleDerived(finalUri) && isEphemeralPlaces(row.image_url))) {
    const live = await fetchLivePlacePhoto(row.google_place_id, mapsKey);
    if (live) {
      finalUri = live;
      selection = 'live_places_refresh';      liveRefreshed = true;
    }
  }

  const rawProbe = await probeRendered(row.image_url);
  const finalProbe = await probeRendered(finalUri);

  rows.push({
    want,
    name: row.name,
    id: row.id,
    storedImageUrlEphemeral: isEphemeralPlaces(row.image_url),
    storedHttpOk: rawProbe.ok,
    storedHttpStatus: rawProbe.httpStatus,
    selection,
    liveRefreshed,
    finalUri: finalUri ? String(finalUri).replace(/key=[^&]+/i, 'key=REDACTED').slice(0, 160) : null,
    finalHttpOk: finalProbe.ok,
    finalHttpStatus: finalProbe.httpStatus,
    finalBytes: finalProbe.bytes,
    // Viewport PASS requires a non-ephemeral-permanent policy + real image bytes on the selected URI.
    viewportPass: Boolean(finalProbe.ok && finalUri && !isEphemeralPlaces(row.image_url) ? true : finalProbe.ok && liveRefreshed),
    status: finalProbe.ok ? (liveRefreshed || !isEphemeralPlaces(row.image_url) ? 'VIEWPORT_OK' : 'EPHEMERAL_ONLY') : 'VIEWPORT_FAIL',
  });
}

// Do NOT claim overall PASS from HTTP alone when selection is still ephemeral-only.
const viewportOk = rows.filter((r) => r.status === 'VIEWPORT_OK').length;
const out = {
  status: rows.every((r) => r.status === 'VIEWPORT_OK') ? 'VIEWPORT_OK' : 'NEEDS_RUNTIME_RENDER',
  note: 'HTTP probe of viewport-selected URI — not a device PASS. Render proof requires running-app screenshots.',
  viewportOk,
  total: rows.length,
  rows,
};
console.log(JSON.stringify(out, null, 2));
fs.mkdirSync('artifacts/runtime-proof/rc-2026-10-15', { recursive: true });
fs.writeFileSync(
  'artifacts/runtime-proof/rc-2026-10-15/venue-image-load-probe.json',
  JSON.stringify(out, null, 2),
);
process.exit(0);
