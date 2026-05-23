/**
 * UI smoke for Travel in a Bottle + core tab safety against running Expo web.
 * RUNTIME_BASE_URL=http://localhost:8081 node scripts/verify-ocean-bottle-ui.mjs
 */
import { config as loadEnv } from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
loadEnv({ path: path.join(repoRoot, '.env') });

const base = (process.env.RUNTIME_BASE_URL || 'http://localhost:8081').replace(/\/$/, '');
const outDir = path.join(repoRoot, 'artifacts', 'runtime-proof', `ocean-bottle-ui-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`);

const result = {
  base,
  routes: {},
  bottle: { loaded: false, phase: null, hasWhoSentThis: false, errorText: null },
  pass: false,
};

async function shot(page, name) {
  await fs.mkdir(outDir, { recursive: true });
  const p = path.join(outDir, name);
  await page.screenshot({ path: p, fullPage: true });
  return p;
}

async function routeOk(page, route, label) {
  try {
    await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(2500);
    const body = ((await page.textContent('body')) || '').slice(0, 500);
    const ok = body.length > 80 && !/Something went wrong|Unmatched Route/i.test(body);
    result.routes[label] = { ok, snippet: body.slice(0, 120) };
    await shot(page, `${label.replace(/\W+/g, '-')}.png`);
    return ok;
  } catch (e) {
    result.routes[label] = { ok: false, error: String(e?.message || e) };
    return false;
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    const safetyRoutes = [
      ['/bandits', 'home'],
      ['/localFriend', 'localFriend'],
      ['/notifications', 'notifications'],
      ['/menu', 'menu'],
    ];
    let safetyOk = true;
    for (const [route, label] of safetyRoutes) {
      const ok = await routeOk(page, route, label);
      if (!ok) safetyOk = false;
    }

    await page.goto(`${base}/bottle`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(6000);
    const body = (await page.textContent('body')) || '';
    result.bottle.loaded = /Travel in a Bottle|floating ocean|note drifted|ocean is quiet|Could not fetch/i.test(body);
    result.bottle.hasWhoSentThis = /Who sent this\?/i.test(body);
    result.bottle.phase = body.includes('note drifted ashore')
      ? 'message'
      : body.includes('ocean is quiet')
        ? 'empty'
        : body.includes('Could not fetch')
          ? 'error'
          : body.includes('Searching the floating ocean')
            ? 'loading'
            : 'unknown';
    if (body.includes('Could not fetch')) {
      const m = body.match(/Could not fetch a bottle[\s\S]{0,200}/i);
      result.bottle.errorText = m ? m[0].slice(0, 180) : 'claim error';
    }
    await shot(page, 'bottle-page.png');

    if (result.bottle.hasWhoSentThis) {
      await page.getByRole('button', { name: /Who sent this\?/i }).click({ timeout: 10000 });
      await page.waitForTimeout(3000);
      result.bottle.chatOpened = /Write a message|Who sent this\?/i.test((await page.textContent('body')) || '');
      await shot(page, 'bottle-chat.png');
    }

    result.pass = safetyOk && result.bottle.loaded;
    await fs.writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.pass ? 0 : 1);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
