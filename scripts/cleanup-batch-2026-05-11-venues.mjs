/**
 * Batch cleanup 2026-05-11 — venue image issues reported by user:
 *
 * A. Backfill venues with NO Places data (cards were falling to category-stock fallback,
 *    which produced the "generic burger" image users kept seeing):
 *     - Kyma Seaside Meze Bar  (Leof. Poseidonos 10, Alimos)
 *     - ΦΙΤΑ                   (Ntourm 1, Neos Kosmos)
 *     - Cucina e Pizza Italiana (Char. Trikoupi 159, Kifisiá)
 *     - Psarakia Thalassina    (Leof. Poseidonos 14, Vari)
 *
 * B. Refresh stale Places photo URLs for rows that already have google_place_id but
 *    were probably returning 400 in expo-image (and so falling back to category stock):
 *     - Soil Restaurant (two duplicate rows, same place_id)
 *     - Sofi's Eatery
 *     - The Brunchers
 *    For Soil specifically, also prefer a landscape-oriented photo as the hero so
 *    the card crop reads well (per user note about "weak" hero).
 *
 * Uses Places API (New): textSearch for resolution, then Place Details for photos.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const PLACES_NEW_BASE = 'https://places.googleapis.com/v1';
const SEARCH_FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.addressComponents,places.location,places.photos,places.types,places.primaryType';
const DETAILS_FIELD_MASK = 'id,displayName,formattedAddress,addressComponents,location,photos,types,primaryType';

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

async function textSearch(query, apiKey) {
  const resp = await fetch(`${PLACES_NEW_BASE}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': SEARCH_FIELD_MASK,
    },
    body: JSON.stringify({ textQuery: query }),
  });
  if (!resp.ok) {
    console.warn(`searchText "${query}" HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
    return [];
  }
  const j = await resp.json();
  return Array.isArray(j?.places) ? j.places : [];
}

async function placeDetails(placeId, apiKey) {
  const resp = await fetch(`${PLACES_NEW_BASE}/places/${encodeURIComponent(placeId)}`, {
    headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': DETAILS_FIELD_MASK },
  });
  if (!resp.ok) {
    console.warn(`places GET ${placeId} HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
    return null;
  }
  return resp.json();
}

function photoUrlsFromPlace(apiKey, place, limit = 8) {
  const photos = Array.isArray(place?.photos) ? place.photos : [];
  const out = [];
  for (const p of photos) {
    if (out.length >= limit) break;
    const url = buildMediaUrl(apiKey, String(p?.name ?? '').trim());
    if (url && !out.includes(url)) out.push(url);
  }
  return out;
}

/** Reorder photos so landscape frames lead. Returns indices in order. */
function landscapeFirstIndices(photos, limit = 8) {
  const indices = Array.from({ length: photos.length }, (_, i) => i);
  const score = (i) => {
    const w = photos[i]?.widthPx ?? 0;
    const h = photos[i]?.heightPx ?? 0;
    if (w === 0 || h === 0) return 1;
    return w >= h ? 0 : 1;
  };
  indices.sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    if (sa !== sb) return sa - sb;
    return a - b;
  });
  return indices.slice(0, limit);
}

function cityFromComponents(place) {
  const comps = Array.isArray(place?.addressComponents) ? place.addressComponents : [];
  const locality = comps.find((c) => Array.isArray(c?.types) && c.types.includes('locality'));
  return String(locality?.longText ?? locality?.long_name ?? '').trim() || null;
}

async function patchFromSearch(supabase, apiKey, label, eventId, query, opts = {}) {
  console.log(`\n[${label}] searching: "${query}"`);
  const candidates = await textSearch(query, apiKey);
  if (candidates.length === 0) {
    console.error(`[${label}] no Places candidates — leaving row unchanged`);
    return false;
  }
  // Print top 3 for transparency
  for (let i = 0; i < Math.min(3, candidates.length); i += 1) {
    const c = candidates[i];
    console.log(
      `  candidate[${i}]: ${c?.displayName?.text ?? '(no name)'} | ${c?.formattedAddress ?? ''} | ${c?.id ?? ''} | photos=${(c?.photos ?? []).length}`,
    );
  }
  const top = candidates[0];
  const placeId = String(top?.id ?? '').trim();
  if (!placeId) {
    console.error(`[${label}] top candidate has no id`);
    return false;
  }
  const photos = Array.isArray(top?.photos) ? top.photos : [];
  if (photos.length === 0) {
    console.warn(`[${label}] top candidate has no photos; trying details`);
    const det = await placeDetails(placeId, apiKey);
    if (!det || !Array.isArray(det?.photos) || det.photos.length === 0) {
      console.error(`[${label}] still no photos — leaving row's image_url empty for now`);
      return false;
    }
    return doPatch(supabase, apiKey, label, eventId, placeId, det, opts);
  }
  return doPatch(supabase, apiKey, label, eventId, placeId, top, opts);
}

