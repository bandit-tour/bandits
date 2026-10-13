/**
 * Replace remaining Pexels / empty heroes on specific QA `event` rows with Places New photos.
 * Aggregator rows use Sodade2 (queer nightlife Athens) as a visual proxy — not a claim it is the venue.
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

const PATCHES = [
  {
    eventId: '04289458-e518-4050-a0ef-3b8188fe37cd',
    placeId: 'ChIJ1ekX-968oRQRtHfMmKgS0Zo',
    note: 'Greek Drag Shows (Aggregator) → Sodade2 proxy',
  },
  {
    eventId: 'f6d85fa4-1206-4f70-b205-080e66486b34',
    placeId: 'ChIJ1ekX-968oRQRtHfMmKgS0Zo',
    note: 'Greek Drag Shows → Sodade2 proxy',
  },
  {
    eventId: '766e7cae-1c72-4e3b-b5a5-20c6129b4c8c',
    placeId: 'ChIJNzEOwOa8oRQRoQnNa8WSTzw',
    note: 'Ronit Baranga → Benaki Museum Pireos (contemporary wing)',
  },
  {
    eventId: '914996fb-ebe7-432e-8f5d-722b977d9562',
    placeId: 'ChIJWYfPyBq9oRQRK6BK4eSve1k',
    note: 'Kinono KINΩΝΩ Falirou',
  },
];

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
  return `${PLACES_NEW_BASE}/${encodeSegments(name)}/media?maxWidthPx=1600&maxHeightPx=1200&key=${encodeURIComponent(apiKey)}`;
}

async function fetchPlace(apiKey, placeId) {
  const resp = await fetch(`${PLACES_NEW_BASE}/places/${encodeURIComponent(placeId)}`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,photos',
    },
  });
  const j = await resp.json();
  if (!resp.ok) throw new Error(JSON.stringify(j));
  return j;
}

async function main() {
  loadEnvFile(path.join(process.cwd(), '.env'));
  const apiKey = String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '').trim();
  const url = String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  for (const p of PATCHES) {
    const place = await fetchPlace(apiKey, p.placeId);
    const photos = Array.isArray(place?.photos) ? place.photos : [];
    const photoUrls = [];
    for (const ph of photos) {
      if (photoUrls.length >= 8) break;
      const media = buildPhotoMediaUrl(apiKey, String(ph?.name ?? '').trim());
      if (media) photoUrls.push(media);
    }
    if (!photoUrls.length) throw new Error(`no photos for ${p.note}`);
    const loc = place?.location ?? {};
    const { error } = await supabase
      .from('event')
      .update({
        google_place_id: p.placeId,
        image_url: photoUrls[0],
        image_gallery: JSON.stringify(photoUrls),
        location_lat: typeof loc.latitude === 'number' ? loc.latitude : undefined,
        location_lng: typeof loc.longitude === 'number' ? loc.longitude : undefined,
        address: String(place?.formattedAddress ?? '').trim() || undefined,
      })
      .eq('id', p.eventId);
    if (error) throw new Error(`${p.note}: ${error.message}`);
    console.log('OK', p.note, 'photos', photoUrls.length);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
