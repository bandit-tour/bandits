/**
 * Applies migrations 059 + 060 (notifications RLS + pilot_operator_user_id) via Supabase Management API.
 *
 * Requires in .env or .env.local:
 *   EXPO_PUBLIC_SUPABASE_URL
 *   SUPABASE_ACCESS_TOKEN  (account.supabase.com → Access Tokens)
 *
 * Usage: node scripts/apply-notifications-rls-via-api.mjs
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
  console.error('Set EXPO_PUBLIC_SUPABASE_URL in .env.');
  process.exit(1);
}
if (!token) {
  console.error('Missing SUPABASE_ACCESS_TOKEN — apply 059+060 in Supabase SQL editor instead.');
  process.exit(1);
}

const files = [
  '059_operator_user_id_avishay.sql',
  '060_notifications_routed_operator_id_definer.sql',
];
const q = files
  .map((f) => readFileSync(path.join(root, 'supabase', 'migrations', f), 'utf8'))
  .join('\n\n');

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
console.log(text);
console.log('OK: notifications RLS SQL sent. Re-run: node scripts/probe-notifications-rls.mjs');
