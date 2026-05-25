/**
 * Web smoke on iPhone + Android viewports (production). Complements Expo Go manual checks.
 * RUNTIME_BASE_URL=https://bandits-two.vercel.app node scripts/verify-ocean-bottle-mobile-viewports.mjs
 */
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { chromium, devices } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv({ path: path.join(root, '.env') });

const base = (process.env.RUNTIME_BASE_URL || 'https://bandits-two.vercel.app').replace(/\/$/, '');
const outDir = path.join(
  root,
  'artifacts',
  'runtime-proof',
  `ocean-bottle-mobile-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
);

const profiles = [
  { name: 'iphone', device: devices['iPhone 14'] },
  { name: 'android', device: devices['Pixel 7'] },
];

async function checkBottle(page, label) {
  await page.goto(`${base}/bottle`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(9000);
  const body = (await page.textContent('body')) || '';
  const whoSent =
    (await page.getByTestId('bottle-who-sent-discover').count()) > 0 ||
    /Who sent this\?/i.test(body);
  const pass =
    (/message in a bottle has arrived/i.test(body) ||
      /Someone sent this into the city/i.test(body) ||
      /banDit Moment/i.test(body)) &&
    whoSent &&
    ((await page.getByRole('button', { name: /^Flip$/i }).count()) > 0 ||
      /Explore the City/i.test(body) ||
      (await page.getByRole('button', { name: /Explore the City/i }).count()) > 0);
  await fs.mkdir(outDir, { recursive: true });
  await page.screenshot({ path: path.join(outDir, `${label}-bottle.png`), fullPage: true });
  return pass;
}

async function main() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) throw new Error('Missing Supabase env');

  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  async function enqueueFloat(tagSuffix) {
    const { data: auth } = await anon.auth.signInAnonymously();
    const token = auth.session?.access_token;
    if (!token) throw new Error('anon auth failed');
    const rootId = crypto.randomUUID();
    const tag = `mobile-vp-${Date.now()}-${tagSuffix}`;
    const sendRes = await fetch(`${base}/api/operator-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        kind: 'local_friend',
        threadRootId: rootId,
        title: 'Mobile VP Sender',
        message: `${tag} floating for mobile viewport`,
        guestTitle: 'Local Friend request sent',
      }),
    });
    if (!sendRes.ok) throw new Error(`enqueue failed: ${sendRes.status}`);
    return tag;
  }

  const browser = await chromium.launch({ headless: true });
  const results = {};
  try {
    for (const { name, device } of profiles) {
      await enqueueFloat(name);
      const ctx = await browser.newContext({ ...device });
      const page = await ctx.newPage();
      results[name] = await checkBottle(page, name);
      await ctx.close();
    }
    const pass = Object.values(results).every(Boolean);
    const payload = { base, results, pass };
    await fs.writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(payload, null, 2));
    console.log(JSON.stringify(payload, null, 2));
    process.exit(pass ? 0 : 1);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
