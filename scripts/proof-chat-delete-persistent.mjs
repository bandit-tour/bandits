/**
 * Browser QA: Chat delete-for-me persistence (A deletes; B keeps; no resurrection).
 * Usage: node scripts/proof-chat-delete-persistent.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
loadEnv({ path: path.join(root, '.env'), quiet: true });
loadEnv({ path: path.join(root, '.env.development.local'), override: true, quiet: true });

const base = process.env.RUNTIME_BASE_URL || 'http://localhost:8082';
const out = path.join(root, 'artifacts', 'runtime-proof', 'chat-delete-persistent');
const url = String(process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
const service = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const anon = String(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();

const MARKER = `CHAT_DEL_${Date.now()}`;
const PASS = 'BanditDelete!123456';

async function shot(page, name) {
  await fs.mkdir(out, { recursive: true });
  await page.screenshot({ path: path.join(out, name), fullPage: true });
  return `artifacts/runtime-proof/chat-delete-persistent/${name}`;
}

async function signUp(page, email) {
  await page.goto(`${base}/login?forceAuth=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const signup = page.getByText('Sign up', { exact: true });
  if ((await signup.count()) > 0) await signup.first().click();
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(PASS);
  const btn = page.getByText('Sign up', { exact: true });
  await btn.nth((await btn.count()) - 1).click();
  await page.waitForTimeout(3500);
  return !page.url().includes('/login');
}

async function signIn(page, email) {
  await page.goto(`${base}/login?forceAuth=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(PASS);
  const btn = page.getByText('Sign in', { exact: true });
  await btn.nth((await btn.count()) - 1).click();
  await page.waitForTimeout(3000);
  return !page.url().includes('/login');
}

async function resolveUserId(admin, email) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  const hit = (data?.users || []).find((u) => String(u.email || '').toLowerCase() === email.toLowerCase());
  return hit?.id || null;
}

async function seedPair(admin, userA, userB) {
  const rootId = randomUUID();
  const idA = randomUUID();
  const idB = randomUUID();
  const now = new Date().toISOString();
  const rows = [
    {
      id: idA,
      user_id: userA,
      type: 'local_friend',
      title: 'Peer B',
      message: `${MARKER} hello from shared thread`,
      reference_id: rootId,
      reference_type: 'local_friend_guest_echo',
      is_read: false,
      created_at: now,
    },
    {
      id: idB,
      user_id: userB,
      type: 'local_friend',
      title: 'Peer A',
      message: `${MARKER} hello from shared thread`,
      reference_id: rootId,
      reference_type: 'local_friend_guest_echo',
      is_read: false,
      created_at: now,
    },
  ];
  const { error } = await admin.from('notifications').insert(rows);
  if (error) throw new Error(`seed insert failed: ${error.message}`);
  return { rootId, idA, idB, threadKey: `local_friend:${rootId}` };
}

async function openChat(page) {
  await page.goto(`${base}/community`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2500);
}

async function bodyHas(page, text) {
  const body = await page.locator('body').innerText().catch(() => '');
  return body.includes(text);
}

async function deleteMarkerThread(page) {
  const select = page.getByLabel('Select conversations');
  await select.click({ timeout: 15000 });
  await page.waitForTimeout(400);
  const row = page.locator(`text=${MARKER}`).first();
  await row.click({ timeout: 15000 });
  await page.waitForTimeout(300);
  const del = page.getByLabel('Delete selected conversations');
  await Promise.all([
    page.waitForEvent('dialog').then((d) => d.accept()),
    del.click(),
  ]);
  await page.waitForTimeout(3000);
}

async function storageEvidence(page) {
  return page.evaluate(() => {
    const keys = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.includes('dismissed') || k.includes('chat_thread'))) {
        keys[k] = localStorage.getItem(k);
      }
    }
    return keys;
  });
}

async function run() {
  if (!url || !service || !anon) throw new Error('Missing Supabase env');
  await fs.mkdir(out, { recursive: true });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  const emailA = `chatdel.a.${Date.now()}@banditour.proof`;
  const emailB = `chatdel.b.${Date.now()}@banditour.proof`;

  const createdA = await admin.auth.admin.createUser({
    email: emailA,
    password: PASS,
    email_confirm: true,
  });
  const createdB = await admin.auth.admin.createUser({
    email: emailB,
    password: PASS,
    email_confirm: true,
  });
  if (createdA.error || createdB.error || !createdA.data.user?.id || !createdB.data.user?.id) {
    const fail = {
      pass: false,
      reason: 'admin_create_user_failed',
      a: createdA.error?.message,
      b: createdB.error?.message,
    };
    await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify(fail, null, 2));
    console.log(JSON.stringify(fail, null, 2));
    return;
  }
  const userA = createdA.data.user.id;
  const userB = createdB.data.user.id;

  const browser = await chromium.launch({ headless: true });
  const ctxA = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  const okA = await signIn(pageA, emailA);
  const okB = await signIn(pageB, emailB);
  const shotAuth = await shot(pageA, '00-auth-A.png');
  if (!okA || !okB) {
    const fail = { pass: false, reason: 'signin_failed', okA, okB, shotAuth, userA, userB };
    await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify(fail, null, 2));
    console.log(JSON.stringify(fail, null, 2));
    await browser.close();
    return;
  }

  const seed = await seedPair(admin, userA, userB);

  await openChat(pageA);
  await openChat(pageB);
  const aSeesBefore = await bodyHas(pageA, MARKER);
  const bSeesBefore = await bodyHas(pageB, MARKER);
  const shotABefore = await shot(pageA, '01-A-before-delete.png');
  const shotBBefore = await shot(pageB, '01-B-before-delete.png');

  if (!aSeesBefore) {
    const fail = {
      pass: false,
      reason: 'A_missing_seed_thread',
      seed,
      shotABefore,
      shotBBefore,
    };
    await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify(fail, null, 2));
    console.log(JSON.stringify(fail, null, 2));
    await browser.close();
    return;
  }

  await deleteMarkerThread(pageA);
  const shotAAfter = await shot(pageA, '02-A-after-delete.png');
  const aGoneImmediate = !(await bodyHas(pageA, MARKER));

  // Wait for refetch / realtime resurrection window
  await pageA.waitForTimeout(4000);
  await pageA.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await pageA.waitForTimeout(2500);
  const aGoneAfterRefresh = !(await bodyHas(pageA, MARKER));
  const shotARefresh = await shot(pageA, '03-A-after-refresh.png');
  const storage = await storageEvidence(pageA);

  // Navigate away and back
  await pageA.goto(`${base}/bandits`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await pageA.waitForTimeout(1200);
  await openChat(pageA);
  const aGoneAfterNav = !(await bodyHas(pageA, MARKER));
  const shotANav = await shot(pageA, '04-A-after-nav.png');

  // Logout / login A
  await pageA.goto(`${base}/login?forceAuth=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await pageA.waitForTimeout(800);
  // clear session then sign in again
  await pageA.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
  });
  // NOTE: clearing localStorage removes local dismiss — server soft-hide must hold
  const reLogin = await signIn(pageA, emailA);
  await openChat(pageA);
  const aGoneAfterRelogin = !(await bodyHas(pageA, MARKER));
  const shotARelogin = await shot(pageA, '05-A-after-relogin-cleared-local.png');

  await openChat(pageB);
  await pageB.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await pageB.waitForTimeout(2000);
  const bStillHas = await bodyHas(pageB, MARKER);
  const shotBAfter = await shot(pageB, '06-B-still-has.png');

  const { data: rowsA } = await admin
    .from('notifications')
    .select('id,reference_type,is_read,message')
    .eq('user_id', userA)
    .eq('id', seed.idA)
    .maybeSingle();
  const { data: rowsB } = await admin
    .from('notifications')
    .select('id,reference_type,is_read,message')
    .eq('user_id', userB)
    .eq('id', seed.idB)
    .maybeSingle();

  // cleanup seeded rows
  await admin.from('notifications').delete().in('id', [seed.idA, seed.idB]);

  const pass =
    aSeesBefore &&
    bSeesBefore &&
    aGoneImmediate &&
    aGoneAfterRefresh &&
    aGoneAfterNav &&
    aGoneAfterRelogin &&
    bStillHas &&
    (rowsA == null || String(rowsA.reference_type || '') === 'deleted_thread') &&
    rowsB != null &&
    String(rowsB.reference_type || '') !== 'deleted_thread';

  const result = {
    pass,
    marker: MARKER,
    seed,
    emails: { A: emailA, B: emailB },
    checks: {
      aSeesBefore,
      bSeesBefore,
      aGoneImmediate,
      aGoneAfterRefresh,
      aGoneAfterNav,
      aGoneAfterRelogin,
      bStillHas,
      reLogin,
      rowA: rowsA,
      rowB: rowsB,
      storageBeforeReloginClear: storage,
    },
    shots: {
      shotAuth,
      shotABefore,
      shotBBefore,
      shotAAfter,
      shotARefresh,
      shotANav,
      shotARelogin,
      shotBAfter,
    },
    productRule:
      'Delete-for-me hides until a newer message (created_at > dismissedAt) arrives for this user.',
  };
  await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  if (!pass) process.exitCode = 1;
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
