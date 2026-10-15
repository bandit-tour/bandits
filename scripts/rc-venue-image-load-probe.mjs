/**
 * Probe whether named venue heroes resolve (HTTP) — empty URL match is not PASS.
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

function detailHero(row) {
  const g = Array.isArray(row.image_gallery) ? row.image_gallery : [];
  const first = typeof g[0] === 'string' ? g[0] : g[0]?.url || g[0]?.uri || null;
  return first || row.image_url || null;
}

const NAMES = ['Spook', 'Ergon House', 'Kick Cafe', 'Brunchers', 'Tragos', 'Fixers'];
const sb = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const { data, error } = await sb.from('event').select('id,name,image_url,image_gallery').limit(400);
if (error) {
  console.log(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
}

const rows = [];
for (const want of NAMES) {
  const row = (data || []).find((r) => String(r.name).toLowerCase().includes(want.toLowerCase()));
  if (!row) {
    rows.push({ want, status: 'MISSING_ROW' });
    continue;
  }
  const hero = detailHero(row);
  if (!hero) {
    rows.push({ want, name: row.name, id: row.id, status: 'NO_URL' });
    continue;
  }
  let httpStatus = 0;
  let bytes = 0;
  try {
    const res = await fetch(hero, { method: 'GET', redirect: 'follow' });
    httpStatus = res.status;
    const buf = Buffer.from(await res.arrayBuffer());
    bytes = buf.length;
  } catch (e) {
    rows.push({ want, name: row.name, status: 'FETCH_ERROR', error: String(e?.message || e) });
    continue;
  }
  const ok = httpStatus >= 200 && httpStatus < 400 && bytes > 800;
  rows.push({
    want,
    name: row.name,
    id: row.id,
    status: ok ? 'LOAD_OK' : 'LOAD_FAIL',
    httpStatus,
    bytes,
  });
}

const pass = rows.every((r) => r.status === 'LOAD_OK');
const out = { status: pass ? 'PASS' : 'FAIL', rows };
console.log(JSON.stringify(out, null, 2));
fs.mkdirSync('artifacts/runtime-proof/rc-2026-10-15', { recursive: true });
fs.writeFileSync('artifacts/runtime-proof/rc-2026-10-15/venue-image-load-probe.json', JSON.stringify(out, null, 2));
process.exit(pass ? 0 : 1);
