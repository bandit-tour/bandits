import { chromium } from 'playwright';

function canonicalIdentity(src) {
  try {
    const u = new URL(src, 'http://localhost:8081');
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

    const neoText = page.getByText(/Neo/i).first();
    await neoText.waitFor({ state: 'visible', timeout: 20000 });
    const cityGuideBtn = page.getByText('CITY GUIDE', { exact: true }).first();
    await cityGuideBtn.waitFor({ state: 'visible', timeout: 20000 });
    await cityGuideBtn.click();

    await page.waitForURL(/\/cityGuide/i, { timeout: 20000 });
    await page.waitForTimeout(5000);

    const result = await page.evaluate(() => {
      const url = window.location.href;
      const titleHit = document.body?.innerText?.includes('Recommended picks') ?? false;
      const totalImgCount = document.querySelectorAll('img').length;
      const nodes = Array.from(document.querySelectorAll('img')).filter((img) => {
        const label = img.getAttribute('aria-label') || img.getAttribute('alt') || '';
        return label.startsWith('recommendation-hero:');
      });
      const items = nodes.map((img) => ({
        label: img.getAttribute('aria-label') || img.getAttribute('alt') || '',
        src: img.getAttribute('src') || '',
      }));
      return {
        url,
        titleHit,
        totalImgCount,
        count: items.length,
        items,
      };
    });

    const identities = result.items.map((it) => canonicalIdentity(it.src));
    const unique = new Set(identities);
    const duplicateKeys = Array.from(unique).filter((k) => identities.filter((x) => x === k).length > 1);

    console.log(
      JSON.stringify(
        {
          url: result.url,
          titleHit: result.titleHit,
          totalImgCount: result.totalImgCount,
          count: result.count,
          uniqueCount: unique.size,
          duplicateCount: identities.length - unique.size,
          duplicateKeys,
          items: result.items.slice(0, 20),
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error('[debug-neo-city-guide-images] failed', error);
  process.exit(1);
});
