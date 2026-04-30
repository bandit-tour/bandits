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

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const operatorUserId = process.env.EXPO_PUBLIC_OPERATOR_USER_ID || 'e6d8cb02-6f1a-40c0-96c4-b96961878407';
const operatorEmail = process.env.PLAY_OPERATOR_EMAIL || process.env.E2E_ADMIN_EMAIL || 'blonje@gmail.com';
const operatorPassword = process.env.PLAY_OPERATOR_PASSWORD || process.env.E2E_ADMIN_PASSWORD || '121275';

if (!supabaseUrl || !anonKey) {
  console.error(JSON.stringify({ ok: false, error: 'Missing SUPABASE URL or ANON KEY' }, null, 2));
  process.exit(1);
}

const admin = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const traveler = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const runSeed = `RAPID_${Date.now()}`;
const askSeeds = [`${runSeed}_ASK_1`, `${runSeed}_ASK_2`, `${runSeed}_ASK_3`];
const localSeeds = [`${runSeed}_LOCAL_1`, `${runSeed}_LOCAL_2`];
const allSeeds = [...askSeeds, ...localSeeds];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function toMessageCount(rows) {
  const counts = new Map();
  for (const row of rows) {
    const m = String(row.message || '');
    counts.set(m, (counts.get(m) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([message, count]) => ({ message, count }))
    .sort((a, b) => a.message.localeCompare(b.message));
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

async function signInTravelerAnon() {
  const { data, error } = await traveler.auth.signInAnonymously();
  if (error || !data?.user) throw new Error(`Anonymous sign-in failed: ${error?.message || 'no user'}`);
  return data.user.id;
}

async function firstBandit() {
  const { data, error } = await traveler.from('bandit').select('id,name').limit(1);
  if (error) throw error;
  const id = String(data?.[0]?.id || '').trim();
  const name = String(data?.[0]?.name || 'banDit').trim() || 'banDit';
  if (!id) throw new Error('No bandit found');
  return { id, name };
}

async function sendRapidActions() {
  const travelerId = await signInTravelerAnon();
  const bandit = await firstBandit();

  const askRows = askSeeds.map((seed) => ({
    user_id: operatorUserId,
    type: 'bandit_question',
    title: 'Traveler',
    message: `About: ${bandit.name}\n\n${seed}`,
    reference_id: travelerId,
    reference_type: 'bandit_question_request',
    ask_target_bandit_id: bandit.id,
  }));
  const localRows = localSeeds.map((seed) => ({
    user_id: operatorUserId,
    type: 'local_friend',
    title: 'Traveler',
    message: seed,
    reference_id: travelerId,
    reference_type: 'local_friend_request',
  }));

  const allRows = [...askRows, ...localRows];
  const inserts = allRows.map((row) => traveler.from('notifications').insert(row));
  const results = await Promise.all(inserts);
  const errors = results
    .map((r) => r.error)
    .filter(Boolean)
    .map((e) => ({ message: e.message, code: e.code || null }));
  if (errors.length > 0) {
    throw new Error(`Rapid insert errors: ${JSON.stringify(errors)}`);
  }
}

async function fetchRecentSeedRows() {
  const sinceIso = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from('notifications')
    .select('id,created_at,user_id,type,message,reference_type')
    .eq('user_id', operatorUserId)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;

  const rows = (data || []).filter((r) => {
    const msg = String(r.message || '');
    return allSeeds.some((seed) => msg.includes(seed));
  });
  return rows;
}

await signInOperator();
await sendRapidActions();

const immediateRows = await fetchRecentSeedRows();
const immediateGrouped = toMessageCount(immediateRows);

await sleep(12000);

const delayedRows = await fetchRecentSeedRows();
const delayedGrouped = toMessageCount(delayedRows);

const duplicateNow = immediateGrouped.filter((r) => r.count > 1);
const duplicateDelayed = delayedGrouped.filter((r) => r.count > 1);

console.log(
  JSON.stringify(
    {
      ok: true,
      runSeed,
      expected_messages: {
        ask: askSeeds,
        local: localSeeds,
      },
      query_equivalent: "SELECT message, COUNT(*) FROM notifications WHERE created_at > NOW() - INTERVAL '2 minutes' GROUP BY message",
      immediate: {
        grouped_counts: immediateGrouped,
        duplicates: duplicateNow,
        raw_rows: immediateRows,
      },
      delayed_after_12s: {
        grouped_counts: delayedGrouped,
        duplicates: duplicateDelayed,
        raw_rows: delayedRows,
      },
      pass: duplicateNow.length === 0 && duplicateDelayed.length === 0,
    },
    null,
    2,
  ),
);
