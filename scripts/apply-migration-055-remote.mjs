/**
 * Applies the same data changes as supabase/migrations/055_city_guide_batch2_bandit_event_photo_clear_and_name_alias.sql
 * using the service role (no DB password / psql required).
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

const NAMES = [
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

async function main() {
  loadEnvFile(path.join(process.cwd(), '.env'));
  loadEnvFile(path.join(process.cwd(), '.env.local'));
  const url = String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '').trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!url || !key) throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { error: e1 } = await supabase
    .from('event')
    .update({ image_url: '', image_gallery: '[]' })
    .ilike('name', 'Tromero Paidi');
  if (e1) console.warn('[055] Tromero Paidi event clear:', e1.message);
  else console.log('[055] Cleared image columns for name ilike Tromero Paidi');

  const eventIds = new Set();
  for (const name of NAMES) {
    const { data: rows, error } = await supabase.from('event').select('id').ilike('name', name.trim());
    if (error) {
      console.warn(`[055] event lookup "${name}":`, error.message);
      continue;
    }
    for (const r of rows ?? []) eventIds.add(r.id);
  }

  const ids = [...eventIds];
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    const { error: beErr } = await supabase
      .from('bandit_event')
      .update({ recommendation_place_photo_url: null })
      .in('event_id', chunk);
    if (beErr) console.warn('[055] bandit_event clear chunk:', beErr.message);
  }
  console.log('[055] Nulled recommendation_place_photo_url for', ids.length, 'distinct event ids (batch2 names).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
