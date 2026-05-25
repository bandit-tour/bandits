/**
 * Apply migration 064 (user_push_tokens) via Supabase Management API.
 *
 * Requires in .env or .env.local (one of):
 *   SUPABASE_ACCESS_TOKEN  (account.supabase.com → Access Tokens) — preferred
 *   SUPABASE_DB_PASSWORD   (falls back to scripts/apply-migration-064-remote.mjs)
 *
 * Usage: node scripts/apply-migration-064-via-api.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { config as loadEnv } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
loadEnv({ path: path.join(root, '.env'), quiet: true });
loadEnv({ path: path.join(root, '.env.local'), override: true, quiet: true });

const url = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
const m = url.match(/https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
const projectRef = m ? m[1] : '';
const token = (process.env.SUPABASE_ACCESS_TOKEN || '').trim();
const dbPass = (process.env.SUPABASE_DB_PASSWORD || '').trim();

const sqlFile = path.join(root, 'supabase', 'migrations', '064_user_push_tokens.sql');
const q = readFileSync(sqlFile, 'utf8');

async function applyViaManagementApi() {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: q, read_only: false }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error('Management API HTTP', res.status, text);
    process.exit(1);
  }
  console.log(text || 'OK');
}

async function verifyTable() {
  const { createClient } = await import('@supabase/supabase-js');
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !serviceKey) {
    console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const svc = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { error } = await svc.from('user_push_tokens').select('id').limit(1);
  if (error) {
    console.error('Verify failed:', error.message);
    process.exit(1);
  }
  console.log('Verified: public.user_push_tokens exists');
}

if (!projectRef) {
  console.error('Set EXPO_PUBLIC_SUPABASE_URL in .env.');
  process.exit(1);
}

if (token) {
  console.error('Applying 064 via Supabase Management API…');
  await applyViaManagementApi();
  await verifyTable();
  process.exit(0);
}

if (dbPass) {
  console.error('Applying 064 via direct Postgres…');
  const r = spawnSync('node', ['scripts/apply-migration-064-remote.mjs'], {
    stdio: 'inherit',
    cwd: root,
    shell: true,
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
  await verifyTable();
  process.exit(0);
}

console.error(
  'Missing SUPABASE_ACCESS_TOKEN or SUPABASE_DB_PASSWORD.\n' +
    'Add one to .env, or paste supabase/migrations/064_user_push_tokens.sql into the Supabase SQL editor.',
);
process.exit(1);
