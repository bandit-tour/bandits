/**
 * Production E2E: push token store, ocean bottle flow, push dispatch hooks.
 * Usage: node scripts/verify-push-production-e2e.mjs
 *
 * Optional: EXPO_PUSH_TEST_TOKEN=ExponentPushToken[...] to verify Expo delivery to a real device.
 */
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
loadEnv({ path: path.join(root, '.env') });
loadEnv({ path: path.join(root, '.env.local'), override: true });

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiBase = (process.env.EXPO_PUBLIC_AVATAR_API_BASE || 'https://bandits-two.vercel.app').replace(/\/$/, '');
const testPushToken = String(process.env.EXPO_PUSH_TEST_TOKEN || '').trim();

const report = {
  at: new Date().toISOString(),
  apiBase,
  migration064: { tableExists: false },
  pushRegister: { ok: false, storage: null },
  tokenStore: { senderTokens: 0, receiverTokens: 0 },
  oceanFlow: {
    enqueue: false,
    claim: false,
    senderFoundNotif: false,
    guestClaimNotif: false,
    guestReply: false,
    senderThreadNotif: false,
    chatThreadRows: 0,
  },
  pushDispatch: { bottleFound: null, guestReply: null, testDevice: null },
  pass: false,
  errors: [],
};

if (!url || !anonKey || !serviceKey) {
  console.error('Missing Supabase env');
  process.exit(1);
}

const svc = createClient(url, serviceKey, { auth: { persistSession: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false } });

async function apiPost(path, token, body) {
  const res = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json: j };
}

