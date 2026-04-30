import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newContext().then((c) => c.newPage());
await p.goto('https://bandits-two.vercel.app/', { waitUntil: 'domcontentloaded' });
await p.evaluate(() => {
  localStorage.removeItem('pwa_play_theatrou_done_v1');
  localStorage.removeItem('pwa_play_theatrou_stage_v1');
});
await p.goto('https://bandits-two.vercel.app/hotel/play-theatrou', { waitUntil: 'networkidle' });
for (const name of ['Flip', 'Explore the City']) {
  const btn = p.getByRole('button', { name: new RegExp(`^${name}`) });
  if (await btn.isVisible().catch(() => false)) await btn.click({ timeout: 5000 }).catch(() => {});
  await p.waitForTimeout(800);
}
await p.goto('https://bandits-two.vercel.app/profile', { waitUntil: 'networkidle' });
const buf = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAYAAAAfF3WzAAAARUlEQVQoU2NkoBAwIumfAzXx////R6KYARtgAbpGrJtY+AcGBob/gw0MDAwAAAD//w+VoQMAAAAASUVORK5CYII=', 'base64');
const el = p.getByTestId('profile-avatar-file');
if (!(await el.count())) {
  console.log(JSON.stringify({ ok: false, reason: 'no file input' }));
  await b.close();
  process.exit(0);
}
p.on('console', (m) => console.log('BROWSER:', m.text()));
p.on('pageerror', (e) => console.log('PAGEERR:', e.message));
await el.setInputFiles({ name: 't.png', mimeType: 'image/png', buffer: buf });
await p.waitForTimeout(8000);
const dom = await p.evaluate(() => ({
  testidImage: document.querySelectorAll('[data-testid="profile-avatar-image"]').length,
  testidFallback: document.querySelectorAll('[data-testid="profile-avatar-fallback"]').length,
  imgs: document.querySelectorAll('img').length,
  alerts: document.body?.innerText?.includes('Upload failed'),
}));
const img = await p.getByTestId('profile-avatar-image').count();
const fall = await p.getByTestId('profile-avatar-fallback').count();
console.log(JSON.stringify({ ok: img > 0, profileAvatarImage: img, fallback: fall, dom }, null, 2));
await b.close();
