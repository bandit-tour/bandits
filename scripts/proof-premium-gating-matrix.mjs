/**
 * Premium Insights gating matrix (browser + server).
 * A fresh unpaid → checkout · B entitled demo → Concierge OS · C unpaid submit 403
 * D Sofia unavailable · E remaining decrements · F entitlement consistent after reload
 */
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
loadEnv({ path: path.join(root, '.env'), quiet: true });
loadEnv({ path: path.join(root, '.env.development.local'), override: true, quiet: true });

const base = process.env.RUNTIME_BASE_URL || 'http://localhost:8082';
const ws = `${base}/__workspace`;
const out = path.join(root, 'artifacts', 'runtime-proof', 'premium-gating-matrix');
const NEO = 'd76cb120-018d-4a2e-8b5f-0578a71fd8f9';
const SOFIA = 'c7dea92f-403e-4e13-931c-15d706785d11';
const DEMO = 'guest@banditour.demo';
const PASS = 'BanditPremium!123456';
const BRIDGE = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'X-Guest-Bridge': 'banditour-guest-bridge-2026',
  'X-Guest-QA': '1',
};

async function shot(page, name) {
  await fs.mkdir(out, { recursive: true });
  await page.screenshot({ path: path.join(out, name), fullPage: true });
  return `artifacts/runtime-proof/premium-gating-matrix/${name}`;
}

