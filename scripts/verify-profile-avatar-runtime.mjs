/**
 * Live runtime proof: http://localhost:8081 + Playwright.
 * Requires: E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD in .env, expo web on 8081.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
config({ path: path.join(root, '.env') });
config({ path: path.join(root, '.env.local') });

const { chromium } = await import('playwright');

const base = process.env.PROFILE_VERIFY_BASE || 'http://localhost:8081';
const outDir = path.join(root, 'artifacts', 'runtime-proof', `profile-avatar-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`);
const testImage = path.join(root, 'assets', 'icons', 'octopus.jpeg');

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

const report = {
  pass: null,
  line: null,
  err: null,
  supabaseStorageOk: null,
  publicUrl: null,
  profileRowOk: null,
  avatarChecks: [],
  dialogs: [],
  storageResponses: [],
};

async function main() {
  await mkdir(outDir, { recursive: true });
  if (!email || !password) {
    report.pass = 'FAIL';
    report.err = 'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set in .env — cannot run live sign-in';
    report.line = 'scripts/verify-profile-avatar-runtime.mjs: credentials';
    await writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(report, null, 2), 'utf8');
    console.log(JSON.stringify(report));
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on('dialog', (d) => {
    try {
      report.dialogs.push(d.message());
    } catch {
      // ignore
    }
    d.accept().catch(() => undefined);
  });

  const beforePath = path.join(outDir, '1-before.png');
  const afterPath = path.join(outDir, '2-immediately-after-upload.png');
  const t10Path = path.join(outDir, '3-after-10s.png');
  const afterRefreshPath = path.join(outDir, '4-after-full-refresh.png');

  try {
    await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.getByPlaceholder('Enter your email', { exact: true }).fill(email);
    await page.getByPlaceholder('Enter your password', { exact: true }).fill(password);
    const submit = page.getByTestId('email-auth-submit');
    if ((await submit.count()) < 1) {
      throw new Error('No email-auth-submit (add testID in login).');
    }
    await submit.click();
    await page.waitForTimeout(6000);
    if (String(page.url()).toLowerCase().includes('/login')) {
      const errText = (
        await page.locator('[class*="Error"], [role="alert"], :text("Sign in failed")').allTextContents()
      ).join(' ');
      throw new Error(`Login still on /login after click. On-page: ${errText || '(none)'} E2E credential check.`);
    }
    await page.goto(`${base}/profile`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForTimeout(2000);
    if ((await page.getByText('Sign in to sync your account', { exact: true }).count()) > 0) {
      const body = await page.content();
      throw new Error(
        `On /profile, still "Sign in to sync" (Guest). Login session not established. ${body.length < 5000 ? body.slice(0, 2000) : 'long body'}`,
      );
    }
    await page.screenshot({ path: beforePath, fullPage: true });

    const uploadButton = page.getByText('Upload from library', { exact: true });
    if ((await uploadButton.count()) < 1) {
      throw new Error('No "Upload from library" button on profile screen.');
    }
    const chooserPromise = page.waitForEvent('filechooser', { timeout: 10_000 });
    await uploadButton.click();
    const chooser = await chooserPromise;
    await chooser.setFiles(testImage);

    let storageHit = null;
    page.on('request', (req) => {
      const u = req.url();
      if (u.includes('supabase') && (u.includes('object') || u.includes('upload') || u.includes('profile_avatars'))) {
        const headers = req.headers();
        storageHit = { url: u, method: req.method(), hasAuth: Boolean(headers.authorization) };
        report.supabaseStorageOk = true;
      }
    });
    page.on('response', async (r) => {
      const u = r.url();
      if (!u.includes('/storage/v1/object/')) return;
      let body = '';
      try {
        body = (await r.text()).slice(0, 240);
      } catch {
        body = '';
      }
      report.storageResponses.push({ status: r.status(), url: u, body });
    });

    const respWait = page
      .waitForResponse(
        (r) => {
          const u = r.url();
          return (u.includes('user_profile') || (u.includes('rest/v1') && u.includes('notifications') === false)) && r.status() < 500;
        },
        { timeout: 90_000 },
      )
      .catch(() => null);

    await page.waitForTimeout(1500);
    await page.waitForFunction(
      () => {
        const t = document.body?.innerText || '';
        return t.includes('Uploading');
      },
      { timeout: 5_000 },
    ).catch(() => undefined);
    await page
      .waitForFunction(
        () => {
          const t = document.body?.innerText || '';
          return !t.includes('Uploading photo');
        },
        { timeout: 120_000 },
      )
      .catch(() => undefined);

    await page.waitForTimeout(1500);
    await respWait;
    if (storageHit) report.publicUrl = `${storageHit.url}${storageHit.hasAuth ? ' [auth]' : ' [no-auth]'}`;
    if (!report.supabaseStorageOk) report.err = (report.err || '') + ' | no storage upload request seen';

    await page.screenshot({ path: afterPath, fullPage: true });
    report.avatarChecks.push({
      stage: 't+0',
      avatarImageCount: await page.getByTestId('profile-avatar-image').count(),
      avatarFallbackCount: await page.getByTestId('profile-avatar-fallback').count(),
    });

    await page.waitForTimeout(15_000);
    const t10Path = path.join(outDir, '3-after-10s.png');
    await page.screenshot({ path: t10Path, fullPage: true });
    report.avatarChecks.push({
      stage: 't+15s',
      avatarImageCount: await page.getByTestId('profile-avatar-image').count(),
      avatarFallbackCount: await page.getByTestId('profile-avatar-fallback').count(),
    });

    // Tab switch away and return.
    await page.goto(`${base}/menu`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForTimeout(1200);
    await page.goto(`${base}/profile`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForTimeout(2000);
    report.avatarChecks.push({
      stage: 'after-tab-switch-return',
      avatarImageCount: await page.getByTestId('profile-avatar-image').count(),
      avatarFallbackCount: await page.getByTestId('profile-avatar-fallback').count(),
    });

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForTimeout(4000);
    const afterRefreshPath = path.join(outDir, '4-after-full-refresh.png');
    await page.screenshot({ path: afterRefreshPath, fullPage: true });
    report.avatarChecks.push({
      stage: 'after-refresh',
      avatarImageCount: await page.getByTestId('profile-avatar-image').count(),
      avatarFallbackCount: await page.getByTestId('profile-avatar-fallback').count(),
    });

    const allStagesGood = report.avatarChecks.every(
      (s) => Number(s.avatarImageCount) > 0 && Number(s.avatarFallbackCount) === 0,
    );
    report.profileRowOk = allStagesGood ? 'avatar persisted across upload, tab switch, and refresh' : 'avatar lost in one or more stages';
    report.pass = allStagesGood ? 'PASS' : 'FAIL';
    if (!allStagesGood) {
      report.line = 'profile-avatar-image missing or profile-avatar-fallback shown after upload/tab-switch/refresh';
    }
  } catch (e) {
    report.pass = 'FAIL';
    report.err = e instanceof Error ? e.message : String(e);
    report.line = 'scripts/verify-profile-avatar-runtime.mjs: exception';
  } finally {
    await browser.close();
  }
  await writeFile(
    path.join(outDir, 'RESULT.json'),
    JSON.stringify(
      { ...report, outDir, screenshots: { beforePath, afterPath, t10Path, afterRefreshPath } },
      null,
      2,
    ),
    'utf8',
  );
  console.log(JSON.stringify({ pass: report.pass, outDir, err: report.err, line: report.line }));
}

try {
  await main();
} catch (e) {
  console.log(
    JSON.stringify({ pass: 'FAIL', err: e instanceof Error ? e.message : String(e), line: 'verify-profile-avatar-runtime' }),
  );
  process.exit(1);
}
