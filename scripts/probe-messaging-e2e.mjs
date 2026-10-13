/**
 * End-to-end Ask Me + Local Friend via production messaging API (service-role route).
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

const base = 'https://bandits-two.vercel.app';
const anon = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
const svc = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const op = 'e6d8cb02-6f1a-40c0-96c4-b96961878407';

async function probe(kind, body) {
  const { data: sign, error: signErr } = await anon.auth.signInAnonymously();
  if (signErr) throw signErr;
  const token = sign.session.access_token;
  const uid = sign.user.id;

  const res = await fetch(`${base}/api/operator-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  console.log(`\n[${kind}] API`, res.status, j);

  const rootId = body.threadRootId;
  const { data: opRow } = await svc
    .from('notifications')
    .select('id, user_id, type, reference_type')
    .eq('id', rootId)
    .maybeSingle();
  console.log(`[${kind}] operator inbox row:`, opRow);

  const { data: guestRows } = await svc
    .from('notifications')
    .select('id, user_id, type, reference_type')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(3);
  console.log(`[${kind}] recent guest rows for ${uid}:`, guestRows);

  if (opRow) await svc.from('notifications').delete().eq('id', rootId);
  if (guestRows?.length) {
    for (const g of guestRows) {
      if (g.reference_type?.includes('guest_echo') || g.id === rootId) {
        await svc.from('notifications').delete().eq('id', g.id);
      }
    }
  }

  return res.ok && opRow?.user_id === op;
}

const banditId = await (async () => {
  const { data } = await svc.from('bandit').select('id').limit(1).maybeSingle();
  if (!data?.id) throw new Error('No bandit row for ask_me probe');
  return data.id;
})();
const lfRoot = crypto.randomUUID();
const askRoot = crypto.randomUUID();

const lfOk = await probe('local_friend', {
  kind: 'local_friend',
  threadRootId: lfRoot,
  title: 'Probe Traveler',
  message: 'Local Friend e2e probe',
  guestTitle: 'Local Friend request sent',
});

const askOk = await probe('ask_me', {
  kind: 'ask_me',
  threadRootId: askRoot,
  askTargetBanditId: banditId,
  title: 'Probe Traveler',
  message: 'Ask Me e2e probe',
  operatorMessage: 'Ask Me probe question',
  guestTitle: 'Ask Me · Probe banDit',
});

console.log('\nSummary:', { local_friend: lfOk ? 'PASS' : 'FAIL', ask_me: askOk ? 'PASS' : 'FAIL' });
process.exit(lfOk && askOk ? 0 : 1);
