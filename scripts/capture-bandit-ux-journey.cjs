const { chromium, devices } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  const shots = 'tmp/bandit-ux-shots';
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function shot(url, name) {
    console.log('NAV', url);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
    } catch {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    }
    await wait(3500);
    await page.screenshot({ path: `${shots}/${name}.png`, fullPage: false });
    console.log('OK', name);
  }

  await shot('http://localhost:8081/home', '01-home');
  await shot('http://localhost:8081/bandits', '02-discovery');

  await page.goto('http://localhost:8081/bandits', { waitUntil: 'domcontentloaded' });
  await wait(4000);
  const meet = page.getByText(/^Meet /).first();
  if ((await meet.count()) > 0) {
    await meet.click();
    await wait(4000);
    await page.screenshot({ path: `${shots}/03-profile.png`, fullPage: false });
    console.log('OK 03-profile');
    const url = page.url();
    const m = url.match(/bandit\/([^/?#]+)/);
    const id = m ? m[1] : null;
    console.log('BANDIT', id);
    if (id) {
      await shot(`http://localhost:8081/cityGuide?banditId=${id}`, '04-city-guide');
      await shot(`http://localhost:8081/vibe/${id}`, '05-routes');
      await shot(`http://localhost:8081/premium/${id}`, '06-premium');
    }
  } else {
    console.log('NO MEET BUTTON');
    await page.screenshot({ path: `${shots}/03-profile-missing.png`, fullPage: false });
  }

  await browser.close();
  console.log('DONE');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
