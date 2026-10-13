import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
loadEnvFile(path.join(ROOT, '.env'));
const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const ids = [
  'd2eecccf-ad9a-4966-8640-88118aec058a', // Sofi's Eatery
  'bd62e84b-c783-4de6-aef2-a2db2af2b2c5', // Branch
  'd76dca0e-e768-4766-9d9f-336820c46508', // Joshua Tree Café
];
const { data, error } = await supabase
  .from('event')
  .select('id, name, address, neighborhood, google_place_id, image_url, image_gallery')
  .in('id', ids);
if (error) throw error;
for (const r of data ?? []) {
  console.log({
    id: r.id,
    name: r.name,
    address: r.address,
    neighborhood: r.neighborhood,
    google_place_id: r.google_place_id,
    image_url_prefix: typeof r.image_url === 'string' ? r.image_url.slice(0, 100) : null,
    gallery_count: typeof r.image_gallery === 'string' ? (() => { try { return JSON.parse(r.image_gallery).length; } catch { return r.image_gallery.split(',').length; } })() : 0,
  });
}
