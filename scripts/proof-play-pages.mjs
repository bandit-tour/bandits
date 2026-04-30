import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const base = process.env.PROFILE_VERIFY_BASE || 'http://localhost:8081';
const outDir = path.join(root, 'artifacts', 'runtime-proof', `play-pages-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`);

const shots = {
  home: path.join(outDir, '1-home.png'),
  alerts: path.join(outDir, '2-alerts.png'),
  localFriend: path.join(outDir, '3-local-friend.png'),
  profile: path.join(outDir, '4-profile.png'),
  menu: path.join(outDir, '5-menu.png'),
};

const report = { pass: 'PASS', outDir, screenshots: shots, errors: [] };

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const steps = [
  ['/hotel/play-theatrou', 'home'],
  ['/alerts', 'alerts'],
  ['/localFriend', 'localFriend'],
  ['/profile', 'profile'],
  ['/menu', 'menu'],
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

try {
  await mkdir(outDir, { recursive: true });
  for (const [route, key] of steps) {
    await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await wait(3500);
    await page.screenshot({ path: shots[key], fullPage: true });
  }
} catch (e) {
  report.pass = 'FAIL';
  report.errors.push(e instanceof Error ? e.message : String(e));
} finally {
  await browser.close();
}

await writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report));
