/**
 * Set TromeroPaidi event to resolved Google Place + photo URLs (Places New).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

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

const PLACES_NEW_BASE = 'https://places.googleapis.com/v1';
const PLACE_ID = 'ChIJBWilXvi9oRQRjR1_djglBIE';
const EVENT_ID = 'd2d8dee1-69df-4910-b83c-248354bd9fa6';

function encodeSegments(fullResourceName) {
  return String(fullResourceName ?? '')
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function buildPhotoMediaUrl(apiKey, photoResourceName) {
  const name = String(photoResourceName ?? '').trim();
  if (!name) return null;
  const pathEncoded = encodeSegments(name);
  return `${PLACES_NEW_BASE}/${pathEncoded}/media?maxWidthPx=1600&maxHeightPx=1200&key=${encodeURIComponent(apiKey)}`;
}

async function main() {
  loadEnvFile(path.join(process.cwd(), '.env'));
  const apiKey = String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '').trim();
  const url = String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!apiKey || !url || !key) throw new Error('missing env');

  const resp = await fetch(`${PLACES_NEW_BASE}/places/${encodeURIComponent(PLACE_ID)}`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,photos',
    },
  });
  const place = await resp.json();
  if (!resp.ok) throw new Error(JSON.stringify(place));

  const photos = Array.isArray(place?.photos) ? place.photos : [];
  const photoUrls = [];
  for (const p of photos) {
    if (photoUrls.length >= 8) break;
    const resourceName = String(p?.name ?? '').trim();
    const media = buildPhotoMediaUrl(apiKey, resourceName);
    if (media) photoUrls.push(media);
  }
  if (!photoUrls.length) throw new Error('no photos on place');

  const loc = place?.location ?? {};
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await supabase
    .from('event')
    .update({
      google_place_id: PLACE_ID,
      image_url: photoUrls[0],
      image_gallery: JSON.stringify(photoUrls),
      location_lat: typeof loc.latitude === 'number' ? loc.latitude : undefined,
      location_lng: typeof loc.longitude === 'number' ? loc.longitude : undefined,
      address: String(place?.formattedAddress ?? '').trim() || undefined,
    })
    .eq('id', EVENT_ID);
  if (error) throw error;
  console.log('TromeroPaidi updated:', PLACE_ID, 'photos:', photoUrls.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
