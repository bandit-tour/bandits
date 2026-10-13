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
const base = 'https://bandits-two.vercel.app';

const { data: sign, error: signErr } = await anon.auth.signInAnonymously();
if (signErr) throw signErr;
const token = sign.session.access_token;
const uid = sign.user.id;
const rootId = crypto.randomUUID();

const res = await fetch(`${base}/api/notifications-guest-echo`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    routeOperator: true,
    kind: 'local_friend',
    threadRootId: rootId,
    operatorTitle: 'Probe Traveler',
    operatorMessage: 'API route probe',
    title: 'Local Friend request sent',
    message: 'API route probe',
  }),
});

const j = await res.json();
console.log('API status', res.status, j);

const { data: opRow } = await svc.from('notifications').select('id').eq('id', rootId).maybeSingle();
console.log('operator row exists:', !!opRow);
await svc.from('notifications').delete().eq('id', rootId);
await svc.from('notifications').delete().eq('reference_id', rootId);
