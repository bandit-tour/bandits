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
const sb = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function detailHero(row) {
  const g = Array.isArray(row.image_gallery) ? row.image_gallery : [];
  const first = typeof g[0] === 'string' ? g[0] : g[0]?.url || g[0]?.uri || null;
  return first || row.image_url || null;
}

const { data: cats } = await sb.from('event').select('category').limit(200);
const catSet = [...new Set((cats || []).map((r) => r.category).filter(Boolean))].sort();

const { data: recs, error } = await sb
  .from('event')
  .select('id,name,category,image_url,image_gallery,google_place_id')
  .or('category.ilike.%recommend%,category.ilike.%food%,category.ilike.%cafe%,category.ilike.%bar%')
  .limit(12);

const rows = (recs || []).slice(0, 6).map((row) => {
  const hero = detailHero(row);
  return {
    name: row.name,
    category: row.category,
    hasHero: Boolean(hero),
    placeId: row.google_place_id,
    heroHost: hero ? new URL(hero).host : null,
  };
});

const out = {
  status: rows.length && rows.every((r) => r.hasHero) ? 'PASS' : 'FAIL',
  sampleCategories: catSet.slice(0, 30),
  recommendations: rows,
  error: error?.message || null,
};
console.log(JSON.stringify(out, null, 2));
fs.writeFileSync('artifacts/runtime-proof/rc-2026-10-13/city-guide-heroes.json', JSON.stringify(out, null, 2));
process.exit(out.status === 'PASS' ? 0 : 1);
