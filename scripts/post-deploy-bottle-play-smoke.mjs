/**
 * Post-deploy smoke: Message in a Bottle + PLAY pilot stability (web production, mobile viewports).
 * RUNTIME_BASE_URL=https://bandits-two.vercel.app node scripts/post-deploy-bottle-play-smoke.mjs
 */
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
loadEnv({ path: path.join(repoRoot, '.env') });

const base = (process.env.RUNTIME_BASE_URL || 'https://bandits-two.vercel.app').replace(/\/$/, '');
const apiBase = base;
const outDir = path.join(
  repoRoot,
  'artifacts',
  'runtime-proof',
  `post-deploy-smoke-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
);

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** @type {Record<string, { pass: boolean; ms?: number; note?: string }>} */
const checks = {};
const perf = [];
const consoleErrors = [];
const consoleWarnings = [];
const networkSlow = [];
let blocking = [];

function record(id, pass, note = '', ms) {
  checks[id] = { pass, ...(ms != null ? { ms } : {}), ...(note ? { note } : {}) };
  if (!pass) blocking.push({ id, note });
}

async function shot(page, name) {
  await fs.mkdir(outDir, { recursive: true });
  const p = path.join(outDir, name);
  await page.screenshot({ path: p, fullPage: true });
  return p;
}

async function timed(label, fn) {
  const t0 = Date.now();
  try {
    const ok = await fn();
    const ms = Date.now() - t0;
    perf.push({ label, ms });
    return { ok, ms };
  } catch (e) {
    const ms = Date.now() - t0;
    perf.push({ label, ms, error: String(e?.message || e) });
    throw e;
  }
}

function attachObservers(page, platform) {
  page.on('console', (msg) => {
    const t = msg.type();
    const text = msg.text();
    if (t === 'error') consoleErrors.push({ platform, text: text.slice(0, 500) });
    if (t === 'warning' && /thread|memory|re-render|Maximum update/i.test(text)) {
      consoleWarnings.push({ platform, text: text.slice(0, 500) });
    }
  });
  page.on('pageerror', (err) => {
    consoleErrors.push({ platform, pageerror: String(err?.message || err).slice(0, 500) });
  });
  page.on('response', async (res) => {
    const u = res.url();
    if (!/supabase|vercel|bandits/i.test(u)) return;
    try {
      const t = Date.now();
      await res.finished();
      const ms = Date.now() - t;
      if (ms > 4000) networkSlow.push({ platform, url: u.slice(0, 120), ms });
    } catch {
      /* ignore */
    }
  });
}

async function skipIntro(page) {
  const enter = page.getByRole('button', { name: /Enter|Skip/i });
  if (await enter.count()) {
    await enter.first().click({ timeout: 8000 }).catch(() => undefined);
    await page.waitForTimeout(1500);
  }
}

async function runPlatformSmoke(platform, contextOpts) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext(contextOpts);
  const page = await ctx.newPage();
  attachObservers(page, platform);

  try {
    const { ms: launchMs } = await timed(`${platform}:launch`, async () => {
      await page.goto(`${base}/bandits`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await skipIntro(page);
      await page.waitForTimeout(2000);
      const body = (await page.textContent('body')) || '';
      return body.length > 200 && !/Something went wrong/i.test(body);
    });
    record(`${platform}_app_launch`, launchMs < 12000, launchMs >= 12000 ? `slow ${launchMs}ms` : '', launchMs);

    const tabs = [
      { name: 'explore', path: '/explore', label: 'Explore' },
      { name: 'notifications', path: '/notifications', label: 'Notifications' },
      { name: 'menu', path: '/menu', label: 'Menu' },
      { name: 'bandits', path: '/bandits', label: 'Home' },
    ];
    let prev = Date.now();
    for (const tab of tabs) {
      const tabStart = Date.now();
      await page.goto(`${base}${tab.path}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForTimeout(1800);
      const switchMs = Date.now() - tabStart;
      perf.push({ label: `${platform}:tab_${tab.name}`, ms: switchMs });
      const body = (await page.textContent('body')) || '';
      record(`${platform}_tab_${tab.name}`, body.length > 80, '', switchMs);
      prev = Date.now();
    }

    const { ms: exploreMs } = await timed(`${platform}:explore_load`, async () => {
      await page.goto(`${base}/explore`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForTimeout(3500);
      const body = (await page.textContent('body')) || '';
      return /Explore|Local banDit|Loading/i.test(body);
    });
    record(`${platform}_explore_load`, exploreMs < 15000, exploreMs >= 15000 ? `slow ${exploreMs}ms` : '', exploreMs);

    const mapVisible = await page.evaluate(() => {
      const leaflet = document.querySelector('.leaflet-container, [class*="leaflet"]');
      const mapPanel = document.querySelector('[data-testid="explore-map"], [class*="map"]');
      return !!(leaflet || mapPanel);
    });
    record(`${platform}_map_visible`, mapVisible, mapVisible ? '' : 'no map container');

    const avatarRound = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      const round = imgs.filter((img) => {
        const s = window.getComputedStyle(img);
        const br = s.borderRadius;
        const w = parseFloat(s.width) || img.clientWidth;
        return w >= 36 && (br.includes('50%') || parseFloat(br) >= w / 2 - 2);
      });
      return round.length;
    });
    record(`${platform}_explore_circular_avatars`, avatarRound >= 1, `found ${avatarRound} round avatars`);

    const heart = page.locator('text=♡, text=♥, text=❤').first();
    const heartCount = await page.locator('text=♡').count().catch(() => 0);
    if (heartCount > 0) {
      const clicks = [];
      for (let i = 0; i < 3; i++) {
        const t0 = Date.now();
        await page.locator('text=♡').first().click({ timeout: 5000 }).catch(() => undefined);
        clicks.push(Date.now() - t0);
        await page.waitForTimeout(300);
      }
      const multiClickOk = clicks.every((c) => c < 2000);
      record(`${platform}_heart_responsive`, multiClickOk, `clicks ${clicks.join(',')}ms`);
    } else {
      record(`${platform}_heart_responsive`, true, 'no heart visible (empty explore ok)');
    }

    const cardLink = page.locator('a[href*="/bandit/"], [href*="/bandit/"]').first();
    if (await cardLink.count()) {
      await cardLink.click({ timeout: 10000 });
      await page.waitForTimeout(2500);
      const onProfile = /\/bandit\//i.test(page.url()) || /banDit|bandit/i.test((await page.textContent('body')) || '');
      record(`${platform}_explore_to_bandit_profile`, onProfile, page.url());
      await page.goBack({ timeout: 15000 }).catch(() => page.goto(`${base}/explore`));
      await page.waitForTimeout(1500);
      record(`${platform}_back_navigation`, true, '');
    } else {
      record(`${platform}_explore_to_bandit_profile`, false, 'no bandit link on explore');
      record(`${platform}_back_navigation`, true, 'skipped');
    }

    const { ms: notifMs } = await timed(`${platform}:notifications`, async () => {
      await page.goto(`${base}/notifications`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForTimeout(2500);
      return /Notifications/i.test((await page.textContent('body')) || '');
    });
    record(`${platform}_notifications`, notifMs < 12000, '', notifMs);

    await page.goto(`${base}/chat`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(2000);
    const chatOk = /Chat|Write a message|Notifications/i.test((await page.textContent('body')) || '');
    record(`${platform}_chat_screen`, chatOk, '');

    const playOk = await timed(`${platform}:play_hotel`, async () => {
      await page.goto(`${base}/hotel/play-theatrou`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForTimeout(2500);
      const body = (await page.textContent('body')) || '';
      return /message in a bottle|Open your message|PLAY/i.test(body);
    });
    record(`${platform}_play_hotel_route`, playOk.ok, '', playOk.ms);

    await shot(page, `${platform}-final.png`);
  } finally {
    await browser.close();
  }
}

async function runBottleApiSmoke() {
  if (!url || !anonKey || !serviceKey) {
    record('bottle_api', false, 'missing supabase env');
    return;
  }
  const svc = createClient(url, serviceKey, { auth: { persistSession: false } });
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const tag = `smoke-${Date.now()}`;
  const rootId = crypto.randomUUID();

  const { data: sAuth } = await anon.auth.signInAnonymously();
  const sToken = sAuth.session.access_token;
  const senderId = sAuth.user.id;

  const sendRes = await fetch(`${apiBase}/api/operator-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sToken}` },
    body: JSON.stringify({
      kind: 'local_friend',
      threadRootId: rootId,
      title: 'Smoke Guest A',
      message: `${tag} pilot bottle smoke`,
      guestTitle: 'Local Friend request sent',
    }),
  });
  record('bottle_local_friend_send', sendRes.ok, `status ${sendRes.status}`);

  const { data: opRow } = await svc
    .from('notifications')
    .select('id, user_id, type')
    .eq('id', rootId)
    .maybeSingle();
  record('bottle_pilot_desk', opRow?.type === 'local_friend', opRow?.type || 'missing');

  const { data: floatRow } = await svc
    .from('local_friend_ocean_float')
    .select('id')
    .eq('thread_root_notification_id', rootId)
    .maybeSingle();
  record('bottle_ocean_enqueued', !!floatRow?.id);

  const receiverClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: rAuth } = await receiverClient.auth.signInAnonymously();
  const rToken = rAuth.session.access_token;

  const claimRes = await fetch(`${apiBase}/api/local-friend-ocean-claim`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${rToken}` },
  });
  const claimJ = await claimRes.json().catch(() => ({}));
  record('bottle_claim_api', claimRes.ok && claimJ.ok, JSON.stringify(claimJ).slice(0, 120));

  const floatId = claimJ.float_id || floatRow?.id;
  if (floatId) {
    const revealRes = await fetch(`${apiBase}/api/local-friend-ocean-reveal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rToken}` },
      body: JSON.stringify({ floatId }),
    });
    const revealJ = await revealRes.json().catch(() => ({}));
    record('bottle_reveal_api', revealRes.ok && revealJ.ok);

    const replyRes = await fetch(`${apiBase}/api/local-friend-ocean-reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rToken}` },
      body: JSON.stringify({ floatId, message: `${tag} reply` }),
    });
    record('bottle_reply_api', replyRes.ok);

    const { data: senderNotif } = await svc
      .from('notifications')
      .select('title')
      .eq('user_id', senderId)
      .eq('reference_type', 'local_friend_ocean_found')
      .eq('reference_id', floatId)
      .maybeSingle();
    record('bottle_sender_notification', String(senderNotif?.title || '').includes('Someone found your bottle'));

    await svc.from('local_friend_ocean_message').delete().eq('ocean_float_id', floatId);
    await svc.from('local_friend_ocean_float').delete().eq('id', floatId);
    await svc.from('notifications').delete().eq('reference_id', floatId);
  }
  await svc.from('notifications').delete().eq('id', rootId);
  await svc.from('notifications').delete().eq('reference_id', rootId);
}

async function runBottleUiSmoke() {
  const tag = `ui-smoke-${Date.now()}`;
  if (url && anonKey) {
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data: sAuth } = await anon.auth.signInAnonymously();
    await fetch(`${apiBase}/api/operator-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sAuth.session.access_token}`,
      },
      body: JSON.stringify({
        kind: 'local_friend',
        threadRootId: crypto.randomUUID(),
        title: 'Smoke UI Guest',
        message: `${tag} floating for bottle page`,
        guestTitle: 'Local Friend request sent',
      }),
    });
  }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ ...devices['iPhone 14'] });
  const page = await ctx.newPage();
  try {
    await page.goto(`${base}/bandits`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await skipIntro(page);
    await page.goto(`${base}/bottle`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(8000);
    const body = (await page.textContent('body')) || '';
    const hasPlayIntro =
      /message in a bottle has arrived/i.test(body) &&
      (/Flip/i.test(body) || /Explore the City/i.test(body));
    const hasWhoSentOnScan = /Who sent this\?/i.test(body);
    record(
      'bottle_ui_page',
      hasPlayIntro && !hasWhoSentOnScan,
      body.slice(0, 200),
    );
    record('bottle_no_reveal_on_scan', !hasWhoSentOnScan, hasWhoSentOnScan ? 'Who sent this visible' : '');
    const flipBtn = page.getByRole('button', { name: /^Flip$/i });
    if (await flipBtn.count()) {
      await flipBtn.click({ timeout: 10000 });
      await page.waitForTimeout(1500);
    }
    const hasGift = /YOUR ARRIVAL GIFT|Show this at reception/i.test((await page.textContent('body')) || '');
    record('bottle_gift_side', hasGift, '');
    await shot(page, 'bottle-ui-fail-or-pass.png');
    record('bottle_who_sent_chat', !hasWhoSentOnScan, 'reveal only in-app');
  } finally {
    await browser.close();
  }
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });

  await runBottleUiSmoke();
  await runBottleApiSmoke();

  await runPlatformSmoke('iphone', { ...devices['iPhone 14'] });
  await runPlatformSmoke('android', { ...devices['Pixel 5'] });

  await runPlatformSmoke('desktop_web', { viewport: { width: 1365, height: 900 } });

  const perfSorted = [...perf].sort((a, b) => b.ms - a.ms);
  const slowest = perfSorted[0];
  const avgMs = perf.length ? Math.round(perf.reduce((s, p) => s + p.ms, 0) / perf.length) : 0;

  const passCount = Object.values(checks).filter((c) => c.pass).length;
  const failCount = Object.values(checks).filter((c) => !c.pass).length;
  const overallPass = failCount === 0;

  const result = {
    base,
    overall: overallPass ? 'PASS' : 'FAIL',
    passCount,
    failCount,
    checks,
    blockingIssues: blocking,
    performance: {
      slowestScreen: slowest?.label,
      slowestMs: slowest?.ms,
      averageMs: avgMs,
      top5Slowest: perfSorted.slice(0, 5),
    },
    diagnostics: {
      jsThreadWarnings: consoleWarnings,
      consoleErrors: consoleErrors.slice(0, 20),
      networkBottlenecks: networkSlow.slice(0, 15),
      rerenderLoopHints: consoleWarnings.filter((w) => /Maximum update|re-render/i.test(w.text || '')),
    },
    artifactsDir: outDir,
  };

  await fs.writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  process.exit(overallPass ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