async function api(pathRel, { email, method = 'GET', body } = {}) {
  const res = await fetch(`${ws}${pathRel}`, {
    method,
    headers: { ...BRIDGE, 'X-Guest-Email': email || DEMO },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
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

async function openPremium(page, banditId) {
  await page.goto(`${base}/premium/${banditId}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2800);
}

function classify(body) {
  // Do NOT treat disclosure copy "Stay Pass (€19) covers…" as a checkout CTA.
  const checkout =
    /Unlock Your Local Insider|Renew Stay Pass —|Already paid/i.test(body) ||
    (/Unlock Stay Pass/i.test(body) && /€19/i.test(body));
  const ops =
    /Ask Neo|Ask Elia|Ask My banDit|Reserve a Restaurant|Stay Pass ·|Active Requests|Active \/ Status/i.test(
      body,
    );
  const unavailable = /not available/i.test(body);
  return { checkout, ops, unavailable };
}

async function run() {
  await fs.mkdir(out, { recursive: true });
  const url = String(process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
  const service = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !service) throw new Error('Missing Supabase env');
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  const freshEmail = `prem.fresh.${Date.now()}@banditour.proof`;
  const created = await admin.auth.admin.createUser({
    email: freshEmail,
    password: PASS,
    email_confirm: true,
  });
  if (created.error || !created.data.user?.id) {
    throw new Error(created.error?.message || 'createUser failed');
  }

  const browser = await chromium.launch({ headless: true });
  const ctxFresh = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const ctxDemo = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pageFresh = await ctxFresh.newPage();
  const pageDemo = await ctxDemo.newPage();

  // A — fresh unpaid → Neo checkout
  const okFresh = await signIn(pageFresh, freshEmail);
  await openPremium(pageFresh, NEO);
  const bodyA = await pageFresh.locator('body').innerText();
  const classA = classify(bodyA);
  const shotA = await shot(pageFresh, 'A-fresh-neo-checkout.png');

  // B — entitled demo guest → Concierge OS (no checkout CTA primary)
  // Demo may not have a Supabase password in this env — inject bridge via API check + page with storage override.
  // Browser path: sign-in if possible; else use API entitlement + anonymous page must NOT show ops.
  const entB = await api(
    `/api/commerce/entitlements?user_id=${encodeURIComponent(DEMO)}&product=premium_stay_pass&bandit_id=${NEO}&stay_id=current_stay`,
    { email: DEMO },
  );
  const demoActive = entB.json?.active === true || entB.json?.state === 'active';
  // Create/login a mirror entitled session by syncing is not needed — prove UI by setting guest email via app login if demo user exists.
  let classB = { checkout: false, ops: false, unavailable: false };
  let shotB = null;
  let demoLogin = false;
  try {
    // Ensure demo auth user exists with known password for browser proof
    const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    let demoUser = (listed.data?.users || []).find((u) => String(u.email || '').toLowerCase() === DEMO);
    if (!demoUser) {
      const c = await admin.auth.admin.createUser({ email: DEMO, password: PASS, email_confirm: true });
      demoUser = c.data.user;
    } else {
      await admin.auth.admin.updateUserById(demoUser.id, { password: PASS, email_confirm: true });
    }
    demoLogin = await signIn(pageDemo, DEMO);
    await openPremium(pageDemo, NEO);
    const bodyB = await pageDemo.locator('body').innerText();
    classB = classify(bodyB);
    shotB = await shot(pageDemo, 'B-entitled-neo-ops.png');
  } catch (e) {
    shotB = String(e);
  }

  // C — unpaid direct URL submit blocked server-side
  const submitC = await api('/api/bandit/premium', {
    email: freshEmail,
    method: 'POST',
    body: {
      action: 'concierge_request',
      banditId: NEO,
      service: 'Taxi',
      note: 'MATRIX_C_UNPAID',
      guestId: freshEmail,
      user_id: freshEmail,
    },
  });

  // D — Sofia unavailable (no €19 CTA)
  await openPremium(pageFresh, SOFIA);
  const bodyD = await pageFresh.locator('body').innerText();
  const classD = classify(bodyD);
  const shotD = await shot(pageFresh, 'D-sofia-unavailable.png');
  const sofiaVis = await api(`/api/bandit/premium?view=visibility&banditId=${SOFIA}`, {
    email: freshEmail,
  });

  // E — paid submit decrements exactly once
  const beforeE = await api(
    `/api/commerce/entitlements?user_id=${encodeURIComponent(DEMO)}&product=premium_stay_pass&bandit_id=${NEO}&stay_id=current_stay`,
    { email: DEMO },
  );
  const remBefore = beforeE.json?.requests_remaining;
  const submitE = await api('/api/bandit/premium', {
    email: DEMO,
    method: 'POST',
    body: {
      action: 'concierge_request',
      banditId: NEO,
      service: 'Restaurant reservations',
      note: `MATRIX_E_DECREMENT_${Date.now()}`,
      guestId: DEMO,
      user_id: DEMO,
    },
  });
  const remAfterSubmit = submitE.json?.stayPass?.requestsRemaining;
  const afterE = await api(
    `/api/commerce/entitlements?user_id=${encodeURIComponent(DEMO)}&product=premium_stay_pass&bandit_id=${NEO}&stay_id=current_stay`,
    { email: DEMO },
  );
  const remAfter = afterE.json?.requests_remaining;

  // F — reload entitled session stays consistent
  let classF = { checkout: false, ops: false };
  let shotF = null;
  if (demoLogin) {
    await pageDemo.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
    await pageDemo.waitForTimeout(2500);
    const bodyF = await pageDemo.locator('body').innerText();
    classF = classify(bodyF);
    shotF = await shot(pageDemo, 'F-entitled-after-reload.png');
  }

  await browser.close();

  const passA = okFresh && classA.checkout && !classA.ops;
  const passB = demoActive && demoLogin && classB.ops && !classB.checkout;
  const passC = submitC.status === 403 || /premium required/i.test(JSON.stringify(submitC.json));
  const passD =
    classD.unavailable &&
    !classD.checkout &&
    !classD.ops &&
    sofiaVis.json?.showPremiumInsights === false;
  const passE =
    submitE.status === 200 &&
    typeof remBefore === 'number' &&
    typeof remAfter === 'number' &&
    remAfter === remBefore - 1 &&
    (remAfterSubmit == null || remAfterSubmit === remAfter);
  const passF = !demoLogin || (classF.ops && !classF.checkout);

  const result = {
    pass: passA && passB && passC && passD && passE && passF,
    neo: NEO,
    sofia: SOFIA,
    accounts: {
      A: { emailDomain: 'banditour.proof', role: 'fresh_unpaid' },
      B: { emailDomain: 'banditour.demo', role: 'entitled_stay_pass', masked: 'guest@***' },
    },
    entitlementStateB: {
      active: demoActive,
      orderId: entB.json?.order_id || null,
      requestsRemaining: entB.json?.requests_remaining ?? null,
      expiresAt: entB.json?.expires_at || null,
      note: 'Prior Stripe TEST Stay Pass — explains Concierge OS without new checkout',
    },
    matrix: {
      A_fresh_checkout: { pass: passA, classA, shotA },
      B_entitled_ops: { pass: passB, classB, demoLogin, shotB },
      C_unpaid_submit_blocked: { pass: passC, status: submitC.status, body: submitC.json },
      D_sofia_free_only: {
        pass: passD,
        classD,
        showPremiumInsights: sofiaVis.json?.showPremiumInsights,
        shotD,
      },
      E_decrement_once: {
        pass: passE,
        remBefore,
        remAfterSubmit,
        remAfter,
        status: submitE.status,
      },
      F_reload_consistent: { pass: passF, classF, shotF },
    },
    layers: {
      octopusVerified: 'bandit eligibility / sales visibility only',
      stayPassActive: 'traveler paid entitlement — required for Concierge OS',
      preview: 'sales screen with €19 CTA when verified + not entitled',
      submit: 'Workspace 403 Premium required without ACTIVE entitlement',
    },
  };

  await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!result.pass) process.exitCode = 1;
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
