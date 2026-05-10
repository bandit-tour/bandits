import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    // Start from Local banDits so we always enter a real guide instance.
    const ts = Date.now();
    await page.goto(`http://localhost:8081/bandits?e2e=1&ts=${ts}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    // Click the first visible CITY GUIDE CTA (opens /cityGuide?banditId=...).
    const cityGuideBtn = page.getByText('CITY GUIDE', { exact: true }).first();
    await cityGuideBtn.waitFor({ state: 'visible', timeout: 20000 });
    await cityGuideBtn.click();

    await page.waitForURL(/\/cityGuide/i, { timeout: 20000 });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'artifacts/runtime-proof/verify-unique-guide-images.png', fullPage: true });

    const collect = async () => {
      return page.evaluate(() => {
      const canonicalIdentity = (src) => {
        try {
          const u = new URL(src, window.location.href);
          const host = u.hostname.toLowerCase();
          const path = u.pathname;
          if (host.includes('maps.googleapis.com') && path.includes('/photo')) {
            return `google-photo:${u.searchParams.get('photoreference') ?? ''}`;
          }
          if (host.includes('picsum.photos') && path.includes('/seed/')) {
            const m = path.match(/\/seed\/([^/]+)/i);
            if (m?.[1]) return `picsum-seed:${decodeURIComponent(m[1])}`;
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
      };

      const imgs = Array.from(document.querySelectorAll('img'));
      const allVisible = imgs.filter((img) => {
        const rect = img.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }).length;
      const recommendationLike = imgs
        .map((img) => {
          const rect = img.getBoundingClientRect();
          const src = img.getAttribute('src') || '';
          const label =
            img.getAttribute('aria-label') ||
            img.getAttribute('alt') ||
            '';
          return { src, label, width: rect.width, height: rect.height, visible: rect.width > 0 && rect.height > 0 };
        })
        .filter((it) => it.visible)
        .filter((it) => it.width >= 220 && it.height >= 120)
        .filter((it) => !/octopus|logo|icon/i.test(it.src));

      // Only count City Guide recommendation hero images (labeled in code).
      const onlyHeroes = recommendationLike.filter((it) => String(it.label || '').startsWith('recommendation-hero:'));
      const srcs = onlyHeroes.map((it) => it.src).filter(Boolean);
      const identities = srcs.map(canonicalIdentity).filter(Boolean);
      const unique = new Set(identities);
      const duplicateIds = Array.from(unique).filter((id) => identities.filter((v) => v === id).length > 1);
      const unavailable = srcs.filter((src) => /image unavailable/i.test(src));
      const fallbackLike = srcs.filter((src) => /picsum|unsplash|photo/.test(src.toLowerCase()));
      const fallbackIdentities = fallbackLike.map(canonicalIdentity).filter(Boolean);
      const fallbackUnique = new Set(fallbackIdentities);

      return {
        allVisibleImages: allVisible,
        cardImageCount: srcs.length,
        uniqueCardImageCount: unique.size,
        duplicateCount: identities.length - unique.size,
        duplicateIdentities: duplicateIds,
        duplicateDetails: duplicateIds.map((dup) => {
          const entries = onlyHeroes
            .map((it) => ({
              identity: canonicalIdentity(it.src),
              src: it.src,
              label: it.label,
            }))
            .filter((e) => e.identity === dup);
          return { identity: dup, entries };
        }),
        unavailableCount: unavailable.length,
        fallbackCount: fallbackLike.length,
        uniqueFallbackCount: fallbackUnique.size,
        sample: srcs.slice(0, 8),
        labels: onlyHeroes.map((h) => h.label),
      };
      });
    };

    // Collect across first up-to-50 cards by swiping horizontally on mobile layout.
    const merged = {
      labels: new Set(),
      byLabel: new Map(),
    };
    for (let i = 0; i < 10; i += 1) {
      const partial = await collect();
      const rows = (partial.labels || []).map((label, idx) => ({
        label,
        src: partial.sample?.[idx] || null,
      }));
      for (const r of rows) {
        if (!r.label) continue;
        merged.labels.add(r.label);
      }
      if (merged.labels.size >= 50) break;
      await page.mouse.wheel(1200, 0);
      await page.waitForTimeout(500);
    }

    const result = await page.evaluate(() => {
      const canonicalIdentity = (src) => {
        try {
          const u = new URL(src, window.location.href);
          const host = u.hostname.toLowerCase();
          const path = u.pathname;
          if (host.includes('maps.googleapis.com') && path.includes('/photo')) {
            return `google-photo:${u.searchParams.get('photoreference') ?? ''}`;
          }
          if (host.includes('picsum.photos') && path.includes('/seed/')) {
            const m = path.match(/\/seed\/([^/]+)/i);
            if (m?.[1]) return `picsum-seed:${decodeURIComponent(m[1])}`;
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
      };

      const imgs = Array.from(document.querySelectorAll('img'));
      const allVisible = imgs.filter((img) => {
        const rect = img.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }).length;
      const recommendationLike = imgs
        .map((img) => {
          const rect = img.getBoundingClientRect();
          const src = img.getAttribute('src') || '';
          const label =
            img.getAttribute('aria-label') ||
            img.getAttribute('alt') ||
            '';
          return { src, label, width: rect.width, height: rect.height, visible: rect.width > 0 && rect.height > 0 };
        })
        .filter((it) => it.visible)
        .filter((it) => it.width >= 220 && it.height >= 120)
        .filter((it) => !/octopus|logo|icon/i.test(it.src));

      // Only count City Guide recommendation hero images (labeled in code).
      const onlyHeroes = recommendationLike.filter((it) => String(it.label || '').startsWith('recommendation-hero:'));
      const srcs = onlyHeroes.map((it) => it.src).filter(Boolean);
      const identities = srcs.map(canonicalIdentity).filter(Boolean);
      const unique = new Set(identities);
      const duplicateIds = Array.from(unique).filter((id) => identities.filter((v) => v === id).length > 1);
      const unavailable = srcs.filter((src) => /image unavailable/i.test(src));
      const fallbackLike = srcs.filter((src) => /picsum|unsplash|photo/.test(src.toLowerCase()));
      const fallbackIdentities = fallbackLike.map(canonicalIdentity).filter(Boolean);
      const fallbackUnique = new Set(fallbackIdentities);

      return {
        allVisibleImages: allVisible,
        cardImageCount: srcs.length,
        uniqueCardImageCount: unique.size,
        duplicateCount: identities.length - unique.size,
        duplicateIdentities: duplicateIds,
        duplicateDetails: duplicateIds.map((dup) => {
          const entries = onlyHeroes
            .map((it) => ({
              identity: canonicalIdentity(it.src),
              src: it.src,
              label: it.label,
            }))
            .filter((e) => e.identity === dup);
          return { identity: dup, entries };
        }),
        unavailableCount: unavailable.length,
        fallbackCount: fallbackLike.length,
        uniqueFallbackCount: fallbackUnique.size,
        sample: srcs.slice(0, 8),
      };
    });

    const pass =
      result.cardImageCount > 1 &&
      result.duplicateCount === 0 &&
      result.unavailableCount === 0 &&
      result.fallbackCount === result.uniqueFallbackCount;

    console.log(
      JSON.stringify(
        {
          status: pass ? 'PASS' : 'FAIL',
          collectedDistinctRecommendationLabels: merged.labels.size,
          ...result,
        },
        null,
        2,
      ),
    );

    if (!pass) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error('[verify-unique-guide-images] failed', error);
  process.exit(1);
});
