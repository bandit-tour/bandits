import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'https://bandits-two.vercel.app';
const email = process.env.PLAY_OPERATOR_EMAIL || 'blonje@gmail.com';
const password = process.env.PLAY_OPERATOR_PASSWORD || process.env.E2E_ADMIN_PASSWORD || '121275';

const result = {
  base,
  anonymous: {
    hasHotelier: false,
    hasPilotDesk: false,
    hasSignInCard: false,
  },
  signedIn: {
    urlAfterLogin: '',
    hasHotelier: false,
    hasPilotDesk: false,
    openedHotelier: false,
    openedPilotDesk: false,
    textHotelierCount: 0,
    textPilotCount: 0,
    visibleHotelierCount: 0,
    visiblePilotCount: 0,
    visibleTextsSample: [],
  },
  pass: false,
  errors: [],
};

function hasButtonNamed(names, target) {
  return names.some((n) => String(n || '').trim().toLowerCase() === target.toLowerCase());
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1365, height: 920 } });
const page = await ctx.newPage();

try {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  await page.goto(`${base}/menu`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(1800);

  const anonButtons = (await page.getByRole('button').allInnerTexts()).map((t) => t.trim());
  const anonBody = (await page.textContent('body')) || '';
  result.anonymous.hasHotelier = hasButtonNamed(anonButtons, 'Hotelier');
  result.anonymous.hasPilotDesk = hasButtonNamed(anonButtons, 'Pilot Desk');
  result.anonymous.hasSignInCard = /Sign in with email/i.test(anonBody);

  await page.getByText('Sign in with email', { exact: false }).first().click({ timeout: 10000 });
  await page.waitForURL('**/login**', { timeout: 20000 });
  await page.fill('input[placeholder="Enter your email"]', email);
  await page.fill('input[placeholder="Enter your password"]', password);
  await page.getByTestId('email-auth-submit').click({ timeout: 10000 });
  await page.waitForTimeout(2500);
  result.signedIn.urlAfterLogin = page.url();
  if (!page.url().includes('/menu')) {
    await page.goto(`${base}/menu`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(1800);
    result.signedIn.urlAfterLogin = page.url();
  }
  await page.waitForTimeout(2500);

  const signedButtons = (await page.getByRole('button').allInnerTexts()).map((t) => t.trim());
  result.signedIn.hasHotelier = hasButtonNamed(signedButtons, 'Hotelier');
  result.signedIn.hasPilotDesk = hasButtonNamed(signedButtons, 'Pilot Desk');
  result.signedIn.textHotelierCount = await page.getByText('Hotelier', { exact: false }).count();
  result.signedIn.textPilotCount = await page.getByText('Pilot Desk', { exact: false }).count();
  const vis = await page.evaluate(() => {
    const out = [];
    const nodes = Array.from(document.querySelectorAll('body *'));
    for (const el of nodes) {
      const txt = (el.textContent || '').trim();
      if (!txt || txt.length > 64) continue;
      const r = (el).getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const visible =
        r.width > 2 &&
        r.height > 2 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        Number(style.opacity || '1') > 0;
      if (visible) out.push(txt);
    }
    return out;
  });
  result.signedIn.visibleHotelierCount = vis.filter((t) => t === 'Hotelier').length;
  result.signedIn.visiblePilotCount = vis.filter((t) => t === 'Pilot Desk').length;
  result.signedIn.visibleTextsSample = vis.slice(0, 60);

  await page.goto(`${base}/hotelier`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(1500);
  result.signedIn.openedHotelier = page.url().includes('/hotelier');

  await page.goto(`${base}/operatorDesk`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(1500);
  result.signedIn.openedPilotDesk = page.url().includes('/operatorDesk');

  result.pass =
    result.anonymous.hasSignInCard &&
    !result.anonymous.hasPilotDesk &&
    result.signedIn.hasHotelier &&
    result.signedIn.hasPilotDesk &&
    result.signedIn.openedHotelier &&
    result.signedIn.openedPilotDesk;
} catch (e) {
  result.errors.push(e instanceof Error ? e.message : String(e));
} finally {
  await browser.close();
}

console.log(JSON.stringify(result, null, 2));