async function doPatch(supabase, apiKey, label, eventId, placeId, place, opts) {
  const photos = Array.isArray(place?.photos) ? place.photos : [];
  // Prefer landscape frames first for nicer card crops; otherwise keep Places order.
  const order = landscapeFirstIndices(photos, 8);
  const urls = order
    .map((i) => buildMediaUrl(apiKey, String(photos[i]?.name ?? '').trim()))
    .filter((u) => Boolean(u));
  if (urls.length === 0) {
    console.error(`[${label}] could not build any photo URLs`);
    return false;
  }
  const displayName = String(place?.displayName?.text ?? '').trim() || null;
  const formattedAddress = String(place?.formattedAddress ?? '').trim() || null;
  const lat = typeof place?.location?.latitude === 'number' ? place.location.latitude : null;
  const lng = typeof place?.location?.longitude === 'number' ? place.location.longitude : null;
  const city = cityFromComponents(place);

  const payload = {
    google_place_id: placeId,
    image_url: urls[0],
    image_gallery: JSON.stringify(urls),
    location_lat: lat,
    location_lng: lng,
    address: formattedAddress ?? undefined,
    city: city ?? undefined,
  };
  if (opts.rename && displayName) payload.name = displayName;
  if (opts.neighborhood) payload.neighborhood = opts.neighborhood;
  for (const k of Object.keys(payload)) if (payload[k] === undefined) delete payload[k];

  const { error: upErr } = await supabase.from('event').update(payload).eq('id', eventId);
  if (upErr) {
    console.error(`[${label}] update failed`, upErr.message);
    return false;
  }
  console.log(
    `[${label}] linked place_id=${placeId}, ${urls.length} photos (landscape-first); ${opts.rename && displayName ? `renamed → ${displayName}; ` : ''}address → ${formattedAddress ?? '(unchanged)'}`,
  );
  return true;
}

/** Refresh photos for a row that already has a google_place_id. */
async function refreshExistingPlace(supabase, apiKey, label, eventId, placeId, opts = {}) {
  console.log(`\n[${label}] refresh place_id=${placeId}`);
  const det = await placeDetails(placeId, apiKey);
  if (!det) {
    console.error(`[${label}] details failed`);
    return false;
  }
  const photos = Array.isArray(det?.photos) ? det.photos : [];
  if (photos.length === 0) {
    console.error(`[${label}] details has no photos`);
    return false;
  }
  return doPatch(supabase, apiKey, label, eventId, placeId, det, opts);
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), '.env'));
  loadEnvFile(path.resolve(process.cwd(), '.env.local'));

  const supabaseUrl = String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
  const serviceRole = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  const apiKey = String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '').trim();
  if (!supabaseUrl || !serviceRole || !apiKey) {
    console.error('Missing env: EXPO_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / EXPO_PUBLIC_GOOGLE_MAPS_KEY');
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

  // ── Part A: backfill 4 rows that have no Places data at all ───────────────────
  await patchFromSearch(
    supabase,
    apiKey,
    'Kyma Seaside Meze Bar',
    '52113416-86db-4fca-918b-d62255aed225',
    'Kyma Seaside Meze Bar Leoforos Poseidonos 10 Alimos Athens',
    { neighborhood: 'Alimos' },
  );

  await patchFromSearch(
    supabase,
    apiKey,
    'ΦΙΤΑ (Fita)',
    'fbd356b7-5fb2-4702-9d5a-e100f03913c0',
    'ΦΙΤΑ εστιατόριο Νέος Κόσμος Αθήνα',
    { neighborhood: 'Neos Kosmos' },
  );

  await patchFromSearch(
    supabase,
    apiKey,
    'Cucina e Pizza Italiana',
    '3d2413a2-5bbb-4738-a2cb-b1d4d0dd655f',
    'Cucina e Pizza Italiana Charilaou Trikoupi 159 Kifisia Athens',
    { neighborhood: 'Kifisia' },
  );

  await patchFromSearch(
    supabase,
    apiKey,
    'Psarakia Thalassina',
    'c0d90e84-a2d5-425f-b2c3-b56d3ce22374',
    'Psarakia Thalassina Leoforos Poseidonos 14 Vari Athens',
    { neighborhood: 'Vari' },
  );

  // ── Part B: refresh stale Places URLs for rows that already have place_id ─────
  await refreshExistingPlace(
    supabase,
    apiKey,
    'Soil Restaurant (dup A)',
    'bf0b6377-462a-4e71-8913-b8ebf45bac91',
    'ChIJr9_aRfm9oRQRWj0x3vCftJE',
  );

  await refreshExistingPlace(
    supabase,
    apiKey,
    'Soil Restaurant (dup B)',
    '4fb7df90-8dd5-4d87-be65-39ef86f16c3c',
    'ChIJr9_aRfm9oRQRWj0x3vCftJE',
  );

  await refreshExistingPlace(
    supabase,
    apiKey,
    "Sofi's Eatery",
    'd2eecccf-ad9a-4966-8640-88118aec058a',
    'ChIJ65zg5vbroRQRI_Ntn4xnh34',
  );

  await refreshExistingPlace(
    supabase,
    apiKey,
    'The Brunchers',
    '5aef456b-364a-426d-8d74-fa8bd881a658',
    'ChIJi6DPjVO9oRQRirqGAIiWfuA',
  );

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
