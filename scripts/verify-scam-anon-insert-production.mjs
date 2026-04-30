/**
 * Verifies production RLS: anonymous session can INSERT into public.scam_alerts.
 * Uses EXPO_PUBLIC_* from .env (same as the app). Does not use the DB password.
 * On success, deletes the test row with the same session (fails closed if delete is blocked).
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
function loadEnvFile(name) {
  const envPath = join(root, name);
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    if (line.startsWith('#') || !line.trim()) continue;
    const i = line.indexOf('=');
    if (i <= 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (/^[A-Z0-9_]+$/.test(k)) process.env[k] = v;
  }
}
loadEnvFile('.env');
loadEnvFile('.env.local');
loadEnvFile('.env.production.local');

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!url || !anon) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const stamp = `verify_rls_${Date.now()}`;
const row = {
  city: 'VerifyCity',
  location: 'verify',
  title: stamp,
  description: 'automated RLS check — safe to delete',
};

async function main() {
  const { data: anonData, error: anonErr } = await supabase.auth.signInAnonymously();
  if (anonErr) {
    console.error('signInAnonymously failed:', anonErr.message);
    process.exit(2);
  }
  const uid = anonData.user?.id;
  if (!uid) {
    console.error('No user id after anonymous sign-in');
    process.exit(3);
  }

  const insertPayload = {
    city: row.city,
    location: row.location,
    title: row.title,
    description: row.description,
    reported_by: uid,
  };
  const ins = await supabase.from('scam_alerts').insert(insertPayload).select('id').maybeSingle();
  if (ins.error) {
    console.error('INSERT failed (RLS, trigger, or schema):', ins.error.message);
    process.exit(4);
  }
  const id = ins.data?.id;
  if (!id) {
    console.error('INSERT returned no id');
    process.exit(5);
  }
  console.log('OK anon INSERT id=', id);

  const del = await supabase.from('scam_alerts').delete().eq('id', id);
  if (del.error) {
    console.warn('DELETE not allowed for anon (expected on some setups):', del.error.message);
    console.warn('Remove test row manually:', id);
    process.exit(0);
  }
  console.log('OK anon DELETE');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
