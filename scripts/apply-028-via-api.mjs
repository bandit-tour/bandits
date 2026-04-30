/**
 * Applies supabase/migrations/027 + 028 to the linked Supabase project using the
 * Management API (no local Postgres; works when IPv4 to direct DB is blocked).
 *
 * One-time: create a personal access token at account.supabase.com, enable scope
 * that allows database (write), then either:
 *   setx SUPABASE_ACCESS_TOKEN "sbp_..."
 *   or set SUPABASE_ACCESS_TOKEN in .env.local (not committed)
 *
 * Usage: node scripts/apply-028-via-api.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
loadEnv({ path: path.join(root, '.env'), quiet: true });
loadEnv({ path: path.join(root, '.env.local'), override: true, quiet: true });

const url = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
const m = url.match(/https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
const projectRef = m ? m[1] : '';
const token = (process.env.SUPABASE_ACCESS_TOKEN || '').trim();

if (!projectRef) {
  console.error('Set EXPO_PUBLIC_SUPABASE_URL in .env so project ref is known.');
  process.exit(1);
}
if (!token) {
  console.error('Missing SUPABASE_ACCESS_TOKEN. Cannot apply 027/028 via Management API from this environment.');
  process.exit(1);
}

const p027 = path.join(root, 'supabase', 'migrations', '027_notifications_delete_own.sql');
const p028 = path.join(root, 'supabase', 'migrations', '028_pilot_hard_delete_rpc.sql');
const q = `${readFileSync(p027, 'utf8')}\n\n${readFileSync(p028, 'utf8')}`;

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
  console.error('HTTP', res.status, text);
  process.exit(1);
}
try {
  console.log(JSON.stringify(JSON.parse(text), null, 2));
} catch {
  console.log(text);
}
console.log('OK: 027+028 SQL sent to Management API. Wait ~5s, then re-check PostgREST (rpc should exist).');
