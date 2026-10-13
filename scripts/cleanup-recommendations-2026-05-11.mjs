/**
 * One-off cleanup pass per user request 2026-05-11.
 *
 * Operations (idempotent):
 *   1. DELETE  "Sintagmatarchou Zisimopoulou Street Hidden Boutiques Row"
 *              — AI-generated editorial "street concept" with no real business backing.
 *   2. PATCH   "Chelsea Hotel Café Concept Space"
 *              — rotate `image_gallery` so a different (interior) photo becomes the card hero;
 *                update `image_url` to match new gallery[0]. Same Google Places venue, just a different frame.
 *   3. PATCH   "Retrosexual Mid-century home treasures"
 *              — link to confident Google Place "Modernon Retrosexual Vintage Shop"
 *                (place_id ChIJE9OJMiO9oRQR8YpXRu6LrTc), refresh photos + address from Places.
 *   4. DELETE  "Ellyz Concept Store"
 *              — no confident Google Places match (only "ELLYZ Cafe" at a different address,
 *                different business type). Per user policy: remove until real photos are available.
 *   5. DELETE  "Kypseli Municipal Park"
 *              — Google Places has no POI for Plateia Kypselis (only the street name),
 *                DB coordinates point to Goudi, not Kypseli. Per user policy: remove.
 *
 * Deletes cascade via explicit `bandit_event` delete first (no DB cascade FK in current schema).
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const PLACES_NEW_BASE = 'https://places.googleapis.com/v1';
const PLACES_GET_FIELD_MASK = 'id,displayName,formattedAddress,addressComponents,location,photos';

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

async function placesNewFetchPlace(placeIdBare, apiKey) {
  const id = String(placeIdBare ?? '').trim();
  if (!id) return null;
  const resp = await fetch(`${PLACES_NEW_BASE}/places/${encodeURIComponent(id)}`, {
    headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': PLACES_GET_FIELD_MASK },
  });
  if (!resp.ok) {
    console.warn(`[cleanup] places GET ${id} → HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
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

async function deleteEventRow(supabase, eventId, label) {
  // Step 1: remove all bandit_event links that reference this event.
  const { error: linkErr, count: linkCount } = await supabase
    .from('bandit_event')
    .delete({ count: 'exact' })
    .eq('event_id', eventId);
  if (linkErr) {
    console.warn(`[cleanup] ${label}: bandit_event delete error`, linkErr.message);
  } else {
    console.log(`[cleanup] ${label}: removed ${linkCount ?? 0} bandit_event link(s)`);
  }

  // Step 2: remove any event_user_likes rows so the event row delete isn't blocked by a FK.
  const { error: likeErr, count: likeCount } = await supabase
    .from('event_user_likes')
    .delete({ count: 'exact' })
    .eq('event_id', eventId);
  if (likeErr && !/relation .* does not exist/i.test(likeErr.message)) {
    console.warn(`[cleanup] ${label}: event_user_likes delete error`, likeErr.message);
  } else if (!likeErr) {
    console.log(`[cleanup] ${label}: removed ${likeCount ?? 0} event_user_likes row(s)`);
  }

  // Step 3: delete the event itself.
  const { error: evErr } = await supabase.from('event').delete().eq('id', eventId);
  if (evErr) {
    console.error(`[cleanup] ${label}: event delete FAILED`, evErr.message);
    return false;
  }
  console.log(`[cleanup] ${label}: DELETED event ${eventId}`);
  return true;
}

async function rotateGalleryHero(supabase, eventId, label, newHeroIndex) {
  const { data: row, error: selErr } = await supabase
    .from('event')
    .select('id,name,image_url,image_gallery')
    .eq('id', eventId)
    .single();
  if (selErr) {
    console.error(`[cleanup] ${label}: select failed`, selErr.message);
    return false;
  }

  let gallery = [];
  try {
    gallery = JSON.parse(row.image_gallery ?? '[]');
    if (!Array.isArray(gallery)) gallery = [];
  } catch {
    gallery = [];
  }

  if (gallery.length === 0) {
    console.warn(`[cleanup] ${label}: gallery empty, nothing to rotate`);
    return false;
  }

  const idx = Math.max(0, Math.min(newHeroIndex, gallery.length - 1));
  if (idx === 0) {
    console.log(`[cleanup] ${label}: requested rotation already at index 0, no change`);
    return true;
  }

  const reordered = [gallery[idx], ...gallery.slice(0, idx), ...gallery.slice(idx + 1)];
  const newHero = reordered[0];

  const { error: upErr } = await supabase
    .from('event')
    .update({ image_url: newHero, image_gallery: JSON.stringify(reordered) })
    .eq('id', eventId);
  if (upErr) {
    console.error(`[cleanup] ${label}: update failed`, upErr.message);
    return false;
  }
  console.log(`[cleanup] ${label}: rotated gallery → new hero is index ${idx} of original gallery`);
  return true;
}

async function patchFromPlaces(supabase, eventId, label, placeId, apiKey, opts = {}) {
  const place = await placesNewFetchPlace(placeId, apiKey);
  if (!place) {
    console.error(`[cleanup] ${label}: could not fetch place ${placeId}`);
    return false;
  }
  const photoUrls = photoUrlsFromPlace(apiKey, place, 8);
  if (photoUrls.length === 0) {
    console.error(`[cleanup] ${label}: Places returned no photos for ${placeId}`);
    return false;
  }
  const displayName = String(place?.displayName?.text ?? '').trim() || null;
  const formattedAddress =
    String(place?.formattedAddress ?? '').trim() || null;
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

  // Drop undefined keys so PostgREST doesn't choke on them.
  for (const k of Object.keys(payload)) if (payload[k] === undefined) delete payload[k];

  const { error: upErr } = await supabase.from('event').update(payload).eq('id', eventId);
  if (upErr) {
    console.error(`[cleanup] ${label}: update failed`, upErr.message);
    return false;
  }
  console.log(
    `[cleanup] ${label}: patched event ${eventId} → place_id=${placeId}, ${photoUrls.length} photos${
      opts.rename && displayName ? `, renamed → ${displayName}` : ''
    }`,
  );
  return true;
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), '.env'));
  loadEnvFile(path.resolve(process.cwd(), '.env.local'));

  const supabaseUrl = String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
  const serviceRole = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  const apiKey = String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '').trim();
  if (!supabaseUrl || !serviceRole) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  }
  if (!apiKey) throw new Error('Missing EXPO_PUBLIC_GOOGLE_MAPS_KEY in .env');

  const supabase = createClient(supabaseUrl, serviceRole);

  const SINTAGMATARCHOU_ID = '61f2064c-ae21-4287-ac18-f2214e8f8210';
  const CHELSEA_ID = 'e2591bfb-5226-4d05-b919-9600b6394405';
  const RETROSEXUAL_ID = '64a8a368-f0aa-4756-a821-cb236c581f58';
  const ELLYZ_CONCEPT_ID = '5853e909-a800-4e28-a801-19f758a94cdf';
  const KYPSELI_PARK_ID = 'ace78991-ce23-4c50-9b91-2db2298db654';

  await deleteEventRow(
    supabase,
    SINTAGMATARCHOU_ID,
    'Sintagmatarchou Zisimopoulou Street Hidden Boutiques Row',
  );

  await rotateGalleryHero(supabase, CHELSEA_ID, 'Chelsea Hotel Café Concept Space', 1);

  await patchFromPlaces(
    supabase,
    RETROSEXUAL_ID,
    'Retrosexual Mid-century home treasures',
    'ChIJE9OJMiO9oRQR8YpXRu6LrTc',
    apiKey,
    { rename: true, neighborhood: 'Monastiraki' },
  );

  await deleteEventRow(supabase, ELLYZ_CONCEPT_ID, 'Ellyz Concept Store');

  await deleteEventRow(supabase, KYPSELI_PARK_ID, 'Kypseli Municipal Park');

  console.log('\n[cleanup] done');
}

main().catch((err) => {
  console.error('[cleanup-recommendations-2026-05-11] failed', err);
  process.exit(1);
});
