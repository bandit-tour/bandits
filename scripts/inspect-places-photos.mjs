/**
 * Dump per-photo metadata (resource name, dimensions, author) for one Google Place,
 * so we can choose a sensible hero by hand without rendering.
 *
 * Usage: node scripts/inspect-places-photos.mjs <PLACE_ID>
 */

import fs from 'node:fs';
import path from 'node:path';

const PLACES_NEW_BASE = 'https://places.googleapis.com/v1';
const FIELD_MASK = 'id,displayName,formattedAddress,photos';

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
  const apiKey = String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '').trim();
  if (!apiKey) throw new Error('Missing EXPO_PUBLIC_GOOGLE_MAPS_KEY');
  const placeId = (process.argv[2] || '').trim();
  if (!placeId) {
    console.error('usage: node scripts/inspect-places-photos.mjs <PLACE_ID>');
    process.exit(2);
  }
  const resp = await fetch(`${PLACES_NEW_BASE}/places/${encodeURIComponent(placeId)}`, {
    headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELD_MASK },
  });
  if (!resp.ok) {
    console.error(`HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
    process.exit(1);
  }
  const json = await resp.json();
  console.log(`Place: ${json?.displayName?.text} — ${json?.formattedAddress}`);
  console.log(`Photos: ${(json?.photos || []).length}\n`);
  (json?.photos || []).forEach((p, i) => {
    const ratio = p?.widthPx && p?.heightPx ? (p.widthPx / p.heightPx).toFixed(2) : '?';
    const orient =
      p?.widthPx && p?.heightPx
        ? p.widthPx > p.heightPx
          ? 'landscape'
          : p.widthPx < p.heightPx
            ? 'portrait '
            : 'square   '
        : 'unknown ';
    const author = p?.authorAttributions?.[0]?.displayName || '(unknown)';
    const flagUri = p?.flagContentUri || '';
    console.log(
      `[${i}] ${orient} ${String(p.widthPx).padStart(5)}x${String(p.heightPx).padStart(5)} aspect=${ratio.padStart(4)} author=${author}`,
    );
    if (flagUri) console.log(`     flag=${flagUri.slice(0, 100)}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
