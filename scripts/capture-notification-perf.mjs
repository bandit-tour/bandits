/**
 * Screenshots + rough DOM timing for inbox / chat open (requires `npx expo start --web`).
 * BANDITS_WEB_BASE default http://127.0.0.1:8084
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.BANDITS_WEB_BASE ?? 'http://127.0.0.1:8084';
const out = 'artifacts/runtime-proof/notification-perf';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

try {
  const inboxUrl = `${base}/inbox`;
  const t0 = Date.now();
  await page.goto(inboxUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  const tDom = Date.now() - t0;
  await page.waitForSelector('[data-testid="inbox-section-list"]', { timeout: 90_000 });
  const tList = Date.now() - t0;
  await page.screenshot({ path: `${out}/01-inbox-list-chrome.png`, fullPage: true });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/02-inbox-after-2_5s.png`, fullPage: true });

  const chatUrl = `${base}/chat?banditName=Local%20Friend&notificationId=demo-seed&notificationType=local_friend&referenceId=user-ref&notificationTitle=Test%20title&notificationMessage=Test%20message%20body`;
  const c0 = Date.now();
  await page.goto(chatUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForSelector('[data-testid="chat-thread-list"]', { timeout: 90_000 });
  const tChatList = Date.now() - c0;
  await page.screenshot({ path: `${out}/03-chat-seeded-thread.png`, fullPage: true });

  const summary = {
    inbox_domcontentloaded_ms: tDom,
    inbox_section_list_ms: tList,
    chat_thread_list_visible_ms: tChatList,
    note: 'Network-dependent; compare same machine before/after code changes.',
  };
  await import('node:fs/promises').then((fs) =>
    fs.writeFile(`${out}/timing-summary.json`, JSON.stringify(summary, null, 2), 'utf8'),
  );
  console.log(JSON.stringify(summary, null, 2));
  console.log('Screenshots in', out);
} finally {
  await browser.close();
}
