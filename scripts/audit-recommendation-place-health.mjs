/**
 * Audit Supabase event rows (batch 2 names): google_place_id, Pexels leftovers, image_url prefix.
 *
 * Requires:
 *   SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 *   node scripts/audit-recommendation-place-health.mjs
 *
 * Does not modify data.
 *
 * To confirm migrations 053–056 ran, use Supabase SQL Editor:
 *   scripts/sql/recommendation_image_and_migration_audit.sql
 *
 * If has_google_place_id is false or still_has_pexels is true, run migrations then:
 *   npm run backfill:recommendation-places
 * (needs EXPO_PUBLIC_GOOGLE_MAPS_KEY with Places API (New) enabled.)
 */

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

const BATCH2_NAMES = [
  'aphaia.athens',
  'Aphaia Athens',
  'Fine Mess Smokehouse',
  'September',
  'TromeroPaidi',
  'Tromero Paidi',
  'Avyssinias Square Flea Market',
  'Seychelles Athens',
  'Itsclofie Vintage',
  'Mania Athens',
  'Minu Concept Store Café',
  'Minu Cafe Concept Store',
  'Fabrica Artspace',
];

function printRow(r) {
  const url = String(r.image_url ?? '');
  const gal = String(r.image_gallery ?? '');
  const pexels = url.toLowerCase().includes('pexels') || gal.toLowerCase().includes('pexels');
  const place = String(r.google_place_id ?? '').trim();
  console.log({
    name: r.name,
    id: r.id,
    has_google_place_id: Boolean(place),
    google_place_id_prefix: place ? `${place.slice(0, 20)}…` : null,
    still_has_pexels: pexels,
    image_url_prefix: url.slice(0, 80) || '(empty)',
  });
}

async function main() {
  const root = process.cwd();
  loadEnvFile(path.join(root, '.env'));
  loadEnvFile(path.join(root, '.env.local'));

  const url = String(process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!url || !key) {
    console.error('Missing SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log('\nBatch 2 event audit (case-insensitive name match per seed string):\n');
  const seen = new Set();

  for (const name of BATCH2_NAMES) {
    const { data: rows, error } = await supabase
      .from('event')
      .select('id,name,google_place_id,image_url,image_gallery')
      .ilike('name', name.trim());

    if (error) {
      console.error(`Query failed for "${name}":`, error.message);
      continue;
    }
    if (!rows?.length) {
      console.log({ name_query: name, found: 0 });
      continue;
    }
    for (const r of rows) {
      const k = String(r.id);
      if (seen.has(k)) continue;
      seen.add(k);
      printRow(r);
    }
  }

  console.log(
    '\nFor applied migration list (053–056), run scripts/sql/recommendation_image_and_migration_audit.sql in the SQL Editor.\n',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
