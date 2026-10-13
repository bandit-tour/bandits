/**
 * For duplicate `event` rows with the same display name: copy google_place_id + Places images
 * from any sibling row that already resolved, onto orphans (missing place id / empty hero).
 *
 * Also targets TromeroPaidi by name when address/context failed Places text search.
 *
 *   node scripts/fix-orphan-duplicate-event-places.mjs
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

const TARGET_NAMES = ['Itsclofie Vintage', 'Mania Athens', 'TromeroPaidi'];

async function main() {
  loadEnvFile(path.join(process.cwd(), '.env'));
  const url = String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!url || !key) throw new Error('Missing env');
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  for (const name of TARGET_NAMES) {
    const { data: rows, error } = await supabase
      .from('event')
      .select('id,name,google_place_id,image_url,image_gallery')
      .eq('name', name);
    if (error) {
      console.warn(name, error.message);
      continue;
    }
    const list = rows ?? [];
    const donor = list.find((r) => String(r.google_place_id ?? '').trim() && String(r.image_url ?? '').trim());
    if (!donor) {
      console.log(name, 'no donor row with place+image; skip');
      continue;
    }
    const orphans = list.filter(
      (r) =>
        !String(r.google_place_id ?? '').trim() ||
        !String(r.image_url ?? '').trim(),
    );
    for (const o of orphans) {
      if (o.id === donor.id) continue;
      const { error: up } = await supabase
        .from('event')
        .update({
          google_place_id: donor.google_place_id,
          image_url: donor.image_url,
          image_gallery: donor.image_gallery,
        })
        .eq('id', o.id);
      if (up) console.warn('update', o.id, up.message);
      else console.log('synced orphan', name, o.id, '←', donor.id);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
