/**
 * Non-destructive production DB dependency audit for Guest App RC.
 * Does NOT migrate, drop, or write data.
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
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon) {
  console.log(JSON.stringify({ ok: false, error: 'missing_supabase_env' }, null, 2));
  process.exit(1);
}

const anonClient = createClient(url, anon);
const admin = service ? createClient(url, service, { auth: { persistSession: false } }) : null;

async function probe(client, label, table, columns) {
  const { data, error } = await client.from(table).select(columns).limit(3);
  return {
    label,
    table,
    ok: !error,
    error: error?.message || null,
    sampleCount: (data || []).length,
    names: (data || []).map((r) => r.name).filter(Boolean).slice(0, 3),
  };
}

const results = {
  supabaseUrlHost: (() => {
    try {
      return new URL(url).host;
    } catch {
      return 'invalid';
    }
  })(),
  hasServiceRole: Boolean(service),
  tables: [],
  venueHeroSample: null,
  missingColumns: [],
  migrationsPresentLocally: [],
};

const migDir = path.resolve('supabase/migrations');
if (fs.existsSync(migDir)) {
  results.migrationsPresentLocally = fs
    .readdirSync(migDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .slice(-12);
}

results.tables.push(await probe(anonClient, 'anon', 'event', 'id,name,image_url,image_gallery,google_place_id'));
results.tables.push(await probe(anonClient, 'anon', 'bandit', 'id,name,image_url'));
results.tables.push(await probe(anonClient, 'anon', 'notifications', 'id,type,reference_type'));

if (admin) {
  // Column existence checks without writing
  for (const col of ['approved_hero_url', 'approved_gallery', 'hero_approved_at']) {
    const { error } = await admin.from('event').select(col).limit(1);
    if (error && /column|does not exist/i.test(error.message)) {
      results.missingColumns.push({ table: 'event', column: col, status: 'MISSING_IN_PRODUCTION' });
    } else if (error) {
      results.missingColumns.push({ table: 'event', column: col, status: 'ERROR', error: error.message });
    } else {
      results.missingColumns.push({ table: 'event', column: col, status: 'PRESENT' });
    }
  }

  const patterns = ['%Spook%', '%Ergon%', '%Kick%', '%ASFA%', '%Eutopia%'];
  const { data, error } = await admin
    .from('event')
    .select('id,name,image_url,image_gallery,google_place_id')
    .or(patterns.map((p) => `name.ilike.${p}`).join(','))
    .limit(20);
  results.venueHeroSample = {
    ok: !error,
    error: error?.message || null,
    rows: (data || []).map((e) => {
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
        detailHero: gallery0 || e.image_url || null,
        hasGallery0: Boolean(gallery0),
        hasImageUrl: Boolean(e.image_url),
        google_place_id: e.google_place_id || null,
      };
    }),
  };
}

const outDir = path.resolve('artifacts/runtime-proof/rc-guest-2026-10-13');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'db-dependency-audit.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
