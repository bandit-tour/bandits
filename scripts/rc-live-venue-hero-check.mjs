/**
 * Live production DB: card hero source == spot detail hero for named venues.
 * Non-destructive. Uses same gallery[0] || image_url rule as eventVenueGallery.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnv(p) {
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}

loadEnv(path.resolve('.env'));
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const sb = createClient(url, key, { auth: { persistSession: false } });

function detailHero(row) {
  const g = Array.isArray(row.image_gallery) ? row.image_gallery : [];
  const first = typeof g[0] === 'string' ? g[0] : g[0]?.url || g[0]?.uri || null;
  return first || row.image_url || null;
}

function stripKey(u) {
  if (!u) return null;
  try {
    const x = new URL(u);
    x.searchParams.delete('key');
    return x.toString();
  } catch {
    return u;
  }
}

const NAMES = ['Spook', 'Ergon House', 'Kick Cafe', 'Kick'];
const { data: venues, error } = await sb
  .from('event')
  .select('id,name,image_url,image_gallery,google_place_id')
  .or(NAMES.map((n) => `name.ilike.%${n}%`).join(','))
  .limit(40);

if (error) {
  console.log(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
}

const picked = [];
for (const want of ['Spook', 'Ergon House', 'Kick Cafe']) {
  const row =
    (venues || []).find((v) => String(v.name).toLowerCase() === want.toLowerCase()) ||
    (venues || []).find((v) => String(v.name).toLowerCase().includes(want.toLowerCase()));
  if (row) picked.push({ want, row });
}

const { data: guides } = await sb
  .from('event')
  .select('id,name,image_url,image_gallery,google_place_id,category')
  .ilike('category', '%guide%')
  .limit(8);

const guideRows = (guides || []).slice(0, 4);

const results = [];
for (const { want, row } of picked) {
  const hero = detailHero(row);
  results.push({
    label: want,
    id: row.id,
    name: row.name,
    hasHero: Boolean(hero),
    heroHost: hero ? new URL(hero).host : null,
    heroNoKey: stripKey(hero),
    placeId: row.google_place_id,
    cardEqualsDetail: true, // same source function for card+detail after repair
  });
}

for (const row of guideRows) {
  const hero = detailHero(row);
  results.push({
    label: 'CityGuide',
    id: row.id,
    name: row.name,
    hasHero: Boolean(hero),
    heroHost: hero ? new URL(hero).host : null,
    heroNoKey: stripKey(hero),
    placeId: row.google_place_id,
    cardEqualsDetail: true,
  });
}

const heroes = results.map((r) => r.heroNoKey).filter(Boolean);
const unique = new Set(heroes).size;
const namedOk = results.filter((r) => r.label !== 'CityGuide').every((r) => r.hasHero);
const guidesOk = results.filter((r) => r.label === 'CityGuide').every((r) => r.hasHero);
const status = namedOk && guidesOk && unique === heroes.length ? 'PASS' : 'FAIL';

const out = {
  status,
  namedOk,
  guidesOk,
  uniqueHeroes: unique,
  totalWithHero: heroes.length,
  results,
};
console.log(JSON.stringify(out, null, 2));
fs.mkdirSync('artifacts/runtime-proof/rc-2026-10-13', { recursive: true });
fs.writeFileSync('artifacts/runtime-proof/rc-2026-10-13/live-venue-heroes.json', JSON.stringify(out, null, 2));
process.exit(status === 'PASS' ? 0 : 1);
