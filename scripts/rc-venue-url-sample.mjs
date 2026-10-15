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

const NAMES = ['Spook', 'Ergon House', 'Kick Cafe', 'Brunchers', 'Tragos', 'Fixers'];
const sb = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
);
const { data, error } = await sb.from('event').select('id,name,image_url,image_gallery,place_id').limit(400);
if (error) {
  console.error(error);
  process.exit(1);
}
for (const want of NAMES) {
  const row = (data || []).find((r) => String(r.name).toLowerCase().includes(want.toLowerCase()));
  if (!row) {
    console.log(want, 'MISSING');
    continue;
  }
  const g = Array.isArray(row.image_gallery) ? row.image_gallery : [];
  const g0 = typeof g[0] === 'string' ? g[0] : g[0]?.url || g[0]?.uri || null;
  console.log(
    JSON.stringify({
      want,
      name: row.name,
      place_id: row.place_id || null,
      image_url_host: row.image_url ? new URL(row.image_url).host : null,
      image_url_prefix: (row.image_url || '').slice(0, 100),
      gallery0_host: g0 ? new URL(g0).host : null,
      galleryLen: g.length,
    }),
  );
}
