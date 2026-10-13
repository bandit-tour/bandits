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

const NAMES = [
  'Greek Drag Shows (Aggregator)',
  'Greek Drag Shows',
  'Ronit Baranga (Exhibitions)',
  'Kinono',
  'Zurbaran Athens',
  'Sugar Killer',
  'Eutopia Art Residency',
  'ASFA BBQ (Athens School of Fine Arts Festival)',
  'ASFA BBQ (Athens School of Fine Arts)',
];

function printRow(r) {
  const url = String(r.image_url ?? '');
  const gal = String(r.image_gallery ?? '');
  const pexels = url.toLowerCase().includes('pexels') || gal.toLowerCase().includes('pexels');
  const place = String(r.google_place_id ?? '').trim();
  const placesUrl = url.includes('places.googleapis.com') || url.includes('googleusercontent.com');
  console.log({
    name: r.name,
    id: r.id,
    has_google_place_id: Boolean(place),
    still_has_pexels: pexels,
    hero_looks_like_places: placesUrl,
    image_url_prefix: url.slice(0, 80) || '(empty)',
  });
}

async function main() {
  loadEnvFile(path.join(process.cwd(), '.env'));
  const url = String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log('\nBatch 3 / QA name audit\n');
  const seen = new Set();
  for (const name of NAMES) {
    const { data: rows, error } = await supabase.from('event').select('id,name,google_place_id,image_url,image_gallery').ilike('name', name.trim());
    if (error) {
      console.error(name, error.message);
      continue;
    }
    if (!rows?.length) console.log({ name_query: name, found: 0 });
    for (const r of rows ?? []) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      printRow(r);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
