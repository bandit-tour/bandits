import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
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
    if (value === '') continue;
    if (String(process.env[key] ?? '').trim() === '') process.env[key] = value;
  }
}

function normalizeName(raw) {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function placeNameTokens(raw) {
  const stop = new Set(['the', 'and', 'bar', 'cafe', 'restaurant', 'club', 'hotel']);
  return normalizeName(raw)
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !stop.has(t));
}

function isStrongPlaceNameMatch(expectedRaw, candidateRaw) {
  const expected = normalizeName(expectedRaw);
  const candidate = normalizeName(candidateRaw);
  if (!expected || !candidate) return false;
  if (candidate === expected) return true;
  if (candidate.includes(expected) || expected.includes(candidate)) return true;
  const expectedTokens = placeNameTokens(expected);
  const candidateTokens = new Set(placeNameTokens(candidate));
  if (expectedTokens.length === 0) return false;
  let overlap = 0;
  for (const t of expectedTokens) if (candidateTokens.has(t)) overlap += 1;
  if (expectedTokens.length === 1) return overlap === 1;
  return overlap >= 2 || overlap / expectedTokens.length >= 0.6;
}

async function resolvePlaceData(event, apiKey) {
  const expectedName = String(event.name ?? '').trim();
  const query = [event.name, event.address, event.city, event.neighborhood].filter(Boolean).join(' ').trim();
  let placeId = String(event.google_place_id ?? '').trim();

  if (query) {
    const findUrl =
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?key=${encodeURIComponent(apiKey)}` +
      `&input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name,formatted_address`;
    const findResp = await fetch(findUrl);
    const findJson = await findResp.json();
    const candidates = Array.isArray(findJson?.candidates) ? findJson.candidates : [];
    const matched = candidates.find((c) => isStrongPlaceNameMatch(expectedName, String(c?.name ?? '').trim()));
    if (matched?.place_id) placeId = String(matched.place_id).trim();
  }

  if (!placeId) return null;

  const detailsUrl =
    `https://maps.googleapis.com/maps/api/place/details/json?key=${encodeURIComponent(apiKey)}` +
    `&place_id=${encodeURIComponent(placeId)}` +
    `&fields=place_id,name,formatted_address,address_components,geometry/location,photos`;
  const detailsResp = await fetch(detailsUrl);
  const detailsJson = await detailsResp.json();
  const result = detailsJson?.result;
  if (!result) return null;
  if (expectedName && result?.name && !isStrongPlaceNameMatch(expectedName, String(result.name))) return null;

  const photos = Array.isArray(result.photos) ? result.photos : [];
  const photoUrls = [];
  for (const p of photos) {
    if (photoUrls.length >= 8) break;
    const ref = String(p?.photo_reference ?? '').trim();
    if (!ref) continue;
    const url =
      `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photoreference=${encodeURIComponent(ref)}` +
      `&key=${encodeURIComponent(apiKey)}`;
    if (!photoUrls.includes(url)) photoUrls.push(url);
  }

  const cityComp = (Array.isArray(result?.address_components) ? result.address_components : []).find(
    (c) => Array.isArray(c?.types) && c.types.includes('locality'),
  );

  return {
    placeId,
    imageUrl: photoUrls[0] ?? null,
    imageGallery: photoUrls.length > 0 ? JSON.stringify(photoUrls) : null,
    locationLat: typeof result?.geometry?.location?.lat === 'number' ? result.geometry.location.lat : null,
    locationLng: typeof result?.geometry?.location?.lng === 'number' ? result.geometry.location.lng : null,
    formattedAddress: String(result?.formatted_address ?? '').trim() || null,
    city: String(cityComp?.long_name ?? event.city ?? '').trim() || null,
  };
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), '.env'));
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY;
  if (!supabaseUrl || !supabaseAnon || !mapsKey) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY / EXPO_PUBLIC_GOOGLE_MAPS_KEY');
  }
  const supabase = createClient(supabaseUrl, supabaseAnon);

  const targetNames = [
    'Dybbuk Club',
    'Anglais Athens Rooftop Bar',
    'Room Epoque Vintage Boutique',
  ];

  const { data: rows, error } = await supabase
    .from('event')
    .select('id,name,address,city,neighborhood,google_place_id,image_url,image_gallery,location_lat,location_lng')
    .in('name', targetNames);
  if (error) throw error;

  const updates = [];
  for (const event of rows ?? []) {
    const resolved = await resolvePlaceData(event, mapsKey);
    if (!resolved) {
      updates.push({ event: event.name, id: event.id, status: 'no_match' });
      continue;
    }
    const payload = {
      google_place_id: resolved.placeId,
      image_url: resolved.imageUrl,
      image_gallery: resolved.imageGallery,
      location_lat: resolved.locationLat,
      location_lng: resolved.locationLng,
      address: resolved.formattedAddress ?? event.address ?? null,
      city: resolved.city ?? event.city ?? null,
    };
    const { error: upErr } = await supabase.from('event').update(payload).eq('id', event.id);
    if (upErr) {
      updates.push({ event: event.name, id: event.id, status: 'update_failed', error: upErr.message });
    } else {
      updates.push({ event: event.name, id: event.id, status: 'updated', placeId: resolved.placeId, imageUrl: resolved.imageUrl });
    }
  }

  console.log(JSON.stringify({ checked: rows?.length ?? 0, updates }, null, 2));
}

main().catch((err) => {
  console.error('[backfill-recommendation-business-images] failed', err);
  process.exit(1);
});
