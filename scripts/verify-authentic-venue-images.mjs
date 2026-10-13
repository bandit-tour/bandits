/**
 * Verifies City Guide recommendation heroes for known venues use Google Place photos.
 *
 *   VERIFY_BASE_URL=http://localhost:8082 node scripts/verify-authentic-venue-images.mjs
 *
 * Optionally set VERIFY_CITY_GUIDE_BANDIT_ID, or the script picks the bandit linked to the most targets via Supabase.
 *
 * **Important:** Playwright drives **browser** Expo Web only. Neutral SVG placeholders ("Image pending verification") and
 * image loading differ from native. **Production acceptance is a real iPhone build:** each recommendation must show that
 * venue's authentic Google Place photo -- no generics, no repeated stock/category images, no empty placeholders.
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const TARGETS = String(
  process.env.VERIFY_VENUE_NAMES ||
    'Dybbuk Club,Anglais Athens Rooftop Bar,Room Epoque Vintage Boutique,Peas Vegan',
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value === '') continue;
    if (String(process.env[key] ?? '').trim() === '') process.env[key] = value;
  }
}

function classifyImage(src) {
  const s = String(src || '').trim().toLowerCase();
  if (!s) return 'missing';
  if (s.startsWith('data:image/svg+xml')) return 'neutral-placeholder';
  if (s.includes('maps.googleapis.com/maps/api/place/photo')) return 'google-place-photo';
  if (s.includes('places.googleapis.com/v1/places') && s.includes('/media')) return 'google-place-photo';
  if (s.includes('googleusercontent.com') || s.includes('ggpht.com')) return 'google-cdn';
  if (s.includes('pexels.com') || s.includes('unsplash.com') || s.includes('picsum.photos')) return 'stock';
  return 'other';
}

function isPassKind(kind) {
  return kind === 'google-place-photo' || kind === 'google-cdn';
}

async function pickBanditCoveringTargets() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key =
    String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim() ||
    String(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
  if (!url || !key || TARGETS.length === 0) return null;

  const supabase = createClient(url, key);
  const scores = new Map();

  for (const name of TARGETS) {
    const { data: ev, error: e1 } = await supabase.from('event').select('id').eq('name', name).maybeSingle();
    if (e1 || !ev?.id) continue;
    const { data: links, error: e2 } = await supabase.from('bandit_event').select('bandit_id').eq('event_id', ev.id);
    if (e2) continue;
    for (const row of links ?? []) {
      const bid = row?.bandit_id;
      if (!bid) continue;
      scores.set(bid, (scores.get(bid) ?? 0) + 1);
    }
  }

  const best = [...scores.entries()].sort((a, b) => b[1] - a[1])[0];
  return best?.[0] ?? null;
}

async function inspectCurrentGuide(page, unresolved) {
  return page.evaluate(
    ({ targets }) => {
      const classify = (src) => {
        const s = String(src || '').trim().toLowerCase();
        if (!s) return 'missing';
        if (s.startsWith('data:image/svg+xml')) return 'neutral-placeholder';
        if (s.includes('maps.googleapis.com/maps/api/place/photo')) return 'google-place-photo';
        if (s.includes('places.googleapis.com/v1/places') && s.includes('/media')) return 'google-place-photo';
        if (s.includes('googleusercontent.com') || s.includes('ggpht.com')) return 'google-cdn';
        if (s.includes('pexels.com') || s.includes('unsplash.com') || s.includes('picsum.photos')) return 'stock';
        return 'other';
      };

      const rows = [];
      const heroes = Array.from(document.querySelectorAll('img[aria-label^="recommendation-hero:"]'));
      for (const hero of heroes) {
        let card = hero.parentElement;
        while (card && !String(card.innerText || '').includes('Open')) card = card.parentElement;
        const text = String(card?.innerText || '');
        const src = hero.getAttribute('src') || '';
        for (const venue of targets) {
          if (text.toLowerCase().includes(venue.toLowerCase())) {
            rows.push({ venue, src, kind: classify(src) });
          }
        }
      }
      return rows;
    },
    { targets: unresolved },
  );
}

async function scanGuidesViaCta(page, baseUrl, results) {
  const guideCount = await page.getByText('CITY GUIDE', { exact: true }).count();
  for (let i = 0; i < guideCount; i += 1) {
    const unresolved = TARGETS.filter((v) => !results[v]);
    if (unresolved.length === 0) break;
    if (i > 0) {
      await page.goto(`${baseUrl}/bandits?e2e=1&ts=${Date.now()}-${i}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
    }
    const btn = page.getByText('CITY GUIDE', { exact: true }).nth(i);
    if ((await btn.count()) === 0) continue;
    await btn.click();
    await page.waitForURL(/\/cityGuide/i, { timeout: 20000 });
    await page.waitForTimeout(5500);

    const found = await inspectCurrentGuide(page, unresolved);
    for (const row of found) {
      if (!results[row.venue]) {
        results[row.venue] = { src: row.src, kind: row.kind };
      }
    }
  }
}

async function run() {
  loadEnvFile(path.resolve(process.cwd(), '.env'));
  loadEnvFile(path.resolve(process.cwd(), '.env.local'));

  console.warn(
    "[verify-authentic-venue-images] Browser-only smoke test. Authoritative PASS/FAIL is a real iPhone: each recommendation must show that venue's authentic Google Place photo (no generics, repeats, or empty placeholders).",
  );

  const baseUrl = process.env.VERIFY_BASE_URL || 'http://localhost:8082';
  const banditIdEnv = String(process.env.VERIFY_CITY_GUIDE_BANDIT_ID ?? '').trim();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const results = {};

  try {
    const banditId = banditIdEnv || (await pickBanditCoveringTargets());

    if (banditId) {
      await page.goto(
        `${baseUrl}/cityGuide?banditId=${encodeURIComponent(banditId)}&e2e=1&ts=${Date.now()}`,
        { waitUntil: 'networkidle' },
      );
      await page.waitForURL(/\/cityGuide/i, { timeout: 25000 });
      await page.waitForTimeout(8000);

      const found = await inspectCurrentGuide(page, TARGETS);
      for (const row of found) {
        if (!results[row.venue]) {
          results[row.venue] = { src: row.src, kind: row.kind };
        }
      }
    }

    const stillMissing = TARGETS.filter((v) => !results[v]);
    if (stillMissing.length > 0) {
      await page.goto(`${baseUrl}/bandits?e2e=1&ts=${Date.now()}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2500);
      await scanGuidesViaCta(page, baseUrl, results);
    }
  } finally {
    await browser.close();
  }

  const report = TARGETS.map((venue) => {
    const hit = results[venue];
    if (!hit) return { venue, status: 'NOT_FOUND', kind: 'missing', src: '' };
    const kind = classifyImage(hit.src);
    const status = isPassKind(kind) ? 'PASS' : 'FAIL';
    return { venue, status, kind, src: hit.src?.slice(0, 220) ?? '' };
  });

  const failed = report.filter((r) => r.status !== 'PASS');
  const allPass = failed.length === 0;

  console.log(
    JSON.stringify(
      {
        baseUrl,
        overall: allPass ? 'PASS' : 'FAIL',
        report,
        failedCount: failed.length,
      },
      null,
      2,
    ),
  );

  if (!allPass) process.exit(1);
}

run().catch((err) => {
  console.error('[verify-authentic-venue-images] failed', err);
  process.exit(1);
});