async function main() {
  const { error: tableErr } = await svc.from('user_push_tokens').select('id').limit(1);
  report.migration064.tableExists = !tableErr || !/does not exist|could not find/i.test(tableErr.message || '');
  if (tableErr && !report.migration064.tableExists) {
    report.errors.push(`migration064 pending: ${tableErr.message}`);
  }

  const tag = `push-e2e-${Date.now()}`;
  const rootId = crypto.randomUUID();
  const fakeDeviceToken = `ExponentPushToken[e2e-${tag}]`;

  const { data: sAuth } = await anon.auth.signInAnonymously();
  const senderToken = sAuth?.session?.access_token;
  const senderId = sAuth?.user?.id;
  if (!senderToken || !senderId) throw new Error('sender auth failed');

  const { data: rAuth } = await anon.auth.signInAnonymously();
  const receiverToken = rAuth?.session?.access_token;
  const receiverId = rAuth?.user?.id;
  if (!receiverToken || !receiverId) throw new Error('receiver auth failed');

  const regSender = await apiPost('/api/push?action=register', senderToken, {
    expoPushToken: fakeDeviceToken,
    platform: 'e2e',
  });
  report.pushRegister.ok = regSender.ok;
  report.pushRegister.storage = regSender.json?.storage ?? null;
  if (!regSender.ok) report.errors.push(`push-register sender: ${regSender.status} ${JSON.stringify(regSender.json)}`);

  if (testPushToken) {
    await apiPost('/api/push?action=register', senderToken, { expoPushToken: testPushToken, platform: 'device' });
  }

  const { loadExpoPushTokensForUser } = await import('../server/push/pushTokenStore.js');
  report.tokenStore.senderTokens = (await loadExpoPushTokensForUser(svc, senderId)).length;
  report.tokenStore.receiverTokens = (await loadExpoPushTokensForUser(svc, receiverId)).length;

  const opMsg = await apiPost('/api/operator-message', senderToken, {
    kind: 'local_friend',
    threadRootId: rootId,
    title: 'Push E2E Sender',
    message: `${tag} floating in the ocean`,
    guestTitle: 'Local Friend request sent',
  });
  report.oceanFlow.enqueue = opMsg.ok;
  if (!opMsg.ok) report.errors.push(`operator-message: ${opMsg.status}`);

  const claim = await apiPost('/api/local-friend-ocean?action=claim', receiverToken, {});
  report.oceanFlow.claim = claim.ok && !!claim.json?.float_id;
  const floatId = String(claim.json?.float_id || '');
  if (!report.oceanFlow.claim) report.errors.push(`claim: ${claim.status} ${JSON.stringify(claim.json)}`);

  const { data: senderNotifs } = await svc
    .from('notifications')
    .select('id, reference_type, is_read')
    .eq('user_id', senderId)
    .eq('reference_type', 'local_friend_ocean_found')
    .eq('reference_id', floatId);
  report.oceanFlow.senderFoundNotif = (senderNotifs || []).length > 0;

  const { data: guestNotifs } = await svc
    .from('notifications')
    .select('id')
    .eq('user_id', receiverId)
    .eq('reference_type', 'local_friend_ocean_claim')
    .eq('reference_id', floatId);
  report.oceanFlow.guestClaimNotif = (guestNotifs || []).length > 0;

  const reply = await apiPost('/api/local-friend-ocean?action=reply', receiverToken, {
    floatId,
    message: `${tag} guest first reply`,
  });
  report.oceanFlow.guestReply = reply.ok;
  if (!reply.ok) report.errors.push(`reply: ${reply.status} ${JSON.stringify(reply.json)}`);

  const { data: threadNotifs } = await svc
    .from('notifications')
    .select('id, type, reference_type, is_read')
    .eq('user_id', senderId)
    .eq('reference_type', 'local_friend_ocean_thread')
    .eq('reference_id', floatId);
  report.oceanFlow.senderThreadNotif = (threadNotifs || []).some((n) => !n.is_read);

  const { data: chatRows } = await svc
    .from('notifications')
    .select('id, reference_id, reference_type, is_read')
    .eq('user_id', senderId)
    .in('reference_type', ['local_friend_ocean_thread', 'local_friend_ocean_claim']);
  report.oceanFlow.chatThreadRows = (chatRows || []).filter((n) => String(n.reference_id) === floatId).length;

  const { dispatchExpoPushToUser } = await import('../server/push/expoPushDispatch.js');
  report.pushDispatch.bottleFound = await dispatchExpoPushToUser(svc, {
    userId: senderId,
    title: 'Someone found your bottle',
    body: 'E2E probe',
    channelId: 'bottle',
    data: { surface: 'inbox', kind: 'bottle_found', floatId },
  });
  report.pushDispatch.guestReply = await dispatchExpoPushToUser(svc, {
    userId: senderId,
    title: 'Someone replied to your bottle',
    body: 'E2E probe reply',
    channelId: 'messages',
    data: { surface: 'chat', kind: 'guest_replied', floatId },
  });

  if (testPushToken) {
    report.pushDispatch.testDevice = await dispatchExpoPushToUser(svc, {
      userId: senderId,
      title: 'bandiTour device test',
      body: `Push E2E ${tag}`,
      channelId: 'messages',
      data: { surface: 'chat', kind: 'chat_message', floatId },
    });
  }

  const pushPipeOk =
    report.pushDispatch.bottleFound?.total > 0 &&
    report.pushDispatch.bottleFound?.skipped !== 'network_error' &&
    report.pushDispatch.bottleFound?.skipped !== 'token_lookup_failed';

  report.pass =
    report.pushRegister.ok &&
    report.tokenStore.senderTokens > 0 &&
    report.oceanFlow.enqueue &&
    report.oceanFlow.claim &&
    report.oceanFlow.senderFoundNotif &&
    report.oceanFlow.guestReply &&
    report.oceanFlow.senderThreadNotif &&
    report.oceanFlow.chatThreadRows >= 1 &&
    pushPipeOk;

  const outDir = path.join(root, 'artifacts', 'runtime-proof', `push-e2e-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'RESULT.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log('artifacts:', outDir);
  process.exit(report.pass ? 0 : 1);
}

main().catch((e) => {
  report.errors.push(e instanceof Error ? e.message : String(e));
  console.error(e);
  process.exit(1);
});
