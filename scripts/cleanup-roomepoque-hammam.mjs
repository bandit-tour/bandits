/**
 * Roomepoque: rotate the gallery so a landscape (near-1:1) photo becomes the card hero.
 *   The current hero (Place photo[0]) is portrait 3024x4032 — center-cropped on the card
 *   it reads as "wall of clothes / department-store interior". Picking a landscape frame
 *   (Place photo[4], 1125x1102) gives a much more storefront-like crop.
 *
 * Hammam Baths Boutique Spa: link to the verified Google Place
 *   "Hammam Baths Athens | Spa, Massage, Wellness" (ChIJO1cIbiG9oRQR6uIXMeY2T2E,
 *   Melidoni 1, Athina 105 53 — same address as the user supplied; types: spa, massage_spa,
 *   wellness_center). Pull 8 real Places photos. Replace the empty image fields so the
 *   category fallback (which had the misleading "rooftop"-style stock photo) stops being used.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const PLACES_NEW_BASE = 'https://places.googleapis.com/v1';
const FIELD_MASK = 'id,displayName,formattedAddress,addressComponents,location,photos';

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

async function fetchPlace(placeId, apiKey) {
  const resp = await fetch(`${PLACES_NEW_BASE}/places/${encodeURIComponent(placeId)}`, {
    headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELD_MASK },
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

function cityFromComponents(place) {
  const comps = Array.isArray(place?.addressComponents) ? place.addressComponents : [];
  const locality = comps.find((c) => Array.isArray(c?.types) && c.types.includes('locality'));
  return String(locality?.longText ?? locality?.long_name ?? '').trim() || null;
}

/** Rebuild gallery from place photos but with a preferred lead photo. Detects landscape automatically. */
async function rebuildGalleryWithPreferredHero(supabase, eventId, label, placeId, apiKey, preferredIndex) {
  const place = await fetchPlace(placeId, apiKey);
  if (!place) {
    console.error(`[${label}] could not fetch place`);
    return false;
  }
  const photos = Array.isArray(place?.photos) ? place.photos : [];
  if (photos.length === 0) {
    console.error(`[${label}] place has no photos`);
    return false;
  }

  // Build a reorder vector: put the preferred index first, then the remaining photos
  // sorted so landscapes come before portraits (better crops for the card).
  const limit = Math.min(8, photos.length);
  const indices = Array.from({ length: photos.length }, (_, i) => i);
  const idx = Math.max(0, Math.min(preferredIndex, photos.length - 1));
  const rest = indices.filter((i) => i !== idx);
  rest.sort((a, b) => {
    const aLand = (photos[a]?.widthPx ?? 0) >= (photos[a]?.heightPx ?? 0) ? 0 : 1;
    const bLand = (photos[b]?.widthPx ?? 0) >= (photos[b]?.heightPx ?? 0) ? 0 : 1;
    if (aLand !== bLand) return aLand - bLand;
    return a - b;
  });
  const order = [idx, ...rest].slice(0, limit);
  const urls = order
    .map((i) => buildMediaUrl(apiKey, String(photos[i]?.name ?? '').trim()))
    .filter((u) => Boolean(u));
  if (urls.length === 0) {
    console.error(`[${label}] no valid photo URLs`);
    return false;
  }
  const { error: upErr } = await supabase
    .from('event')
    .update({ image_url: urls[0], image_gallery: JSON.stringify(urls) })
    .eq('id', eventId);
  if (upErr) {
    console.error(`[${label}] update failed`, upErr.message);
    return false;
  }
  console.log(
    `[${label}] rebuilt gallery → hero is place photo[${idx}], ${urls.length} photos total`,
  );
  return true;
}

async function patchEvent(supabase, eventId, label, placeId, apiKey, opts = {}) {
  const place = await fetchPlace(placeId, apiKey);
  if (!place) {
    console.error(`[${label}] could not fetch place`);
    return false;
  }
  const photoUrls = photoUrlsFromPlace(apiKey, place, 8);
  if (photoUrls.length === 0) {
    console.error(`[${label}] no photos`);
    return false;
  }
  const displayName = String(place?.displayName?.text ?? '').trim() || null;
  const formattedAddress = String(place?.formattedAddress ?? '').trim() || null;
  const lat = typeof place?.location?.latitude === 'number' ? place.location.latitude : null;
  const lng = typeof place?.location?.longitude === 'number' ? place.location.longitude : null;
  const city = cityFromComponents(place);

  const payload = {
    google_place_id: placeId,
    image_url: photoUrls[0],
    image_gallery: JSON.stringify(photoUrls),
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
    `[${label}] linked to ${placeId}, ${photoUrls.length} photos${
      opts.rename && displayName ? `, renamed → ${displayName}` : ''
    }, address → ${formattedAddress ?? '(unchanged)'}`,
  );
  return true;
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), '.env'));
  loadEnvFile(path.resolve(process.cwd(), '.env.local'));

  const supabaseUrl = String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
  const serviceRole = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  const apiKey = String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '').trim();
  if (!supabaseUrl || !serviceRole) throw new Error('Missing supabase env');
  if (!apiKey) throw new Error('Missing google maps key');
  const supabase = createClient(supabaseUrl, serviceRole);

  const ROOMEPOQUE_ID = '97970c92-94c8-4fea-a15d-5430b3693d8c';
  const HAMMAM_ID = 'bb4842c6-f129-4d0d-9ea8-f462e655092c';

  // Roomepoque place photos:
  //   [0]–[2]   portrait (3024x4032 / 1125x1128 / 1440x1800)
  //   [3]–[4]   landscape (1125x1103, 1125x1102)
  //   [5]       portrait
  //   [6]       landscape (1125x1118)
  //   [7]       portrait
  //   [8]       landscape (1125x1097)
  //   [9]       portrait
  // Pick [4] (landscape, owner-uploaded, fresh angle) as the new hero. Auto-sorts the rest
  // landscape-first so subsequent gallery frames also crop cleanly.
  await rebuildGalleryWithPreferredHero(
    supabase,
    ROOMEPOQUE_ID,
    'Roomepoque',
    'ChIJR2QAi2GjoRQR0uIBaEp8ml8',
    apiKey,
    4,
  );

  await patchEvent(
    supabase,
    HAMMAM_ID,
    'Hammam Baths Boutique Spa',
    'ChIJO1cIbiG9oRQR6uIXMeY2T2E',
    apiKey,
    // Keep the user's recommendation title "Hammam Baths Boutique Spa".
    { rename: false, neighborhood: 'Psyrri' },
  );

  console.log('\n[cleanup] done');
}

main().catch((err) => {
  console.error('[cleanup-roomepoque-hammam] failed', err);
  process.exit(1);
});
