/**
 * Live QA: screenshots + PASS/FAIL. Requires: expo web + E2E_ADMIN_* in .env
 * Usage: node scripts/qa-live-verification.mjs
 * Env: BANDITS_WEB_BASE (default http://127.0.0.1:8084)
 */
import { config as loadEnv } from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
loadEnv({ path: path.join(root, '.env'), quiet: true });
loadEnv({ path: path.join(root, '.env.local'), override: true, quiet: true });

const base = (process.env.BANDITS_WEB_BASE || 'http://127.0.0.1:8084').replace(/\/$/, '');
const email = String(process.env.E2E_ADMIN_EMAIL || '').trim();
const password = String(process.env.E2E_ADMIN_PASSWORD || '').trim();
const out = path.join(root, 'artifacts', 'qa-verification', new Date().toISOString().replace(/[:.]/g, '-'));
const fixturePng = path.join(root, 'assets', 'icons', 'logobanditourapp.png');

const report = { baseUrl: base, areas: {} };

async function signIn(page) {
  await page.goto(`${base}/login?forceAuth=1`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.locator('input[type="email"]').first().waitFor({ state: 'visible', timeout: 60_000 });
  if (await page.getByText('Sign in', { exact: true }).first().isVisible().catch(() => false)) {
    await page.getByText('Sign in', { exact: true }).first().click();
    await page.waitForTimeout(400);
  }
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  const btns = page.getByText('Sign in', { exact: true });
  const n = await btns.count();
  await btns.nth(Math.max(0, n - 1)).click();
  await page.waitForTimeout(5500);
  if (page.url().includes('/login')) throw new Error('Sign-in did not complete');
}

async function shot(page, name) {
  const p = path.join(out, name);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await page.screenshot({ path: p, fullPage: true });
}

/** RN Web `Alert.alert` is not `window.confirm`; confirm destructive action in overlay. */
async function confirmDeleteInAlert(page) {
  await page.waitForTimeout(600);
  const clicked = await page.evaluate(() => {
    const modal =
      document.querySelector('[role="alertdialog"]') ||
      document.querySelector('[role="dialog"]') ||
      document.querySelector('[aria-modal="true"]');
    if (!modal) return false;
    const candidates = Array.from(modal.querySelectorAll('button, [role="button"], div')).filter(
      (el) => el.textContent?.trim() === 'Delete',
    );
    const btn = candidates[candidates.length - 1];
    if (btn && 'click' in btn) {
      (btn).click();
      return true;
    }
    return false;
  });
  if (clicked) return;
  await page.getByText('Delete', { exact: true }).last().click().catch(() => {});
}

async function main() {
  if (!email || !password) {
    console.error('Missing E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD');
    process.exit(1);
  }
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 430, height: 920 } });
  page.on('dialog', (d) => d.accept().catch(() => {}));

  const ts = Date.now();
  const uniqueName = `QAUser${String(ts).slice(-5)}`;
  const uniqueCity = `Teston${String(ts).slice(-4)}`;
  const uniqueVibe = `Good vibe ${String(ts).slice(-4)}`;

  // 1+2
  {
    let e = '';
    let p1 = false;
    let p2 = false;
    let dn = '';
    let ci = '';
    let vb = '';
    let saveErr = 0;
    try {
      await signIn(page);
      await page.goto(`${base}/profile`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await page.waitForTimeout(2800);
      await shot(page, '1a-profile.png');
      p2 = await page.getByText('A Note For Today', { exact: false }).isVisible().catch(() => false);
      const [fc] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 20_000 }),
        page.getByText('Upload from library', { exact: true }).first().click(),
      ]);
      await fc.setFiles(fixturePng);
      await page.waitForTimeout(7000);
      await shot(page, '1b-after-avatar.png');
      await page.getByPlaceholder('Display name', { exact: true }).fill(uniqueName);
      await page.getByPlaceholder('City', { exact: true }).fill(uniqueCity);
      await page.getByPlaceholder('Your vibe', { exact: true }).fill(uniqueVibe);
      await page.getByText('Save profile', { exact: true }).first().click();
      await page.waitForTimeout(4500);
      await shot(page, '1c-after-save.png');
      saveErr = await page.getByText(/Sign in required|Session mismatch|Invalid account/i).count();
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 });
      await page.waitForTimeout(3500);
      await shot(page, '1d-after-refresh.png');
      dn = await page.getByPlaceholder('Display name', { exact: true }).inputValue().catch(() => '');
      ci = await page.getByPlaceholder('City', { exact: true }).inputValue().catch(() => '');
      vb = await page.getByPlaceholder('Your vibe', { exact: true }).inputValue().catch(() => '');
      const body = (await page.textContent('body')) || '';
      p1 = saveErr === 0 && dn === uniqueName && ci === uniqueCity && vb === uniqueVibe;
      if (!p2) p2 = body.includes('A Note For Today');
    } catch (x) {
      e = x instanceof Error ? x.message : String(x);
    }
    report.areas['1_profile'] = {
      result: p1 && !e ? 'PASS' : 'FAIL',
      err: e || null,
      debug: { dn, ci, vb, expectName: uniqueName, expectCity: uniqueCity, expectVibe: uniqueVibe, saveErr },
    };
    report.areas['2_daily_inspiration'] = { result: p2 && !e ? 'PASS' : 'FAIL' };
  }

  // 3
  {
    let e = '';
    let tOk = false;
    let nOk = false;
    try {
      await page.goto(`${base}/hotel/play-theatrou`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await page.waitForTimeout(3000);
      await shot(page, '3a-intro.png');
      const t = (await page.textContent('body')) || '';
      tOk = t.includes('bottle') || t.includes('Bottle');
      const s = page.getByText('Start Exploring', { exact: true }).first();
      if (await s.isVisible().catch(() => false)) {
        await s.click();
        await page.waitForTimeout(5000);
        await shot(page, '3b-after-continue.png');
        nOk = !page.url().includes('login');
      }
    } catch (x) {
      e = x instanceof Error ? x.message : String(x);
    }
    report.areas['3_welcome_bottle'] = { result: tOk && nOk && !e ? 'PASS' : 'FAIL', err: e || null };
  }

  // 4
  {
    let e = '';
    let ok = false;
    try {
      await signIn(page);
      await page.goto(`${base}/localFriend`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await page.waitForTimeout(2500);
      await shot(page, '4a-form.png');
      await page.getByPlaceholder(/throw out there|vibe, a corner|kind of night/i).first().fill(`E2E test ${ts}`);
      await page.getByText('Send', { exact: true }).first().click();
      await page.waitForTimeout(1200);
      await shot(page, '4b-after-send.png');
      const skip = page.getByText('Skip', { exact: true }).first();
      if (await skip.isVisible().catch(() => false)) await skip.click();
      else await page.waitForTimeout(5000);
      await page.waitForTimeout(1500);
      await shot(page, '4c-result.png');
      const body = (await page.textContent('body')) || '';
      ok = body.includes('Sent to nearby travelers');
    } catch (x) {
      e = x instanceof Error ? x.message : String(x);
    }
    report.areas['4_local_friend'] = { result: ok && !e ? 'PASS' : 'FAIL', err: e || null };
  }

  // 5
  {
    let e = '';
    let pass = false;
    try {
      await signIn(page);
      await page.goto(`${base}/operatorDesk`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await page.waitForTimeout(5000);
      await shot(page, '5a-desk.png');
      if (!page.url().includes('operatorDesk') && page.url().includes('bandits')) {
        e = 'not operator / redirected';
      } else {
        const incomingRows = page.locator('[data-testid^="pilot-desk-open-thread-"]');
        const inCount = await incomingRows.count();
        if (inCount > 0) {
          const firstRow = page.locator('[data-testid^="pilot-desk-open-thread-"]').first();
          const del = firstRow.locator('..').getByText('Delete', { exact: true });
          if ((await del.count()) > 0) {
            try {
              await Promise.all([
                page.waitForEvent('dialog', { timeout: 8000 }).then((d) => d.accept()),
                del.first().click(),
              ]);
            } catch {
              await del.first().click();
              await confirmDeleteInAlert(page);
            }
            await page.waitForTimeout(4000);
            await shot(page, '5b-after-incoming-delete.png');
            await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 });
            await page.waitForTimeout(3000);
            await shot(page, '5c-refresh.png');
            const afterIn = await page.locator('[data-testid^="pilot-desk-open-thread-"]').count();
            pass = afterIn < inCount;
            if (!pass) e = 'row count did not drop after delete';
          } else e = 'no Delete on incoming row';
        } else {
          const n = await page.locator('[data-testid^="pilot-desk-report-"]').count();
          if (n > 0) {
            const del = page.locator('[data-testid^="pilot-desk-actions-"]').getByText('Delete', { exact: true });
            if ((await del.count()) > 0) {
              await del.first().click();
              await page.waitForTimeout(3000);
              await shot(page, '5b-after-report-delete.png');
              await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 });
              await page.waitForTimeout(3000);
              await shot(page, '5c-refresh.png');
              pass = (await page.locator('[data-testid^="pilot-desk-report-"]').count()) < n;
              if (!pass) e = 'report still present after delete?';
            } else e = 'no report delete button';
          } else e = 'no incoming, no reports';
        }
      }
    } catch (x) {
      e = x instanceof Error ? x.message : String(x);
    }
    report.areas['5_pilot_delete'] = { result: pass && !e ? 'PASS' : 'FAIL', err: e || null };
  }

  // 6
  {
    let e = '';
    let n0 = 0;
    let n1 = 0;
    let oneOk = false;
    let bulkTried = false;
    try {
      await signIn(page);
      await page.goto(`${base}/inbox`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await page.waitForTimeout(3000);
      await shot(page, '6a-inbox.png');
      n0 = await page.locator('[data-testid^="inbox-open-chat-"]').count();
      if (n0 > 0) {
        await page.getByText('Select', { exact: true }).first().click();
        await page.waitForTimeout(500);
        await page.locator('[data-testid^="inbox-open-chat-"]').first().click();
        await page.waitForTimeout(400);
        const dels = page.getByText('Delete', { exact: true });
        await dels.last().click();
        await page.waitForTimeout(5000);
        await shot(page, '6b-after-one-delete.png');
        await page.reload();
        await page.waitForTimeout(3000);
        n1 = await page.locator('[data-testid^="inbox-open-chat-"]').count();
        oneOk = n1 < n0;
        await shot(page, '6c-inbox-refresh.png');
        if ((await page.locator('[data-testid^="inbox-open-chat-"]').count()) > 0) {
          await page.getByText('Select', { exact: true }).first().click();
          const sa = page.getByText('Select all', { exact: true });
          if (await sa.isVisible().catch(() => false)) {
            await sa.click();
            bulkTried = true;
            const bd = page.getByText('Delete', { exact: true });
            if (await bd.last().isEnabled().catch(() => false)) {
              await bd.last().click();
              await confirmDeleteInAlert(page);
              await page.waitForTimeout(4000);
              await shot(page, '6d-bulk-delete.png');
            }
          }
        }
      }
      await page.goto(`${base}/bandits`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await page.waitForTimeout(2000);
      await shot(page, '6e-bottom-nav.png');
    } catch (x) {
      e = x instanceof Error ? x.message : String(x);
    }
    const nPass = n0 > 0 && oneOk;
    report.areas['6_notifications'] = {
      result: n0 === 0 ? 'FAIL' : nPass && !e ? 'PASS' : 'FAIL',
      nInboxBefore: n0,
      nInboxAfterOneDelete: n1,
      bulkTried,
      err: e || (n0 === 0 ? 'inbox had no deletable rows' : null),
    };
  }

  const reportPath = path.join(out, 'PASS_FAIL.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
  await browser.close();
  process.stdout.write(JSON.stringify(report, null, 2));
  process.stdout.write('\n\nOutput: ' + out + '\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
