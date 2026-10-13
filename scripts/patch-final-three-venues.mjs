/**
 * Targeted fix for the three remaining venues flagged in QA:
 *
 *   - "Sofis Eatery"      → Sofi's, Vouliagmeni (Place id resolved via Places searchText)
 *   - "Joshua Tree CafÃ©" → "Joshua Tree Café" (mojibake fix) + Place id for Joshua Tree Athens
 *   - "Branch"            → no reliable Place id; this script clears stock photo only so the
 *                            backfill can keep retrying (curate manually if a real venue exists).
 *
 * Run: node scripts/patch-final-three-venues.mjs
 * Then: npm run db:fix-mojibake && npm run backfill:recommendation-places
 *
 * Auth: SUPABASE_SERVICE_ROLE_KEY + EXPO_PUBLIC_SUPABASE_URL via repo `.env`.
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

const supabase = createClient(
  String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim(),
  String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim(),
  { auth: { persistSession: false } },
);

const PATCHES = [
  {
    matchName: 'Sofis Eatery',
    update: {
      name: "Sofi's Eatery",
      address: 'Agiou Panteleimonos 7, Vouliagmeni',
      neighborhood: 'Vouliagmeni',
      google_place_id: 'ChIJ65zg5vbroRQRI_Ntn4xnh34',
      image_url: null,
      image_gallery: null,
    },
  },
  {
    matchName: 'Joshua Tree',
    update: {
      name: 'Joshua Tree Café',
      address: 'Anapafseos 13, Athens',
      neighborhood: 'Mets',
      google_place_id: 'ChIJxcbQDs29oRQR6GD74wUGtPE',
      image_url: null,
      image_gallery: null,
    },
  },
  {
    matchName: 'Branch',
    update: {
      // No high-confidence Google Place match. Clear stock photo so backfill can keep trying,
      // and rely on `repairDisplayText` for any encoded characters in copy.
      image_url: null,
      image_gallery: null,
    },
  },
];

for (const p of PATCHES) {
  const { data: rows, error } = await supabase
    .from('event')
    .select('id, name')
    .ilike('name', `%${p.matchName}%`);
  if (error) {
    console.error('select failed', p.matchName, error.message);
    continue;
  }
  if (!rows?.length) {
    console.log('no rows for', p.matchName);
    continue;
  }
  for (const row of rows) {
    const { error: uErr } = await supabase.from('event').update(p.update).eq('id', row.id);
    if (uErr) {
      console.error('update failed', row.id, uErr.message);
    } else {
      console.log('patched', row.id, row.name, '→', p.update);
    }
  }
}
