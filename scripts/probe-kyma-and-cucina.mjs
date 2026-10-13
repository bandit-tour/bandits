/** Try different queries for Kyma + Cucina to confirm best match. */

import fs from 'node:fs';
import path from 'node:path';

const PLACES_NEW_BASE = 'https://places.googleapis.com/v1';
const FM =
  'places.id,places.displayName,places.formattedAddress,places.types,places.primaryType,places.businessStatus,places.userRatingCount';

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

async function search(query, apiKey) {
  const resp = await fetch(`${PLACES_NEW_BASE}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FM,
    },
    body: JSON.stringify({ textQuery: query }),
  });
  if (!resp.ok) return { error: `${resp.status}: ${(await resp.text()).slice(0, 200)}`, places: [] };
  const j = await resp.json();
  return { places: Array.isArray(j?.places) ? j.places : [] };
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), '.env'));
  loadEnvFile(path.resolve(process.cwd(), '.env.local'));
  const apiKey = String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '').trim();

  const queries = [
    'Kyma Seaside Meze Bar Alimos',
    'Κύμα Seaside Meze Bar Άλιμος',
    'Kyma restaurant Poseidonos 10 Alimos',
    'Kyma Alimos',
    'Cucina e Pizza Italiana Kifisia',
    'Cucina e Pizza Italiana Athens',
    'Rarità Athens Kifisia',
  ];

  for (const q of queries) {
    const r = await search(q, apiKey);
    if (r.error) {
      console.log(`\n[${q}] error: ${r.error}`);
      continue;
    }
    console.log(`\n[${q}] → ${r.places.length} result(s)`);
    for (let i = 0; i < Math.min(5, r.places.length); i += 1) {
      const c = r.places[i];
      console.log(
        `  [${i}] ${c?.displayName?.text ?? ''} | ${c?.formattedAddress ?? ''} | ${c?.businessStatus ?? ''} | rating ct=${c?.userRatingCount ?? 0}`,
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
