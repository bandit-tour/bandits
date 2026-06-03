/**
 * Verify /bandit/[id] hides upper-tab overlay and is not masked by Local banDits.
 * RUNTIME_BASE_URL=https://bandits-two.vercel.app node scripts/verify-bandit-profile-navigation.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const base = (process.env.RUNTIME_BASE_URL || 'https://bandits-two.vercel.app').replace(/\/$/, '');
const outDir = path.join(
  __dirname,
  '..',
  'artifacts',
  'runtime-proof',
  `bandit-profile-nav-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
);

const result = { base, checks: {}, pass: false };

async function runViewport(name, contextOptions) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const checks = {};

  try {
    await page.goto(`${base}/explore`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(2000);

    const avatar = page.locator('[data-testid^="event-card-bandit-avatar-"]').first();
    const avatarCount = await avatar.count();
    checks.hasRecommenderAvatar = avatarCount > 0;

    if (avatarCount > 0) {
      const testId = await avatar.getAttribute('data-testid');
      const banditId = testId?.replace('event-card-bandit-avatar-', '') ?? '';
      checks.banditIdExtracted = banditId.length > 8;

      await avatar.click();
      await page.waitForTimeout(1500);
      checks.urlIsBanditProfile = /\/bandit\//.test(page.url()) && !page.url().includes('/bandits');
      checks.urlContainsId = banditId ? page.url().includes(encodeURIComponent(banditId)) || page.url().includes(banditId) : false;

      const upperBanditsTab = page.getByRole('tab', { name: /Local banDits/i });
      checks.upperOverlayHidden = !(await upperBanditsTab.isVisible().catch(() => false));

      const body = (await page.textContent('body')) || '';
      checks.profileContent = body.length > 200 && !/Unmatched Route/i.test(body);
    }

    await fs.mkdir(outDir, { recursive: true });
    await page.screenshot({ path: path.join(outDir, `${name}-bandit-profile.png`), fullPage: true });

    checks.pass =
      checks.hasRecommenderAvatar &&
      checks.urlIsBanditProfile &&
      checks.upperOverlayHidden &&
      checks.profileContent;
    result.checks[name] = checks;
  } catch (e) {
    result.checks[name] = { pass: false, error: String(e?.message || e) };
  } finally {
    await browser.close();
  }
}

async function main() {
  await runViewport('iphone', devices['iPhone 13']);
  await runViewport('android', devices['Pixel 5']);
  result.pass = Object.values(result.checks).every((c) => c.pass);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.pass ? 0 : 1);
}

void main();
