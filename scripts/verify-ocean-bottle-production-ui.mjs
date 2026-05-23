/**
 * Production UI E2E: Guest A sends Local Friend → Guest B /bottle → reveal → reply → Guest A notification.
 * RUNTIME_BASE_URL=https://bandits-two.vercel.app node scripts/verify-ocean-bottle-production-ui.mjs
 */
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
loadEnv({ path: path.join(repoRoot, '.env') });

const base = (process.env.RUNTIME_BASE_URL || 'https://bandits-two.vercel.app').replace(/\/$/, '');
const apiBase = base;
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const outDir = path.join(
  repoRoot,
  'artifacts',
  'runtime-proof',
  `ocean-bottle-production-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
);

const result = { base, steps: {}, pass: false, tag: `prod-ui-${Date.now()}` };

async function shot(page, name) {
  await fs.mkdir(outDir, { recursive: true });
  const p = path.join(outDir, name);
  await page.screenshot({ path: p, fullPage: true });
  return p;
}

async function main() {
  if (!url || !anonKey || !serviceKey) throw new Error('Missing Supabase env');

  const svc = createClient(url, serviceKey, { auth: { persistSession: false } });
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const tag = result.tag;
  const rootId = crypto.randomUUID();

  const { data: guestAAuth } = await anon.auth.signInAnonymously();
  const guestAToken = guestAAuth.session.access_token;
  const guestAId = guestAAuth.user.id;

  const sendRes = await fetch(`${apiBase}/api/operator-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${guestAToken}` },
    body: JSON.stringify({
      kind: 'local_friend',
      threadRootId: rootId,
      title: 'Guest A',
      message: `${tag} hello from the city`,
      guestTitle: 'Local Friend request sent',
    }),
  });
  result.steps.guestASend = sendRes.ok;
  if (!sendRes.ok) throw new Error(`Guest A send failed: ${sendRes.status}`);

  const { data: floatRow } = await svc
    .from('local_friend_ocean_float')
    .select('id, status')
    .eq('thread_root_notification_id', rootId)
    .maybeSingle();
  result.steps.oceanEnqueued = !!floatRow?.id && floatRow.status === 'floating';

  const browser = await chromium.launch({ headless: true });
  const guestBContext = await browser.newContext();
  const guestB = await guestBContext.newPage();

  try {
    await guestB.goto(`${base}/bandits`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await guestB.waitForTimeout(3000);

    await guestB.goto(`${base}/bottle`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await guestB.waitForTimeout(8000);
    const bottleBody = (await guestB.textContent('body')) || '';
    result.steps.bottleShowsMessage =
      bottleBody.includes(tag) || /note drifted ashore/i.test(bottleBody);
    await shot(guestB, '01-bottle-message.png');

    result.steps.whoSentVisible = (await guestB.getByTestId('bottle-who-sent-this').count()) > 0;
    if (result.steps.whoSentVisible) {
      await guestB.getByTestId('bottle-who-sent-this').click({ timeout: 15000 });
      await guestB.waitForTimeout(4000);
      await shot(guestB, '02-chat-before-reveal.png');
    }

    const chatBody = (await guestB.textContent('body')) || '';
    result.steps.chatOpened =
      (await guestB.getByTestId('chat-thread-list').count()) > 0 ||
      /Write a message/i.test(chatBody);

    const revealBtn = guestB.getByTestId('chat-who-sent-this');
    if (await revealBtn.count()) {
      await revealBtn.click({ timeout: 10000 });
      await guestB.waitForTimeout(3000);
      await shot(guestB, '03-after-reveal.png');
    }
    const afterReveal = (await guestB.textContent('body')) || '';
    result.steps.senderRevealed =
      /Guest A/i.test(afterReveal) || !(await guestB.getByTestId('chat-who-sent-this').count());

    const composer = guestB.getByPlaceholder('Write a message...');
    await composer.waitFor({ state: 'visible', timeout: 30000 });
    await composer.fill(`${tag} reply from guest B`);
    await guestB.getByText('Send', { exact: true }).click();
    await guestB.waitForTimeout(3000);
    await shot(guestB, '04-after-reply.png');
    const afterReply = (await guestB.textContent('body')) || '';
    result.steps.guestBReplyVisible = afterReply.includes('reply from guest B');

    const { data: senderNotif } = await svc
      .from('notifications')
      .select('id, title, reference_type')
      .eq('user_id', guestAId)
      .eq('reference_type', 'local_friend_ocean_found')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    result.steps.guestASenderNotif =
      !!senderNotif?.id && String(senderNotif.title || '').includes('Someone found your bottle');

    const floatId = floatRow?.id;
    if (floatId) {
      await svc.from('local_friend_ocean_message').delete().eq('ocean_float_id', floatId);
      await svc.from('local_friend_ocean_float').delete().eq('id', floatId);
      await svc.from('notifications').delete().eq('reference_id', floatId);
    }
    await svc.from('notifications').delete().eq('id', rootId);
    await svc.from('notifications').delete().eq('reference_id', rootId);

    result.pass = Object.values(result.steps).every(Boolean);
    await fs.writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.pass ? 0 : 1);
  } finally {
    await browser.close();
  }
}

main().catch(async (e) => {
  result.error = String(e?.message || e);
  await fs.mkdir(outDir, { recursive: true }).catch(() => undefined);
  await fs.writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2)).catch(() => undefined);
  console.error(e);
  process.exit(1);
});
