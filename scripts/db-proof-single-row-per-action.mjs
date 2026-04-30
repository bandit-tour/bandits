import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

for (const name of ['.env', '.env.local', '.env.production.local']) {
  const p = path.join(root, name);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i <= 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
    if (/^[A-Z0-9_]+$/.test(k) && !process.env[k]) process.env[k] = v;
  }
}

const base = process.env.RUNTIME_BASE_URL || 'https://bandits-two.vercel.app';
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const operatorEmail = process.env.PLAY_OPERATOR_EMAIL || process.env.E2E_ADMIN_EMAIL || 'blonje@gmail.com';
const operatorPassword = process.env.PLAY_OPERATOR_PASSWORD || process.env.E2E_ADMIN_PASSWORD || '121275';

if (!supabaseUrl || !anonKey) {
  console.error(JSON.stringify({ ok: false, error: 'Missing SUPABASE URL or ANON KEY' }, null, 2));
  process.exit(1);
}

const admin = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const askSeed = `PROOF_ASK_${Date.now()}`;
const localSeed = `PROOF_LOCAL_${Date.now() + 1}`;
const operatorUserId = process.env.EXPO_PUBLIC_OPERATOR_USER_ID || 'e6d8cb02-6f1a-40c0-96c4-b96961878407';

async function waitForCountAtLeast(queryFn, min, timeoutMs = 90000) {
  const end = Date.now() + timeoutMs;
  let last = [];
  while (Date.now() < end) {
    const rows = await queryFn();
    last = rows;
    if (rows.length >= min) return rows;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return last;
}

async function signInOperator() {
  const { data, error } = await admin.auth.signInWithPassword({
    email: operatorEmail,
    password: operatorPassword,
  });
  if (error || !data?.session) {
    throw new Error(`Operator sign-in failed: ${error?.message || 'no session'}`);
  }
}

async function runActions() {
  const traveler = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: authData, error: authErr } = await traveler.auth.signInAnonymously();
  if (authErr || !authData?.user) throw new Error(`Anonymous sign-in failed: ${authErr?.message || 'no user'}`);
  const travelerId = authData.user.id;

  const { data: banditRows, error: banditErr } = await traveler.from('bandit').select('id,name').limit(1);
  if (banditErr) throw banditErr;
  const banditName = String(banditRows?.[0]?.name || 'banDit').trim() || 'banDit';
  const banditId = String(banditRows?.[0]?.id || '').trim();
  if (!banditId) throw new Error('No bandit found for Ask Me action');

  const askMessage = `About: ${banditName}\n\n${askSeed}`;
  const askPayload = {
    user_id: operatorUserId,
    type: 'bandit_question',
    title: 'Traveler',
    message: askMessage,
    reference_id: travelerId,
    reference_type: 'bandit_question_request',
    ask_target_bandit_id: banditId,
  };
  const { error: askErr } = await traveler.from('notifications').insert(askPayload);
  if (askErr) throw new Error(`Ask Me insert failed: ${askErr.message}`);

  const localPayload = {
    user_id: operatorUserId,
    type: 'local_friend',
    title: 'Traveler',
    message: localSeed,
    reference_id: travelerId,
    reference_type: 'local_friend_request',
  };
  const { error: localErr } = await traveler.from('notifications').insert(localPayload);
  if (localErr) throw new Error(`Local Friend insert failed: ${localErr.message}`);
}

function selectColumns() {
  return 'id,created_at,user_id,type,title,message,reference_id,reference_type,ask_target_bandit_id';
}

async function queryAskRows() {
  const { data, error } = await admin
    .from('notifications')
    .select(selectColumns())
    .eq('type', 'bandit_question')
    .ilike('message', `%${askSeed}%`)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data || [];
}

async function queryLocalRows() {
  const { data, error } = await admin
    .from('notifications')
    .select(selectColumns())
    .eq('type', 'local_friend')
    .eq('message', localSeed)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data || [];
}

await signInOperator();
await runActions();
const askRows = await waitForCountAtLeast(queryAskRows, 1);
const localRows = await waitForCountAtLeast(queryLocalRows, 1);

console.log(
  JSON.stringify(
    {
      ok: true,
      base,
      test_payloads: { askSeed, localSeed },
      askMe: { count: askRows.length, rows: askRows },
      localFriend: { count: localRows.length, rows: localRows },
    },
    null,
    2,
  ),
);
