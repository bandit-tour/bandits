import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
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
const operatorUserId = process.env.EXPO_PUBLIC_OPERATOR_USER_ID || 'e6d8cb02-6f1a-40c0-96c4-b96961878407';

if (!supabaseUrl || !anonKey) {
  console.error(JSON.stringify({ ok: false, error: 'Missing Supabase URL/anon key' }, null, 2));
  process.exit(1);
}

const travelerDb = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const operatorDb = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const runSeed = `DESK3_${Date.now()}`;
const seeds = [`${runSeed}_ASK_1`, `${runSeed}_ASK_2`, `${runSeed}_LOCAL_1`];
const outDir = path.join(root, 'artifacts', 'runtime-proof', `operator-desk-3rows-${new Date().toISOString().replace(/[:.]/g, '-')}`);

async function send3RapidActions() {
  const { data: authData, error: authErr } = await travelerDb.auth.signInAnonymously();
  if (authErr || !authData?.user) throw new Error(`Anonymous sign-in failed: ${authErr?.message || 'no user'}`);
  const travelerId = authData.user.id;

  const { data: banditRows, error: banditErr } = await travelerDb.from('bandit').select('id,name').limit(1);
  if (banditErr) throw banditErr;
  const banditId = String(banditRows?.[0]?.id || '').trim();
  const banditName = String(banditRows?.[0]?.name || 'banDit').trim() || 'banDit';
  if (!banditId) throw new Error('No bandit found');

  const ask1 = {
    user_id: operatorUserId,
    type: 'bandit_question',
    title: 'Traveler',
    message: `About: ${banditName}\n\n${seeds[0]}`,
    reference_id: travelerId,
    reference_type: 'bandit_question_request',
    ask_target_bandit_id: banditId,
  };
  const ask2 = {
    user_id: operatorUserId,
    type: 'bandit_question',
    title: 'Traveler',
    message: `About: ${banditName}\n\n${seeds[1]}`,
    reference_id: travelerId,
    reference_type: 'bandit_question_request',
    ask_target_bandit_id: banditId,
  };
  const local1 = {
    user_id: operatorUserId,
    type: 'local_friend',
    title: 'Traveler',
    message: seeds[2],
    reference_id: travelerId,
    reference_type: 'local_friend_request',
  };

  const results = await Promise.all([
    travelerDb.from('notifications').insert(ask1),
    travelerDb.from('notifications').insert(ask2),
    travelerDb.from('notifications').insert(local1),
  ]);
  const errors = results.map((r) => r.error).filter(Boolean);
  if (errors.length > 0) {
    throw new Error(`insert errors: ${JSON.stringify(errors.map((e) => e.message))}`);
  }
}

async function fetchDbRows() {
  const sinceIso = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: authData, error: authErr } = await operatorDb.auth.signInWithPassword({
    email: operatorEmail,
    password: operatorPassword,
  });
  if (authErr || !authData?.session) throw new Error(`Operator db auth failed: ${authErr?.message || 'no session'}`);

  const { data, error } = await operatorDb
    .from('notifications')
    .select('id,created_at,type,message,reference_type')
    .eq('user_id', operatorUserId)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data || []).filter((r) => seeds.some((s) => String(r.message || '').includes(s)));
}

async function captureOperatorDeskScreenshot() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1460, height: 980 } });
  const page = await context.newPage();
  try {
    await page.goto(`${base}/login?redirect=/operatorDesk`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(2000);
    const emailPlaceholderCount = await page.locator('input[placeholder="Enter your email"]').count();
    const emailTypeCount = await page.locator('input[type="email"]').count();
    if (emailPlaceholderCount < 1 && emailTypeCount < 1) {
      const debugPath = path.join(outDir, 'login-debug.png');
      await page.screenshot({ path: debugPath, fullPage: true });
      const body = ((await page.textContent('body')) || '').slice(0, 600);
      throw new Error(`Login inputs not found. body=${body.replace(/\s+/g, ' ')} screenshot=${debugPath}`);
    }
    const emailInput =
      emailPlaceholderCount > 0
        ? page.locator('input[placeholder="Enter your email"]').first()
        : page.locator('input[type="email"]').first();
    const passInput =
      (await page.locator('input[placeholder="Enter your password"]').count()) > 0
        ? page.locator('input[placeholder="Enter your password"]').first()
        : page.locator('input[type="password"]').first();
    await emailInput.fill(operatorEmail);
    await passInput.fill(operatorPassword);
    if ((await page.getByTestId('email-auth-submit').count()) > 0) {
      await page.getByTestId('email-auth-submit').click({ timeout: 20000 });
    } else {
      const signInButtons = page.getByText('Sign in', { exact: true });
      await signInButtons.nth((await signInButtons.count()) - 1).click({ timeout: 20000 });
    }
    await page.waitForTimeout(3000);
    await page.goto(`${base}/operatorDesk`, { waitUntil: 'domcontentloaded', timeout: 120000 });

    const end = Date.now() + 60000;
    while (Date.now() < end) {
      const body = (await page.textContent('body')) || '';
      const hits = seeds.filter((s) => body.includes(s)).length;
      if (hits === 3) break;
      await page.waitForTimeout(1800);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => undefined);
    }

    const uiRowsBySeed = await page.evaluate((allSeeds) => {
      const nodes = Array.from(document.querySelectorAll('[data-testid^="pilot-desk-open-thread-"]'));
      const matched = [];
      for (const node of nodes) {
        const text = (node.textContent || '').replace(/\s+/g, ' ');
        for (const seed of allSeeds) {
          if (text.includes(seed)) {
            matched.push({ seed, text });
            break;
          }
        }
      }
      return { count: matched.length, rows: matched };
    }, seeds);

    const shot = path.join(outDir, 'operator-desk-3rows.png');
    await page.screenshot({ path: shot, fullPage: true });
    return { screenshot: shot, uiRowsBySeed };
  } finally {
    await context.close();
    await browser.close();
  }
}

await mkdir(outDir, { recursive: true });
await send3RapidActions();
const dbRows = await fetchDbRows();
const shot = await captureOperatorDeskScreenshot();

const grouped = seeds.map((seed) => ({
  seed,
  count: dbRows.filter((r) => String(r.message || '').includes(seed)).length,
}));

const result = {
  ok: true,
  runSeed,
  seeds,
  db: {
    totalSeedRows: dbRows.length,
    groupedCounts: grouped,
    rows: dbRows,
  },
  ui: {
    totalRowsMatchingSeed: shot.uiRowsBySeed.count,
    rowsMatchingSeed: shot.uiRowsBySeed.rows,
    screenshot: shot.screenshot,
  },
  pass: dbRows.length === 3 && grouped.every((g) => g.count === 1) && shot.uiRowsBySeed.count === 3,
};

await writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2), 'utf8');
console.log(JSON.stringify(result, null, 2));
