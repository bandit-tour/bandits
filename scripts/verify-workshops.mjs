import { chromium } from "playwright";
import fs from "fs";

const OUT = "artifacts/image-pass";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto("http://localhost:8081/experiences", {
  waitUntil: "domcontentloaded",
  timeout: 90000,
});
await page.waitForTimeout(5000);

const info = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('[data-testid="exp-filter-Workshops"]')];
  return btns.map((b, i) => {
    const r = b.getBoundingClientRect();
    let p = b.parentElement;
    let opacity = "1";
    while (p) {
      const o = getComputedStyle(p).opacity;
      if (o && o !== "1") {
        opacity = o;
        break;
      }
      p = p.parentElement;
    }
    return { i, w: r.width, h: r.height, top: r.top, left: r.left, opacity };
  });
});
console.log("chips", JSON.stringify(info, null, 2));

await page.evaluate(() => {
  const btns = [...document.querySelectorAll('[data-testid="exp-filter-Workshops"]')];
  for (const b of btns) {
    let p = b;
    let hidden = false;
    while (p) {
      if (getComputedStyle(p).opacity === "0") {
        hidden = true;
        break;
      }
      p = p.parentElement;
    }
    if (!hidden) {
      b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      return "clicked-visible";
    }
  }
  return "none";
});

await page.waitForTimeout(2500);

const after = await page.evaluate(() => {
  const visibleChips = [...document.querySelectorAll('[data-testid^="exp-filter-"]')].filter((b) => {
    let p = b;
    while (p) {
      if (getComputedStyle(p).opacity === "0") return false;
      p = p.parentElement;
    }
    return true;
  });
  const resultMeta = [...document.querySelectorAll("div")]
    .map((d) => (d.textContent || "").trim())
    .filter((t) => /^\d+ experiences/.test(t))
    .slice(0, 6);
  return {
    chips: visibleChips.map((b) => ({
      id: b.getAttribute("data-testid"),
      selected: b.getAttribute("aria-selected"),
    })),
    resultMeta,
  };
});
console.log("after", JSON.stringify(after, null, 2));

const client = await page.context().newCDPSession(page);
const { data } = await client.send("Page.captureScreenshot", {
  format: "png",
  fromSurface: true,
});
fs.writeFileSync(`${OUT}/desktop-experiences-workshops.png`, Buffer.from(data, "base64"));
console.log("saved workshops");

await browser.close();
