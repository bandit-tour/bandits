import { chromium } from 'playwright';

function canonicalIdentity(src) {
  try {
    const u = new URL(src);
    const host = u.hostname.toLowerCase();
    const path = u.pathname;
    if (host.includes('maps.googleapis.com') && path.includes('/photo')) {
      return `google-photo:${u.searchParams.get('photoreference') ?? ''}`;
    }
    if (
      host.includes('pexels.com') ||
      host.includes('unsplash.com') ||
      host.includes('supabase.co') ||
      host.includes('googleusercontent.com')
    ) {
      return `${host}${path}`.toLowerCase();
    }
    return `${host}${path}${u.search}`.toLowerCase();
  } catch {
    return String(src || '').trim().toLowerCase();
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await page.goto(`http://localhost:8081/bandits?e2e=1&ts=${Date.now()}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    const categoryChip = page.getByText(/Food|Culture|Nightlife|Shopping|Coffee/).first();
    await categoryChip.waitFor({ state: 'visible', timeout: 20000 });
    await categoryChip.click();
    await page.waitForTimeout(5000);

    const result = await page.evaluate((canonSrc) => {
      const canonical = new Function('src', `return (${canonSrc})(src);`);
      const imgs = Array.from(document.querySelectorAll('img[aria-label^="recommendation-card-image:"]'));
      const srcs = imgs.map((img) => img.getAttribute('src') || '').filter(Boolean);
      const identities = srcs.map((src) => canonical(src)).filter(Boolean);
      const unique = new Set(identities);
      const unavailable = srcs.filter((src) => /image unavailable/i.test(src));
      const dupes = Array.from(unique).filter((id) => identities.filter((v) => v === id).length > 1);
      return {
        cardImageCount: srcs.length,
        uniqueCardImageCount: unique.size,
        duplicateCount: identities.length - unique.size,
        duplicateIdentities: dupes,
        unavailableCount: unavailable.length,
        sample: srcs.slice(0, 8),
      };
    }, canonicalIdentity.toString());

    const pass = result.cardImageCount > 1 && result.duplicateCount === 0 && result.unavailableCount === 0;
    console.log(JSON.stringify({ status: pass ? 'PASS' : 'FAIL', scope: 'Bandits expanded category', ...result }, null, 2));
    if (!pass) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error('[verify-unique-expanded-guide-images] failed', error);
  process.exit(1);
});
