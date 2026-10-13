/**
 * Best-effort: upsert operator_user_id via service role (no DDL).
 * Full fix still requires 059+060 SQL (pilot_operator_user_id + RLS policies).
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const env = Object.fromEntries(
  fs
    .readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const op = 'e6d8cb02-6f1a-40c0-96c4-b96961878407';
const svc = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const anon = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

const { error: upsertErr } = await svc.from('app_public_config').upsert(
  { key: 'operator_user_id', value: op },
  { onConflict: 'key' },
);
console.log('service upsert operator_user_id:', upsertErr?.message ?? 'OK');

const { data: cfg, error: cfgErr } = await anon
  .from('app_public_config')
  .select('value')
  .eq('key', 'operator_user_id')
  .maybeSingle();
console.log('anon read after upsert:', cfg, cfgErr?.message ?? '');
