/**
 * Re-inspect all 8 batch venues to confirm final state.
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

const IDS = [
  ['Kyma Seaside Meze Bar', '52113416-86db-4fca-918b-d62255aed225'],
  ['ΦΙΤΑ', 'fbd356b7-5fb2-4702-9d5a-e100f03913c0'],
  ['Cucina e Pizza Italiana', '3d2413a2-5bbb-4738-a2cb-b1d4d0dd655f'],
  ['Psarakia Thalassina', 'c0d90e84-a2d5-425f-b2c3-b56d3ce22374'],
  ['Soil Restaurant (A)', 'bf0b6377-462a-4e71-8913-b8ebf45bac91'],
  ['Soil Restaurant (B)', '4fb7df90-8dd5-4d87-be65-39ef86f16c3c'],
  ["Sofi's Eatery", 'd2eecccf-ad9a-4966-8640-88118aec058a'],
  ['The Brunchers', '5aef456b-364a-426d-8d74-fa8bd881a658'],
];

async function main() {
  loadEnvFile(path.resolve(process.cwd(), '.env'));
  loadEnvFile(path.resolve(process.cwd(), '.env.local'));
  const url = String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  for (const [label, id] of IDS) {
    const { data, error } = await supabase
      .from('event')
      .select('id, name, address, google_place_id, image_url, image_gallery')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) {
      console.log(`${label}: NOT FOUND or ERROR ${error?.message ?? ''}`);
      continue;
    }
    let galleryLen = 0;
    let firstHasMedia = false;
    try {
      const parsed = JSON.parse(data.image_gallery ?? '');
      if (Array.isArray(parsed)) {
        galleryLen = parsed.length;
        firstHasMedia = String(parsed[0] ?? '').includes('/media');
      }
    } catch {
      /* not json */
    }
    const urlHost = (() => {
      try {
        return new URL(String(data.image_url ?? '')).hostname;
      } catch {
        return data.image_url ? '(unparseable)' : '(empty)';
      }
    })();
    console.log(
      `${label} (${id})\n  name: ${data.name}\n  addr: ${data.address ?? ''}\n  place_id: ${data.google_place_id ?? '(none)'}\n  image_url host: ${urlHost}\n  gallery: ${galleryLen} items, first hasMedia? ${firstHasMedia}\n`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
