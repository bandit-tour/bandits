/**
 * - Fine Mess Smokehouse: rotate `image_gallery` so the generic-hamburger frame
 *   (current gallery[0]) is no longer the card hero. Promote gallery[1] to position 0;
 *   the old hero stays in the gallery (so the detail page still shows all photos).
 *
 * - Roomepoque: link to confirmed Google Place "Époque Room" (ChIJR2QAi2GjoRQR0uIBaEp8ml8)
 *   at Sporadon 37 — the user-supplied address is an exact match. Pull 8 Places photos
 *   and overwrite the empty `image_url` / `image_gallery`. Keep the row name "Roomepoque"
 *   so the City Guide title stays consistent with how the user refers to it.
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

async function rotateHero(supabase, eventId, label, newHeroIndex) {
  const { data: row, error: selErr } = await supabase
    .from('event')
    .select('image_gallery')
    .eq('id', eventId)
    .single();
  if (selErr) {
    console.error(`[${label}] select failed`, selErr.message);
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
    console.warn(`[${label}] gallery empty`);
    return false;
  }
  const idx = Math.max(0, Math.min(newHeroIndex, gallery.length - 1));
  if (idx === 0) {
    console.log(`[${label}] requested index already at 0, no change`);
    return true;
  }
  const reordered = [gallery[idx], ...gallery.slice(0, idx), ...gallery.slice(idx + 1)];
  const { error: upErr } = await supabase
    .from('event')
    .update({ image_url: reordered[0], image_gallery: JSON.stringify(reordered) })
    .eq('id', eventId);
  if (upErr) {
    console.error(`[${label}] update failed`, upErr.message);
    return false;
  }
  console.log(`[${label}] rotated gallery → new hero is original index ${idx}`);
  return true;
}

async function deleteEventRow(supabase, eventId, label) {
  const { error: linkErr, count: linkCount } = await supabase
    .from('bandit_event')
    .delete({ count: 'exact' })
    .eq('event_id', eventId);
  if (linkErr) console.warn(`[${label}] bandit_event delete error`, linkErr.message);
  else console.log(`[${label}] removed ${linkCount ?? 0} bandit_event link(s)`);
  const { error: likeErr } = await supabase.from('event_user_likes').delete().eq('event_id', eventId);
  if (likeErr && !/relation .* does not exist/i.test(likeErr.message)) {
    console.warn(`[${label}] event_user_likes delete error`, likeErr.message);
  }
  const { error: evErr } = await supabase.from('event').delete().eq('id', eventId);
  if (evErr) {
    console.error(`[${label}] event delete FAILED`, evErr.message);
    return false;
  }
  console.log(`[${label}] DELETED event ${eventId}`);
  return true;
}

async function patchEvent(supabase, eventId, label, placeId, apiKey, opts = {}) {
  const place = await fetchPlace(placeId, apiKey);
  if (!place) {
    console.error(`[${label}] could not fetch place — removing per fallback policy`);
    return deleteEventRow(supabase, eventId, label);
  }
  const photoUrls = photoUrlsFromPlace(apiKey, place, 8);
  if (photoUrls.length === 0) {
    console.error(`[${label}] no photos — removing per fallback policy`);
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

  const FINE_MESS_ID = 'c8fa40c6-a738-444e-b66b-5651cfbbbf51';
  const ROOMEPOQUE_ID = '97970c92-94c8-4fea-a15d-5430b3693d8c';

  await rotateHero(supabase, FINE_MESS_ID, 'Fine Mess Smokehouse', 1);

  await patchEvent(
    supabase,
    ROOMEPOQUE_ID,
    'Roomepoque',
    'ChIJR2QAi2GjoRQR0uIBaEp8ml8',
    apiKey,
    { rename: false, neighborhood: 'Kypseli' },
  );

  console.log('\n[cleanup] done');
}

main().catch((err) => {
  console.error('[cleanup-finemess-roomepoque] failed', err);
  process.exit(1);
});
