/**
 * Re-resolve expired Places API (New) photo resource names for `event` rows.
 *
 * Why: Stored `places.googleapis.com/v1/.../photos/<resource>/media?...` URLs can become invalid
 * over time — Google returns `{ error: { code: 400, status: "INVALID_ARGUMENT",
 * message: "The photo resource in the request is invalid. Please retrieve it from Places API endpoints." } }`.
 * When that happens the card hero `onError` fires and the UI falls back to a gray "Image pending verification"
 * placeholder. The fix is to re-resolve photo resource names from `places/<id>` GET (Place Details) and
 * overwrite `image_url` + `image_gallery` for any row whose primary photo URL no longer works.
 *
 * Run:
 *   node scripts/refresh-stale-places-photos.mjs                         # validate every linked event, repair stale ones
 *   REFRESH_FORCE=1 node scripts/refresh-stale-places-photos.mjs         # ignore HEAD validation; re-fetch every row that has a google_place_id
 *   REFRESH_LIMIT=20 node scripts/refresh-stale-places-photos.mjs        # only process first 20
 *   REFRESH_NAMES="Booze Cooperativa|Lost" node scripts/...              # only process rows whose name matches one of the pipe-separated patterns (ilike)
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + EXPO_PUBLIC_GOOGLE_MAPS_KEY in `.env`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const PLACES_NEW_BASE = 'https://places.googleapis.com/v1';
const PLACES_GET_FIELD_MASK = 'id,displayName,formattedAddress,photos';

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!value) continue;
    if (String(process.env[key] ?? '').trim() === '') process.env[key] = value;
  }
}

function normalizePlaceId(raw) {
  return String(raw ?? '').trim().replace(/^places\//i, '').trim();
}

function encodeSegments(name) {
  return String(name ?? '')
    .split('/')
    .filter(Boolean)
    .map((s) => encodeURIComponent(s))
    .join('/');
}

function buildMediaUrl(apiKey, resourceName) {
  const enc = encodeSegments(String(resourceName ?? '').trim());
  if (!enc) return null;
  return `${PLACES_NEW_BASE}/${enc}/media?maxWidthPx=1600&maxHeightPx=1200&key=${encodeURIComponent(apiKey)}`;
}

function isStoredPlacesNewMediaUrl(uri) {
  const t = String(uri ?? '').trim().toLowerCase();
  if (!t) return false;
  return t.includes('places.googleapis.com/v1/places/') && t.includes('/photos/') && t.includes('/media');
}

async function validatePhotoUrl(url) {
  try {
    const resp = await fetch(url, { redirect: 'manual' });
    if (resp.status >= 300 && resp.status < 400) return { ok: true, status: resp.status };
    if (resp.status === 200) return { ok: true, status: 200 };
    const body = await resp.text().catch(() => '');
    return { ok: false, status: resp.status, body: body.slice(0, 200) };
  } catch (err) {
    return { ok: false, status: 0, body: String(err?.message ?? err) };
  }
}

async function fetchPlacePhotos(placeId, apiKey) {
  const id = normalizePlaceId(placeId);
  if (!id) return [];
  const url = `${PLACES_NEW_BASE}/places/${encodeURIComponent(id)}`;
  const resp = await fetch(url, {
    headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': PLACES_GET_FIELD_MASK },
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    console.warn(`[refresh] places GET HTTP ${resp.status} for ${id}: ${txt.slice(0, 200)}`);
    return [];
  }
  let json = null;
  try {
    json = await resp.json();
  } catch {
    return [];
  }
  const photos = Array.isArray(json?.photos) ? json.photos : [];
  const urls = [];
  for (const p of photos) {
    if (urls.length >= 8) break;
    const rn = String(p?.name ?? '').trim();
    const media = buildMediaUrl(apiKey, rn);
    if (media && !urls.includes(media)) urls.push(media);
  }
  return urls;
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), '.env'));
  loadEnvFile(path.resolve(process.cwd(), '.env.local'));

  const supabaseUrl = String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
  const serviceRole = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  const mapsKey = String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '').trim();

  if (!supabaseUrl || !serviceRole) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  }
  if (!mapsKey) {
    throw new Error('Missing EXPO_PUBLIC_GOOGLE_MAPS_KEY in .env');
  }

  const supabase = createClient(supabaseUrl, serviceRole);

  const force = String(process.env.REFRESH_FORCE ?? '').trim() === '1';
  const limit = Number.parseInt(String(process.env.REFRESH_LIMIT ?? '0'), 10) || 0;
  const namesFilterRaw = String(process.env.REFRESH_NAMES ?? '').trim();
  const namesFilters = namesFilterRaw
    ? namesFilterRaw.split('|').map((s) => s.trim()).filter(Boolean)
    : [];

  let query = supabase
    .from('event')
    .select('id,name,google_place_id,image_url')
    .not('google_place_id', 'is', null)
    .neq('google_place_id', '');

  if (namesFilters.length === 1) {
    query = query.ilike('name', `%${namesFilters[0]}%`);
  } else if (namesFilters.length > 1) {
    query = query.or(namesFilters.map((n) => `name.ilike.%${n}%`).join(','));
  }

  const { data: rows, error } = await query;
  if (error) throw error;

  const all = Array.isArray(rows) ? rows : [];
  const candidates = all.filter((r) => {
    if (!r?.google_place_id) return false;
    if (force) return true;
    return isStoredPlacesNewMediaUrl(r.image_url) || !r.image_url;
  });

  const slice = limit > 0 ? candidates.slice(0, limit) : candidates;
  console.log(
    JSON.stringify(
      {
        totalRowsWithPlaceId: all.length,
        candidates: candidates.length,
        toProcess: slice.length,
        mode: force ? 'force' : 'validate-then-repair',
        nameFilters: namesFilters,
      },
      null,
      2,
    ),
  );

  const summary = { stale: 0, refreshed: 0, healthy: 0, failed: 0, errors: [] };
  const concurrency = 5;

  async function workOne(row) {
    const currentUrl = String(row.image_url ?? '').trim();
    let needsRefresh = force || !currentUrl;
    if (!needsRefresh && currentUrl) {
      const probe = await validatePhotoUrl(currentUrl);
      needsRefresh = !probe.ok;
      if (probe.ok) {
        summary.healthy += 1;
        return;
      }
    }

    summary.stale += 1;
    const fresh = await fetchPlacePhotos(row.google_place_id, mapsKey);
    if (fresh.length === 0) {
      summary.failed += 1;
      summary.errors.push({ id: row.id, name: row.name, reason: 'no_photos_from_place_details' });
      return;
    }

    const { error: upErr } = await supabase
      .from('event')
      .update({ image_url: fresh[0], image_gallery: JSON.stringify(fresh) })
      .eq('id', row.id);
    if (upErr) {
      summary.failed += 1;
      summary.errors.push({ id: row.id, name: row.name, reason: upErr.message });
      return;
    }
    summary.refreshed += 1;
    console.log(`[refresh] OK ${row.name} (${fresh.length} photos)`);
  }

  const queue = [...slice];
  for (let off = 0; off < queue.length; off += concurrency) {
    const chunk = queue.slice(off, off + concurrency);
    await Promise.all(
      chunk.map(async (r) => {
        try {
          await workOne(r);
        } catch (e) {
          summary.failed += 1;
          summary.errors.push({ id: r.id, name: r.name, reason: String(e?.message ?? e) });
        }
      }),
    );
    await new Promise((res) => setTimeout(res, 150));
  }

  console.log(JSON.stringify({ summary }, null, 2));
}

main().catch((err) => {
  console.error('[refresh-stale-places-photos] failed', err);
  process.exit(1);
});
