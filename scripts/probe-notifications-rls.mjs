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

const anon = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
const svc = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const op = 'e6d8cb02-6f1a-40c0-96c4-b96961878407';

const { data: cfg } = await anon.from('app_public_config').select('value').eq('key', 'operator_user_id').maybeSingle();
console.log('anon read operator config:', cfg);

const { data: rpcData, error: rpcErr } = await anon.rpc('pilot_operator_user_id');
console.log('pilot_operator_user_id rpc:', rpcData, rpcErr?.message ?? '');

const { data: sign, error: signErr } = await anon.auth.signInAnonymously();
if (signErr) {
  console.log('anon signin fail', signErr.message);
  process.exit(0);
}
const uid = sign.user.id;
const rootId = crypto.randomUUID();
const row = {
  id: rootId,
  user_id: op,
  type: 'local_friend',
  title: 'Test',
  message: 'RLS probe',
  reference_id: uid,
  reference_type: 'local_friend_request',
};
const { error: insErr } = await anon.from('notifications').insert(row);
console.log('operator insert as guest:', insErr?.message || 'OK');
if (!insErr) await svc.from('notifications').delete().eq('id', rootId);
