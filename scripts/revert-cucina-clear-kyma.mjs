/**
 * Clear image data for two venues that have no verifiable Google Places match:
 *
 *  - Kyma Seaside Meze Bar (id 52113416-86db-4fca-918b-d62255aed225):
 *    Zero candidates across several Places (New) text searches by name + address.
 *    Likely a stale / AI-generated row at Leof. Poseidonos 10, Alimos.
 *
 *  - Cucina e Pizza Italiana (id 3d2413a2-5bbb-4738-a2cb-b1d4d0dd655f):
 *    The address (Char. Trikoupi 159, Kifisia) is now occupied by "Rarità Athens",
 *    a different brand. My earlier patch incorrectly bound this row to Rarità's
 *    place_id and photos. Per user rule, when no authentic image exists we MUST
 *    show the neutral initials placeholder rather than another business's photos.
 *
 * Both rows are left with empty image_url / image_gallery / google_place_id so
 * the City Guide card uses `buildNeutralBusinessPlaceholderFromSeed` instead.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!value) continue;
    if (String(process.env[key] ?? '').trim() === '') process.env[key] = value;
  }
}

async function clearRow(supabase, id, label) {
  const { error } = await supabase
    .from('event')
    .update({
      google_place_id: null,
      image_url: '',
      image_gallery: null,
    })
    .eq('id', id);
  if (error) {
    console.error(`[${label}] update failed:`, error.message);
    return false;
  }
  console.log(`[${label}] cleared google_place_id / image_url / image_gallery → initials placeholder`);
  return true;
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), '.env'));
  loadEnvFile(path.resolve(process.cwd(), '.env.local'));
  const url = String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!url || !key) {
    console.error('Missing Supabase env vars');
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  await clearRow(supabase, '52113416-86db-4fca-918b-d62255aed225', 'Kyma Seaside Meze Bar');
  await clearRow(supabase, '3d2413a2-5bbb-4738-a2cb-b1d4d0dd655f', 'Cucina e Pizza Italiana');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
