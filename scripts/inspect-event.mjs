/**
 * Inspect a single event by name or id (no edits).
 *   node scripts/inspect-event.mjs "Geitonia Kypseli"
 *   node scripts/inspect-event.mjs <uuid>
 */
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

const q = process.argv.slice(2).join(' ');
if (!q) throw new Error('usage: inspect-event.mjs <name-or-id>');

const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);
let { data, error } = isUuid
  ? await supabase.from('event').select('*').eq('id', q)
  : await supabase.from('event').select('*').ilike('name', `%${q}%`);
if (error) throw error;

for (const row of data ?? []) {
  let galleryArr = [];
  if (typeof row.image_gallery === 'string' && row.image_gallery.length) {
    try {
      galleryArr = JSON.parse(row.image_gallery);
    } catch {
      galleryArr = row.image_gallery.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  console.log('—'.repeat(60));
  console.log('id:               ', row.id);
  console.log('name:             ', row.name);
  console.log('address:          ', row.address);
  console.log('neighborhood:     ', row.neighborhood);
  console.log('location:         ', row.location_lat, row.location_lng);
  console.log('google_place_id:  ', row.google_place_id);
  console.log('image_url:        ', typeof row.image_url === 'string' ? row.image_url.slice(0, 140) : null);
  console.log('image_gallery:    ', `${galleryArr.length} entries`);
  for (const [i, g] of galleryArr.slice(0, 6).entries()) {
    console.log(`  [${i}]            `, String(g).slice(0, 140));
  }

  const { data: be } = await supabase
    .from('bandit_event')
    .select('id, bandit_id, recommendation_place_photo_url, personal_tip')
    .eq('event_id', row.id);
  for (const link of be ?? []) {
    console.log('bandit_event:     ', link.id, 'bandit_id=', link.bandit_id);
    console.log('  recommendation_place_photo_url:', typeof link.recommendation_place_photo_url === 'string' ? link.recommendation_place_photo_url.slice(0, 140) : null);
    console.log('  personal_tip:                  ', typeof link.personal_tip === 'string' ? link.personal_tip.slice(0, 120) : null);
  }
}
