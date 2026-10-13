/**
 * Patch Kafe Kultivo + Solo Gelato Kypseli with real Google Places photos and verified place ids.
 *
 *  - Kafe Kultivo (event b2c04842-…) → ChIJ_85JToCjoRQRrOVEl3ng98g
 *    ("Cultivos Kypseli", Zakinthou 4, Kypseli — only Google Places match for the
 *    "Kultivo"/"Cultivos" name in the Kypseli neighborhood; rename to canonical Google name).
 *  - Solo Gelato Kypseli (event 77e9d7b1-…) → ChIJZULBvuujoRQRvOsnKkNv730
 *    ("SOLO GELATO ΚΥΨΕΛΗ", Ithakis 9 — exact name match, `ice_cream_shop` type).
 *
 * If a place returns no photos (Places API quirk), we fall back to deleting the row per the
 * stated policy "If verified images cannot be retrieved, temporarily remove this recommendation".
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

async function fetchPlace(placeId, apiKey) {
  const resp = await fetch(`${PLACES_NEW_BASE}/places/${encodeURIComponent(placeId)}`, {
    headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': PLACES_GET_FIELD_MASK },
  });
  if (!resp.ok) {
    console.warn(`[patch] places GET ${placeId} HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
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
  const { error: linkErr, count: linkCount } = await supabase
    .from('bandit_event')
    .delete({ count: 'exact' })
    .eq('event_id', eventId);
  if (linkErr) console.warn(`[patch] ${label}: bandit_event delete error`, linkErr.message);
  else console.log(`[patch] ${label}: removed ${linkCount ?? 0} bandit_event link(s)`);

  const { error: likeErr } = await supabase.from('event_user_likes').delete().eq('event_id', eventId);
  if (likeErr && !/relation .* does not exist/i.test(likeErr.message)) {
    console.warn(`[patch] ${label}: event_user_likes delete error`, likeErr.message);
  }

  const { error: evErr } = await supabase.from('event').delete().eq('id', eventId);
  if (evErr) {
    console.error(`[patch] ${label}: event delete FAILED`, evErr.message);
    return false;
  }
  console.log(`[patch] ${label}: DELETED event ${eventId}`);
  return true;
}

async function patchEvent(supabase, eventId, label, placeId, apiKey, opts = {}) {
  const place = await fetchPlace(placeId, apiKey);
  if (!place) {
    console.error(`[patch] ${label}: could not fetch place — removing recommendation per fallback policy`);
    return deleteEventRow(supabase, eventId, label);
  }

  const photoUrls = photoUrlsFromPlace(apiKey, place, 8);
  if (photoUrls.length === 0) {
    console.error(`[patch] ${label}: Places returned no photos — removing recommendation per fallback policy`);
    return deleteEventRow(supabase, eventId, label);
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
    console.error(`[patch] ${label}: update failed`, upErr.message);
    return false;
  }

  console.log(
    `[patch] ${label}: linked to ${placeId}, ${photoUrls.length} photos${
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

  const KAFE_KULTIVO_ID = 'b2c04842-5735-43df-a420-309ec82c076c';
  const SOLO_GELATO_KYPSELI_ID = '77e9d7b1-aaa2-4026-9a35-fdb5528ff86e';

  await patchEvent(
    supabase,
    KAFE_KULTIVO_ID,
    'Kafe Kultivo',
    'ChIJ_85JToCjoRQRrOVEl3ng98g',
    apiKey,
    { rename: true, neighborhood: 'Kypseli' },
  );

  await patchEvent(
    supabase,
    SOLO_GELATO_KYPSELI_ID,
    'Solo Gelato Kypseli',
    'ChIJZULBvuujoRQRvOsnKkNv730',
    apiKey,
    // Keep the user's existing name "Solo Gelato Kypseli" — already matches Google's "SOLO GELATO ΚΥΨΕΛΗ".
    { rename: false, neighborhood: 'Kypseli' },
  );

  console.log('\n[patch] done');
}

main().catch((err) => {
  console.error('[cleanup-kafe-kultivo-solo-gelato] failed', err);
  process.exit(1);
});
