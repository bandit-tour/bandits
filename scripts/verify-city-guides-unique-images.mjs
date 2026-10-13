import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

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
    if (!(key in process.env)) process.env[key] = value;
  }
}

function canonicalIdentity(src) {
  try {
    const u = new URL(src);
    const host = u.hostname.toLowerCase();
    const p = u.pathname;
    if (host.includes('maps.googleapis.com') && p.includes('/photo')) {
      return `google-photo:${u.searchParams.get('photoreference') ?? ''}`;
    }
    if (
      host.includes('pexels.com') ||
      host.includes('unsplash.com') ||
      host.includes('supabase.co') ||
      host.includes('googleusercontent.com')
    ) {
      return `${host}${p}`.toLowerCase();
    }
    return `${host}${p}${u.search}`.toLowerCase();
  } catch {
    return String(src || '').trim().toLowerCase();
  }
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), '.env'));
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error('Missing Supabase env vars');
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: bandits, error } = await supabase.from('bandit').select('id,name').limit(12);
  if (error) throw error;
  const ids = (bandits ?? []).map((b) => b.id);
  if (ids.length === 0) throw new Error('No bandits found');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const checks = [];

  try {
    for (const id of ids) {
      await page.goto(`http://localhost:8081/cityGuide?banditId=${encodeURIComponent(id)}&e2e=1&ts=${Date.now()}`, {
        waitUntil: 'networkidle',
      });
      await page.waitForTimeout(3500);

      const result = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img[aria-label^="recommendation-hero:"]'));
        const srcs = imgs.map((img) => img.getAttribute('src') || '').filter(Boolean);
        return {
          cardImageCount: srcs.length,
          srcs,
        };
      });

      const identities = result.srcs.map(canonicalIdentity).filter(Boolean);
      const unique = new Set(identities);
      const duplicateCount = identities.length - unique.size;
      const unavailableCount = result.srcs.filter((s) => /image unavailable/i.test(s)).length;

      checks.push({
        banditId: id,
        cardImageCount: result.cardImageCount,
        duplicateCount,
        unavailableCount,
      });
    }
  } finally {
    await browser.close();
  }

  const failing = checks.filter((c) => c.cardImageCount > 1 && (c.duplicateCount > 0 || c.unavailableCount > 0));
  const output = {
    status: failing.length === 0 ? 'PASS' : 'FAIL',
    checkedGuides: checks.length,
    failingGuides: failing.length,
    checks,
  };
  console.log(JSON.stringify(output, null, 2));
  if (failing.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error('[verify-city-guides-unique-images] failed', err);
  process.exit(1);
});
