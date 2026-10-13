/**
 * One-shot Google Places (New) Text Search for ad-hoc venue lookups.
 *
 * Usage:
 *   node scripts/places-search-venue.mjs "Retrosexual Mid-century home treasures, Aminta 9, Pangrati"
 *
 * Prints up to the top 5 candidates with display name, formatted address, place id, and photo count
 * so you can manually pick the right one before patching a row.
 *
 * Requires EXPO_PUBLIC_GOOGLE_MAPS_KEY in .env.
 */

import fs from 'node:fs';
import path from 'node:path';

const PLACES_NEW_BASE = 'https://places.googleapis.com/v1';
const SEARCH_FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.photos';

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

async function main() {
  loadEnvFile(path.resolve(process.cwd(), '.env'));
  loadEnvFile(path.resolve(process.cwd(), '.env.local'));

  const apiKey = String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '').trim();
  if (!apiKey) throw new Error('Missing EXPO_PUBLIC_GOOGLE_MAPS_KEY in .env');

  const query = process.argv.slice(2).join(' ').trim();
  if (!query) {
    console.error('usage: node scripts/places-search-venue.mjs "<text query>"');
    process.exit(2);
  }

  const resp = await fetch(`${PLACES_NEW_BASE}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': SEARCH_FIELD_MASK,
    },
    body: JSON.stringify({ textQuery: query, languageCode: 'en', regionCode: 'GR' }),
  });
  const status = resp.status;
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    console.error(`Places HTTP ${status}`, JSON.stringify(json, null, 2));
    process.exit(1);
  }
  const places = Array.isArray(json?.places) ? json.places : [];
  console.log(
    JSON.stringify(
      {
        query,
        resultCount: places.length,
        top: places.slice(0, 5).map((p) => ({
          id: p?.id ?? null,
          name: p?.displayName?.text ?? null,
          address: p?.formattedAddress ?? null,
          location: p?.location ?? null,
          types: p?.types ?? null,
          photoCount: Array.isArray(p?.photos) ? p.photos.length : 0,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error('[places-search-venue] failed', err);
  process.exit(1);
});
