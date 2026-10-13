/**
 * One-off fix for "Geitonia Kypseli 1992". The DB row had no google_place_id, no image_url,
 * and no image_gallery, so the city-guide card and detail page fell back to a generic
 * placeholder image.
 *
 * Places API resolves the address (Kipselis 77, Kypseli) to a single venue:
 *   ChIJ0V2b97eioRQRPqWAMQn4jIQ  (displayName: "Η Γειτονιά")
 *
 * This script:
 *   1. Sets event.google_place_id to that id.
 *   2. Fetches Places New photos and writes event.image_url + event.image_gallery
 *      (same URL format the backfill uses, so the gallery / card / detail share photos).
 *   3. Mirrors the primary photo to bandit_event.recommendation_place_photo_url
 *      for every bandit_event row linked to this event (consistent card hero).
 *
 *   node scripts/patch-geitonia-kypseli-1992.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (v && String(process.env[k] ?? '').trim() === '') process.env[k] = v;
  }
}

function readMapsKeyFromAppJson() {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
    return String(
      j?.expo?.extra?.googleMapsApiKey ??
        j?.expo?.ios?.config?.googleMapsApiKey ??
        j?.expo?.android?.config?.googleMaps?.apiKey ??
        '',
    ).trim();
  } catch {
    return '';
  }
}

loadEnvFile(path.join(ROOT, '.env'));

const SUPABASE_URL = String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const SERVICE_ROLE = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
const MAPS_KEY =
  String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '').trim() || readMapsKeyFromAppJson();

if (!SUPABASE_URL || !SERVICE_ROLE) throw new Error('Missing Supabase env');
if (!MAPS_KEY) throw new Error('Missing Google Maps key (set EXPO_PUBLIC_GOOGLE_MAPS_KEY in .env)');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const PLACE_ID = 'ChIJ0V2b97eioRQRPqWAMQn4jIQ';
const PLACES_NEW_BASE = 'https://places.googleapis.com/v1';
const FIELD_MASK = 'id,displayName,formattedAddress,location,photos';

function encodeSegments(name) {
  return String(name ?? '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
}
function buildPhotoMediaUrl(resourceName) {
  const t = String(resourceName ?? '').trim();
  if (!t) return null;
  return `${PLACES_NEW_BASE}/${encodeSegments(t)}/media?maxWidthPx=1600&maxHeightPx=1200&key=${encodeURIComponent(MAPS_KEY)}`;
}

const placeResp = await fetch(`${PLACES_NEW_BASE}/places/${encodeURIComponent(PLACE_ID)}`, {
  headers: { 'X-Goog-Api-Key': MAPS_KEY, 'X-Goog-FieldMask': FIELD_MASK },
});
if (!placeResp.ok) {
  throw new Error(`Places GET failed ${placeResp.status}: ${await placeResp.text()}`);
}
const place = await placeResp.json();
console.log('place name:', place?.displayName?.text, 'address:', place?.formattedAddress);

const photoResources = Array.isArray(place?.photos)
  ? place.photos.map((p) => String(p?.name ?? '').trim()).filter(Boolean)
  : [];
const photoUrls = photoResources
  .map(buildPhotoMediaUrl)
  .filter((u) => typeof u === 'string' && u.length > 0)
  .slice(0, 8);

if (photoUrls.length === 0) throw new Error('No Places photos returned for this venue');

console.log('photos resolved:', photoUrls.length);

const { data: rows, error: selErr } = await supabase
  .from('event')
  .select('id, name, address')
  .ilike('name', '%Geitonia Kypseli%');
if (selErr) throw selErr;
if (!rows?.length) throw new Error('Event row not found');

for (const ev of rows) {
  console.log('patching event', ev.id, ev.name);
  const { error: uErr } = await supabase
    .from('event')
    .update({
      google_place_id: PLACE_ID,
      image_url: photoUrls[0],
      image_gallery: JSON.stringify(photoUrls),
      location_lat: place?.location?.latitude ?? undefined,
      location_lng: place?.location?.longitude ?? undefined,
      address: place?.formattedAddress ?? ev.address ?? undefined,
    })
    .eq('id', ev.id);
  if (uErr) throw new Error(`event update failed: ${uErr.message}`);

  const { data: links, error: lErr } = await supabase
    .from('bandit_event')
    .select('id')
    .eq('event_id', ev.id);
  if (lErr) console.warn('bandit_event read failed:', lErr.message);
  for (const link of links ?? []) {
    const { error: bErr } = await supabase
      .from('bandit_event')
      .update({ recommendation_place_photo_url: photoUrls[0] })
      .eq('id', link.id);
    if (bErr) console.warn('bandit_event update failed for', link.id, bErr.message);
    else console.log('mirrored hero to bandit_event', link.id);
  }
}

console.log('\nDone. Reload the app — both card and detail page should show the venue photos.');
