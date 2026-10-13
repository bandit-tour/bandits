import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let value = t.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv(path.resolve(process.cwd(), '.env'));
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Missing Supabase env');
  process.exit(1);
}

const sb = createClient(url, key);
const patterns = ['%Spook%', '%Ergon%', '%Kick%', '%ASFA%', '%Eutopia%', '%Cafe%', '%House%'];

let { data, error } = await sb
  .from('event')
  .select('id,name,image_url,image_gallery,google_place_id')
  .or(patterns.map((p) => `name.ilike.${p}`).join(','));

if (error || !(data && data.length)) {
  const fallback = await sb.from('event').select('id,name,image_url,image_gallery,google_place_id').limit(20);
  error = fallback.error;
  data = fallback.data;
}

if (error) {
  console.error(error.message);
  process.exit(1);
}

const rows = (data || []).map((e) => {
  let gallery0 = null;
  try {
    const g = e.image_gallery ? JSON.parse(e.image_gallery) : [];
    gallery0 = Array.isArray(g) && typeof g[0] === 'string' ? g[0] : null;
  } catch {
    gallery0 = null;
  }
  return {
    name: e.name,
    id: e.id,
    image_url: e.image_url || null,
    gallery0,
    google_place_id: e.google_place_id || null,
    detailHeroWouldBe: gallery0 || e.image_url || null,
  };
});

console.log(JSON.stringify({ count: rows.length, rows }, null, 2));
