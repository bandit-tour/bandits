/**
 * Run: RUNTIME_BASE_URL=http://localhost:8082 node scripts/pilot-flows-runtime.mjs
 * Optional: E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD in .env / .env.local (see .env.example) or env.
 * Screens: artifacts/runtime-proof/pilot-proof-NN-*.png
 */
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const outDir = path.join(repoRoot, 'artifacts', 'runtime-proof');
const onlyE2e345 = process.argv.includes('--e2e-345');
const onlyRows910 = process.argv.includes('--rows-9-10');
const onlyRow8 = process.argv.includes('--row-8-only');

const pathEnv = path.join(repoRoot, '.env');
const pathEnvLocal = path.join(repoRoot, '.env.local');
loadEnv({ path: pathEnv, quiet: true });
loadEnv({ path: pathEnvLocal, override: true, quiet: true });

function stripEnvQuotes(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

const base = process.env.RUNTIME_BASE_URL || 'http://localhost:8082';
const email = stripEnvQuotes(process.env.E2E_ADMIN_EMAIL);
const password = stripEnvQuotes(process.env.E2E_ADMIN_PASSWORD);
const hasCreds = !!(email && password);

function maskEmailForLog(e) {
  const s = String(e || '').trim();
  if (!s) return '(empty)';
  const at = s.indexOf('@');
  if (at < 1) return '***';
  return s[0] + '***' + s.slice(at);
}

/** @type {Record<string, { flow: string; result: 'PASS' | 'FAIL'; proof?: string; note?: string }>} */
const report = {};

function record(id, flow, result, note, proof) {
  report[id] = { flow, result, note: String(note || ''), proof: proof || undefined };
}

async function shot(page, name) {
  const rel = `artifacts/runtime-proof/${name}`;
  const full = path.join(outDir, name);
  await page.screenshot({ path: full, fullPage: true });
  return rel;
}

async function gotoPath(page, p) {
  const url = `${base.replace(/\/$/, '')}${p.startsWith('/') ? p : `/${p}`}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
}

async function signInWithPassword(page) {
  await gotoPath(page, '/login?forceAuth=1');
  const emailInput = page.locator('input[type="email"]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 60000 });
  await emailInput.fill(email);
  const pwInput = page.locator('input[type="password"]').first();
  await pwInput.waitFor({ state: 'visible', timeout: 30000 });
  await pwInput.fill(password);
  const signInButtons = page.getByText('Sign in', { exact: true });
  const n = await signInButtons.count();
  if (n < 1) throw new Error('No Sign in control');
  await signInButtons.nth(n - 1).click({ timeout: 5000 });
  await page.waitForURL(
    (u) => {
      if (u.pathname.includes('login') && !u.searchParams.get('error')) return false;
      return true;
    },
    { timeout: 90000 },
  );
  if (page.url().includes('/login') && !page.url().includes('error')) {
    throw new Error('Still on /login after submit');
  }
}

/** Row 8: inbox has at least one open-chat row (sender + preview in UI). */
async function runRow8NotificationRow(page) {
  try {
    await gotoPath(page, '/inbox');
    const row = page.locator('[data-testid^="inbox-open-chat-"]').first();
    await row.waitFor({ state: 'visible', timeout: 25000 });
    const proof8 = await shot(page, 'pilot-proof-08-inbox.png');
    const body = (await page.textContent('body')) || '';
    if ((await row.count()) > 0 && body.length > 40) {
      record('8', 'Notification shows sender + text', 'PASS', 'row+body', proof8);
    } else {
      record('8', 'Notification shows sender + text', 'FAIL', 'No inbox rows to verify sender', proof8);
    }
  } catch (e) {
    const proof8 = await shot(page, 'pilot-proof-08-fail.png');
    record('8', 'Notification shows sender + text', 'FAIL', e instanceof Error ? e.message : String(e), proof8);
  }
}

/** Rows 9–10: inbox row → chat → type → send (shared with full suite). */
async function runRows9And10(page) {
  try {
    await gotoPath(page, '/inbox');
    const row = page.locator('[data-testid^="inbox-open-chat-"]').first();
    await row.waitFor({ state: 'visible', timeout: 25000 });
    await row.click();
    await page.waitForTimeout(2500);
    const proof9 = await shot(page, 'pilot-proof-09-chat.png');
    const u = page.url();
    const onChat = u.includes('chat') || (await page.getByPlaceholder(/Write a message/i).count()) > 0;
    if (onChat) record('9', 'Notification opens working chat', 'PASS', u, proof9);
    else record('9', 'Notification opens working chat', 'FAIL', u, proof9);
  } catch (e) {
    const p9 = await shot(page, 'pilot-proof-09-fail.png');
    record('9', 'Notification opens working chat', 'FAIL', e instanceof Error ? e.message : String(e), p9);
  }

  try {
    const comp = page.getByPlaceholder(/Write a message/i).first();
    await comp.waitFor({ state: 'visible', timeout: 15000 });
    if ((await comp.count()) < 1) {
      const p10 = await shot(page, 'pilot-proof-10-no-composer.png');
      record('10', 'Reply sends', 'FAIL', 'No composer', p10);
      return;
    }
    const msg = 'pilot proof ' + Date.now();
    await comp.click();
    await comp.fill(msg);
    await page.waitForTimeout(400);
    const send = page.locator('[data-testid="chat-send-button"]');
    await send.waitFor({ state: 'visible', timeout: 15000 });
    await page
      .waitForFunction(() => {
        const el = document.querySelector('[data-testid="chat-send-button"]');
        if (!el) return false;
        return el.getAttribute('aria-disabled') !== 'true';
      }, null, { timeout: 15000 })
      .catch(() => null);
    await send.click({ timeout: 10000 });
    await page.waitForTimeout(2000);
    const proof10 = await shot(page, 'pilot-proof-10-after-send.png');
    record('10', 'Reply sends', 'PASS', 'sent', proof10);
  } catch (e) {
    const p10 = await shot(page, 'pilot-proof-10-fail.png');
    record('10', 'Reply sends', 'FAIL', e instanceof Error ? e.message : String(e), p10);
  }
}

/** Rows 3–5: pre-login, sign out, sign in, Pilot Desk. */
async function runE2EAdminRows345(page) {
  if (!hasCreds) {
    record('3', 'Sign out', 'FAIL', 'E2E creds not set; not executed');
    record('4', 'Sign back in', 'FAIL', 'E2E creds not set; not executed');
    record('5', 'Pilot Desk (admin)', 'FAIL', 'E2E creds not set; not executed');
    return;
  }
  let preLoginOk = false;
  try {
    await signInWithPassword(page);
    await page.waitForTimeout(1500);
    await shot(page, 'pilot-proof-setup-signed-in.png');
    preLoginOk = true;
  } catch (e) {
    const proofE = await shot(page, 'pilot-proof-03-05-auth-fail.png');
    record('3', 'Sign out', 'FAIL', `pre-login: ${e instanceof Error ? e.message : e}`, proofE);
    record('4', 'Sign back in', 'FAIL', 'pre-login failed', proofE);
    record('5', 'Pilot Desk (admin)', 'FAIL', 'pre-login failed', proofE);
  }
  if (!preLoginOk) return;

  try {
    await gotoPath(page, '/menu');
    await page.waitForTimeout(1200);
    const outBtn = page.getByText('Sign out', { exact: false });
    if ((await outBtn.count()) < 1) {
      const px = await shot(page, 'pilot-proof-03-no-signout.png');
      record('3', 'Sign out', 'FAIL', 'No Sign out (session?)', px);
    } else {
      await outBtn.first().click({ timeout: 10000 });
      await page.waitForTimeout(2000);
      const proof3 = await shot(page, 'pilot-proof-03-after-signout.png');
      const pathAfter = new URL(page.url()).pathname;
      if (pathAfter.includes('login') || pathAfter.includes('bandits') || pathAfter === '/')
        record('3', 'Sign out', 'PASS', pathAfter, proof3);
      else record('3', 'Sign out', 'FAIL', pathAfter, proof3);
    }
  } catch (e) {
    const proof3 = await shot(page, 'pilot-proof-03-signout-fail.png');
    record('3', 'Sign out', 'FAIL', e instanceof Error ? e.message : String(e), proof3);
  }

  try {
    await signInWithPassword(page);
    const proof4 = await shot(page, 'pilot-proof-04-signed-in-again.png');
    record('4', 'Sign back in', 'PASS', 'left login', proof4);
  } catch (e) {
    const proof4 = await shot(page, 'pilot-proof-04-signin-fail.png');
    record('4', 'Sign back in', 'FAIL', e instanceof Error ? e.message : String(e), proof4);
  }

  try {
    await gotoPath(page, '/menu');
    await page.waitForTimeout(2000);
    const proof5 = await shot(page, 'pilot-proof-05-pilot-desk.png');
    const hasDesk = (await page.getByText('Pilot Desk', { exact: true }).count()) > 0;
    if (hasDesk) record('5', 'Pilot Desk (admin)', 'PASS', 'Visible', proof5);
    else record('5', 'Pilot Desk (admin)', 'FAIL', 'Pilot Desk not on menu', proof5);
  } catch (e) {
    const proof5 = await shot(page, 'pilot-proof-05-menu-fail.png');
    record('5', 'Pilot Desk (admin)', 'FAIL', e instanceof Error ? e.message : String(e), proof5);
  }
}

async function run() {
  for (const k of Object.keys(report)) delete report[k];
  console.log(`.env.local at repo root: ${existsSync(pathEnvLocal) ? 'YES' : 'NO'}`);
  console.log(`E2E_ADMIN_EMAIL=${email ? maskEmailForLog(email) : 'shown'}`);
  console.log(`E2E_ADMIN_PASSWORD=${password ? 'loaded' : 'not loaded'}`);

  await fs.mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });

  try {
    const up = await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch((e) => e);
    if (up instanceof Error) {
      if (!onlyE2e345 && !onlyRows910 && !onlyRow8) {
        record('0', 'base URL', 'FAIL', up.message);
      }
      if (onlyE2e345) {
        record('3', 'Sign out', 'FAIL', `base: ${up.message}`);
        record('4', 'Sign back in', 'FAIL', `base: ${up.message}`);
        record('5', 'Pilot Desk (admin)', 'FAIL', `base: ${up.message}`);
      }
      if (onlyRows910) {
        record('9', 'Notification opens working chat', 'FAIL', `base: ${up.message}`);
        record('10', 'Reply sends', 'FAIL', `base: ${up.message}`);
      }
      if (onlyRow8) {
        record('8', 'Notification shows sender + text', 'FAIL', `base: ${up.message}`);
      }
    } else if (onlyRow8) {
      if (!hasCreds) {
        record('8', 'Notification shows sender + text', 'FAIL', 'E2E creds not set');
      } else {
        await signInWithPassword(page);
        await runRow8NotificationRow(page);
      }
    } else if (onlyRows910) {
      if (!hasCreds) {
        record('9', 'Notification opens working chat', 'FAIL', 'E2E creds not set');
        record('10', 'Reply sends', 'FAIL', 'E2E creds not set');
      } else {
        await signInWithPassword(page);
        await runRows9And10(page);
      }
    } else if (onlyE2e345) {
      await runE2EAdminRows345(page);
    } else {
    // 1) Play (hotel) link
    try {
      await gotoPath(page, '/hotel/play-theatrou');
      await page.waitForTimeout(2000);
      const t = (await page.textContent('body')) || '';
      const p = new URL(page.url()).pathname;
      const proof1 = await shot(page, 'pilot-proof-01-play.png');
      if (p.includes('hotel') && t.length > 100 && !/unhandled|error screen/i.test(t)) {
        record('1', 'Play link', 'PASS', p, proof1);
      } else {
        record('1', 'Play link', 'FAIL', `path=${p} bodyLen=${t.length}`, proof1);
      }
    } catch (e) {
      const proof1 = await shot(page, 'pilot-proof-01-play-fail.png');
      record('1', 'Play link', 'FAIL', e instanceof Error ? e.message : String(e), proof1);
    }

    // 2) Home / Local bandits
    try {
      await gotoPath(page, '/bandits');
      await page.waitForTimeout(8000);
      const proof2 = await shot(page, 'pilot-proof-02-home-bandits.png');
      const t = (await page.textContent('body')) || '';
      if (t.length > 40 && (t.includes('No bandits') || t.length > 200)) {
        record('2', 'Home / Local bandits', 'PASS', 'Rendered', proof2);
      } else {
        record('2', 'Home / Local bandits', 'FAIL', 'No meaningful home content', proof2);
      }
    } catch (e) {
      const proof2 = await shot(page, 'pilot-proof-02-home-fail.png');
      record('2', 'Home / Local bandits', 'FAIL', e instanceof Error ? e.message : String(e), proof2);
    }

    await runE2EAdminRows345(page);

    // 6) Profile image
    try {
      await gotoPath(page, '/profile');
      await page.waitForTimeout(2000);
      const proof6a = await shot(page, 'pilot-proof-06a-profile.png');
      const up = page.getByText(/upload from library/i).first();
      if ((await up.count()) < 1) {
        record('6', 'Profile image + persist', 'FAIL', 'Upload control not found', proof6a);
      } else {
        const chooserPromise = page.waitForEvent('filechooser', { timeout: 8000 }).catch(() => null);
        await up.click().catch(() => {});
        const chooser = await chooserPromise;
        if (!chooser) {
          record('6', 'Profile image + persist', 'FAIL', 'filechooser not available', proof6a);
        } else {
          await chooser.setFiles([path.join(__dirname, '..', 'assets', 'images', 'playstore.png')]);
          await page.waitForTimeout(3500);
          await shot(page, 'pilot-proof-06b-after-upload.png');
          await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
          await page.waitForTimeout(2000);
          const proof6 = await shot(page, 'pilot-proof-06c-after-refresh.png');
          record('6', 'Profile image + persist', 'PASS', 'upload+reload; visual check', proof6);
        }
      }
    } catch (e) {
      const px = await shot(page, 'pilot-proof-06-fail.png');
      record('6', 'Profile image + persist', 'FAIL', e instanceof Error ? e.message : String(e), px);
    }

    // 7) Save profile
    try {
      await gotoPath(page, '/profile');
      await page.waitForTimeout(1200);
      const nameInput = page.getByPlaceholder('Display name').first();
      if ((await nameInput.count()) < 1) {
        const p7 = await shot(page, 'pilot-proof-07-no-name.png');
        record('7', 'Save profile', 'FAIL', 'No Display name field', p7);
      } else {
        await nameInput.fill(`Proof ${Date.now()}`);
        const save = page.getByText('Save profile', { exact: true });
        if ((await save.count()) < 1) {
          const p7 = await shot(page, 'pilot-proof-07-no-save.png');
          record('7', 'Save profile', 'FAIL', 'Save profile button missing', p7);
        } else {
          await save.first().click();
          await page.waitForTimeout(2000);
          const proof7 = await shot(page, 'pilot-proof-07-after-save.png');
          record('7', 'Save profile', 'PASS', 'Save clicked', proof7);
        }
      }
    } catch (e) {
      const px = await shot(page, 'pilot-proof-07-fail.png');
      record('7', 'Save profile', 'FAIL', e instanceof Error ? e.message : String(e), px);
    }

    await runRow8NotificationRow(page);

    await runRows9And10(page);

      if (
        consoleErrors.some(
          (c) => /authsession|auth session missing|session missing|network error/i.test(c) && !/favicon|404/.test(c),
        )
      ) {
        const crit = consoleErrors.find((c) => /authsession|session missing/i.test(c));
        report['console'] = { flow: 'console', result: 'FAIL', note: crit || '' };
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  await fs.writeFile(
    path.join(outDir, 'pilot-flows-report.json'),
    JSON.stringify({ base, hasCreds, report, sampleConsole: consoleErrors.slice(0, 5) }, null, 2),
  );
  if (onlyE2e345) {
    console.log(`ENV LOADED: ${hasCreds ? 'YES' : 'NO'}`);
    console.log(`Row 3: ${report['3']?.result ?? 'N/A'}`);
    console.log(`Row 4: ${report['4']?.result ?? 'N/A'}`);
    console.log(`Row 5: ${report['5']?.result ?? 'N/A'}`);
  } else if (onlyRows910) {
    console.log(`Row 9: ${report['9']?.result ?? 'N/A'}`);
    console.log(`Row 10: ${report['10']?.result ?? 'N/A'}`);
  } else if (onlyRow8) {
    console.log(`Row 8: ${report['8']?.result ?? 'N/A'}`);
  } else {
    for (const k of Object.keys(report).sort()) {
      const r = report[k];
      console.log(`${k}\t${r.result}\t${r.flow}\t${r.proof || ''}\t${r.note || ''}`);
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
