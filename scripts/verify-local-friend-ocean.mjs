/**
 * Verify Travel in a Bottle pilot: enqueue → claim → reveal → peer reply + Pilot Desk row.
 * Usage: node scripts/verify-local-friend-ocean.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
for (const name of ['.env', '.env.local']) {
  const envPath = join(root, name);
  if (!existsSync(envPath)) continue;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    if (line.startsWith('#') || !line.trim()) continue;
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiBase = (process.env.EXPO_PUBLIC_AVATAR_API_BASE || 'https://bandits-two.vercel.app').replace(/\/$/, '');
const operatorId = 'e6d8cb02-6f1a-40c0-96c4-b96961878407';

const report = {
  migration: { tableExists: false, rpcClaimExists: false },
  api: { operatorMessage: false, oceanClaim: false, oceanReveal: false, oceanReply: false },
  data: {
    pilotDeskRow: false,
    oceanEnqueued: false,
    claimOk: false,
    senderNotif: false,
    receiverNotif: false,
    revealOk: false,
    peerReplyOk: false,
    senderPeerNotif: false,
    senderReplyOk: false,
  },
  cleanup: [],
  errors: [],
};

if (!url || !anonKey || !serviceKey) {
  console.error('Missing Supabase env vars');
  process.exit(1);
}

const svc = createClient(url, serviceKey, { auth: { persistSession: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false } });

async function migrationStatus() {
  const { error: tableErr } = await svc.from('local_friend_ocean_float').select('id').limit(1);
  report.migration.tableExists = !tableErr || !/does not exist|could not find/i.test(tableErr.message || '');
  if (tableErr && !report.migration.tableExists) {
    report.errors.push(`table check: ${tableErr.message}`);
  }
  const { error: rpcErr } = await anon.rpc('claim_local_friend_ocean_float');
  report.migration.rpcClaimExists = !rpcErr || !/function.*does not exist|could not find/i.test(rpcErr.message || '');
  if (rpcErr && !report.migration.rpcClaimExists) {
    report.errors.push(`rpc check: ${rpcErr.message}`);
  }
}

async function sendLocalFriend(token, rootId, message) {
  const res = await fetch(`${apiBase}/api/operator-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      kind: 'local_friend',
      threadRootId: rootId,
      title: 'Ocean Probe Traveler',
      message,
      guestTitle: 'Local Friend request sent',
    }),
  });
  const j = await res.json().catch(() => ({}));
  report.api.operatorMessage = res.ok;
  if (!res.ok) report.errors.push(`operator-message: ${res.status} ${JSON.stringify(j)}`);
  return res.ok;
}

async function main() {
  await migrationStatus();
  if (!report.migration.tableExists) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  const tag = `ocean-verify-${Date.now()}`;
  const rootId = crypto.randomUUID();
  let senderId = '';
  let receiverId = '';
  let floatId = '';
  let claimNotifId = '';

  // Sender
  const { data: sAuth, error: sErr } = await anon.auth.signInAnonymously();
  if (sErr) throw sErr;
  senderId = sAuth.user.id;
  const sToken = sAuth.session.access_token;

  const sent = await sendLocalFriend(sToken, rootId, `${tag} floating note`);
  if (!sent) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  const { data: opRow } = await svc
    .from('notifications')
    .select('id, user_id, type, reference_type')
    .eq('id', rootId)
    .maybeSingle();
  report.data.pilotDeskRow = opRow?.user_id === operatorId && opRow?.type === 'local_friend';

  const { data: floatRow } = await svc
    .from('local_friend_ocean_float')
    .select('id, status, message_body, sender_user_id')
    .eq('thread_root_notification_id', rootId)
    .maybeSingle();
  report.data.oceanEnqueued = !!floatRow?.id && floatRow.status === 'floating';
  floatId = floatRow?.id || '';

  // Receiver (fresh anon)
  const receiverClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: rAuth, error: rErr } = await receiverClient.auth.signInAnonymously();
  if (rErr) throw rErr;
  receiverId = rAuth.user.id;
  const rToken = rAuth.session.access_token;

  const claimRes = await fetch(`${apiBase}/api/local-friend-ocean-claim`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${rToken}` },
  });
  const claimJ = await claimRes.json().catch(() => ({}));
  report.api.oceanClaim = claimRes.ok && !!claimJ.ok;
  report.data.claimOk = report.api.oceanClaim && String(claimJ.message || '').includes(tag);
  claimNotifId = claimJ.notification_id || '';

  const { data: senderNotif } = await svc
    .from('notifications')
    .select('id, type, reference_type, title')
    .eq('user_id', senderId)
    .eq('reference_type', 'local_friend_ocean_found')
    .eq('reference_id', floatId)
    .maybeSingle();
  report.data.senderNotif =
    !!senderNotif?.id && String(senderNotif.title || '').includes('Someone found your bottle');

  const { data: receiverNotif } = await svc
    .from('notifications')
    .select('id, type, reference_type, title, message')
    .eq('user_id', receiverId)
    .eq('reference_type', 'local_friend_ocean_claim')
    .eq('reference_id', floatId)
    .maybeSingle();
  report.data.receiverNotif =
    !!receiverNotif?.id && String(receiverNotif.message || '').includes(tag);

  const revealRes = await fetch(`${apiBase}/api/local-friend-ocean-reveal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rToken}` },
    body: JSON.stringify({ floatId }),
  });
  const revealJ = await revealRes.json().catch(() => ({}));
  report.api.oceanReveal = revealRes.ok && !!revealJ.ok;
  report.data.revealOk = report.api.oceanReveal;

  const { data: floatAfter } = await svc
    .from('local_friend_ocean_float')
    .select('reveal_status')
    .eq('id', floatId)
    .maybeSingle();
  report.data.revealOk = report.data.revealOk && floatAfter?.reveal_status === 'revealed';

  const replyRes = await fetch(`${apiBase}/api/local-friend-ocean-reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rToken}` },
    body: JSON.stringify({ floatId, message: `${tag} peer reply` }),
  });
  const replyJ = await replyRes.json().catch(() => ({}));
  report.api.oceanReply = replyRes.ok && !!replyJ.ok;

  const { data: peerMsg } = await svc
    .from('local_friend_ocean_message')
    .select('id, body')
    .eq('ocean_float_id', floatId)
    .eq('author_user_id', receiverId)
    .maybeSingle();
  report.data.peerReplyOk = !!peerMsg?.id && String(peerMsg.body || '').includes('peer reply');

  const { data: senderPeerNotif } = await svc
    .from('notifications')
    .select('id, reference_type, message')
    .eq('user_id', senderId)
    .eq('reference_type', 'local_friend_ocean_peer')
    .eq('reference_id', floatId)
    .maybeSingle();
  report.data.senderPeerNotif =
    !!senderPeerNotif?.id && String(senderPeerNotif.message || '').includes('peer reply');

  const senderReplyRes = await fetch(`${apiBase}/api/local-friend-ocean-reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sToken}` },
    body: JSON.stringify({ floatId, message: `${tag} sender continues in chat` }),
  });
  const senderReplyJ = await senderReplyRes.json().catch(() => ({}));
  report.data.senderReplyOk = senderReplyRes.ok && !!senderReplyJ.ok;

  const { data: senderReplyMsg } = await svc
    .from('local_friend_ocean_message')
    .select('id, body')
    .eq('ocean_float_id', floatId)
    .eq('author_user_id', senderId)
    .maybeSingle();
  report.data.senderReplyOk =
    report.data.senderReplyOk &&
    !!senderReplyMsg?.id &&
    String(senderReplyMsg.body || '').includes('sender continues');

  // Cleanup probe rows
  report.cleanup = [rootId, floatId, claimNotifId, senderNotif?.id, receiverNotif?.id].filter(Boolean);
  if (floatId) {
    await svc.from('local_friend_ocean_message').delete().eq('ocean_float_id', floatId);
    await svc.from('local_friend_ocean_float').delete().eq('id', floatId);
  }
  if (rootId) {
    await svc.from('notifications').delete().eq('id', rootId);
    await svc.from('notifications').delete().eq('reference_id', rootId);
  }
  for (const nid of [senderNotif?.id, receiverNotif?.id, claimNotifId]) {
    if (nid) await svc.from('notifications').delete().eq('id', nid);
  }
  await svc.from('notifications').delete().eq('reference_id', floatId);
  if (senderPeerNotif?.id) await svc.from('notifications').delete().eq('id', senderPeerNotif.id);

  const pass =
    report.migration.tableExists &&
    report.data.pilotDeskRow &&
    report.data.oceanEnqueued &&
    report.data.claimOk &&
    report.data.senderNotif &&
    report.data.receiverNotif &&
    report.data.revealOk &&
    report.data.peerReplyOk &&
    report.data.senderPeerNotif &&
    report.data.senderReplyOk;

  console.log(JSON.stringify({ pass, report }, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  report.errors.push(String(e?.message || e));
  console.log(JSON.stringify({ pass: false, report }, null, 2));
  process.exit(1);
});
