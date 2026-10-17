/**
 * Product recovery Octopus O1–O6 — browser evidence.
 * Guest :8082 · Workspace via __workspace (localhost :3000 when dev).
 */
import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env", quiet: true });
config({ path: ".env.development.local", override: true, quiet: true });

const GUEST = process.env.RUNTIME_BASE_URL || "http://localhost:8082";
const WS = (process.env.WORKSPACE_API_BASE || `${GUEST}/__workspace`).replace(/\/$/, "");
const NEO = "d76cb120-018d-4a2e-8b5f-0578a71fd8f9";
const LUKAS = "218e9d35-f9cf-400c-aeae-60b14f86e7c7";
const OUT = path.resolve(
  process.env.PRODUCT_RECOVERY_OUT || "artifacts/runtime-proof/product-recovery-octopus",
);
const BRIDGE = {
  Accept: "application/json",
  "Content-Type": "application/json",
  "X-Guest-Bridge": process.env.GUEST_BRIDGE_SECRET || "banditour-guest-bridge-2026",
  "X-Guest-QA": "1",
};

fs.mkdirSync(OUT, { recursive: true });

const report = { at: new Date().toISOString(), guest: GUEST, tests: {} };

function record(id, status, extra = {}) {
  report.tests[id] = { status, ...extra };
  console.log(`[${status}] ${id}`, extra.reason || extra.route || "");
}

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function api(pathRel, email, { method = "GET", body } = {}) {
  const r = await fetch(`${WS}${pathRel}`, {
    method,
    headers: { ...BRIDGE, "X-Guest-Email": email || "guest@banditour.demo" },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = {};
  try {
    json = await r.json();
  } catch {
    /* */
  }
  return { status: r.status, json };
}

async function createGuest() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const email = `octo.recovery.${Date.now().toString(36)}@banditour.proof`;
  const password = "banditour2026";
  if (!url || !key) return { email, password, ok: false };
  const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  return { email, password, ok: !error && Boolean(data?.user), error: error?.message };
}

async function signIn(page, email, password) {
  await page.goto(`${GUEST}/login?forceAuth=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector('input[type="email"]', { timeout: 60000 });
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  const btn = page.getByText("Sign in", { exact: true });
  await btn.nth((await btn.count()) - 1).click();
  await page.waitForTimeout(4000);
  return !page.url().includes("/login");
}

async function waitPremiumReady(page) {
  await page
    .waitForFunction(
      () => {
        const t = document.body?.innerText || "";
        return (
          /Unlock Your Local Insider|€19|Ask My banDit|not available|Checkout unavailable/i.test(t) &&
          !/Checking Premium Insights access/i.test(t)
        );
      },
      { timeout: 120000 },
    )
    .catch(() => {});
  await page.waitForTimeout(600);
}

(async () => {
  const guest = await createGuest();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newContext({ viewport: { width: 390, height: 844 } }).then((c) => c.newPage());

  await page.addInitScript(() => {
    try {
      localStorage.setItem("@bandits_opening_intro_v2", "1");
      for (const k of Object.keys(localStorage)) {
        if (/discovery|guestDiscovery|bandit_local_insider/i.test(k)) localStorage.removeItem(k);
      }
    } catch {
      /* */
    }
  });

  const loggedIn = guest.ok ? await signIn(page, guest.email, guest.password) : false;
  if (!loggedIn) {
    record("auth", "BLOCKED", { reason: "Could not sign in test guest", source: "Supabase" });
  }

  // O1 — profile progressive journey CTA (BanditHeader)
  await page.goto(`${GUEST}/bandit/${NEO}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(2500);
  await page
    .waitForSelector('[data-testid="bandit-premium-insights-cta"]', { timeout: 45000 })
    .catch(() => {});
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="bandit-premium-insights-cta"]');
    if (el) el.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(500);
  const o1Visible = (await page.getByTestId("bandit-premium-insights-cta").count()) > 0;
  await shot(page, "O1-profile-journey-cta.png");
  record("O1", o1Visible ? "PASS" : "FAIL", {
    route: `/bandit/${NEO}`,
    source: "BanditHeader showPremiumInsights",
    reason: o1Visible ? "Your Local Insider CTA visible" : "bandit-premium-insights-cta missing",
  });

  // O2 — capability chip (bandit-card-capabilities / OrchestraStrip)
  await page
    .waitForFunction(
      () => {
        const t = document.body?.innerText || "";
        return /Premium Insights|\bPremium\b/i.test(t) && /Octopus Verified/i.test(t);
      },
      { timeout: 20000 },
    )
    .catch(() => {});
  const bodyO2 = await page.locator("body").innerText();
  const o2Chip =
    (await page.getByTestId("bandit-premium-insights-chip").count()) > 0 ||
    (/Premium Insights|\bPremium\b/i.test(bodyO2) && /Octopus Verified/i.test(bodyO2));
  await shot(page, "O2-profile-premium-chip.png");
  record("O2", o2Chip ? "PASS" : "FAIL", {
    route: `/bandit/${NEO}`,
    source: "BanditOrchestraStrip → buildBanditCardCapabilities",
    reason: o2Chip ? "Premium Insights chip visible" : "bandit-premium-insights-chip missing",
  });

  // O3 — journey discovery → PremiumUnlockModal
  const journeyCard = page.getByTestId("bandit-journey-local-insider");
  let o3Pass = false;
  if ((await journeyCard.count()) > 0) {
    await journeyCard.getByText(/See Stay Pass offer/i).click();
    await page.waitForTimeout(800);
    const modalText = await page.locator('[data-testid="premium-unlock-modal"]').innerText().catch(() => "");
    o3Pass = /€19|Unlock Stay Pass/i.test(modalText);
    await shot(page, "O3-journey-unlock-modal.png");
  } else {
    await shot(page, "O3-journey-unlock-modal.png");
  }
  record("O3", o3Pass ? "PASS" : journeyCard.count() ? "FAIL" : "BLOCKED", {
    route: `/bandit/${NEO}`,
    source: "GuestDiscoveryCard → PremiumUnlockModal",
    reason: o3Pass
      ? "Modal shows €19 Stay Pass offer"
      : journeyCard.count()
        ? "Modal missing or no €19 copy"
        : "Discovery card hidden (visibility)",
  });

  // O4 — non-entitled guest cannot bypass (fresh user, Neo premium, no unlock click)
  if (loggedIn) {
    await page.goto(`${GUEST}/premium/${NEO}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await waitPremiumReady(page);
    const body4 = await page.locator("body").innerText();
    const opsWithoutPay = /Ask My banDit/i.test(body4) && !/Unlock Your Local Insider/i.test(body4);
    await shot(page, "O4-no-bypass-unpaid.png");
    record("O4", opsWithoutPay ? "FAIL" : "PASS", {
      route: `/premium/${NEO}`,
      source: "resolveOctopusConciergeEntitlement + assertConciergeOpsAllowed",
      reason: opsWithoutPay
        ? "Concierge OS visible before payment"
        : "Sales gate or unlock shown — ops not exposed unpaid",
    });
  } else {
    record("O4", "BLOCKED", { reason: "No auth" });
  }

  // O5 — Stripe TEST / treasury checkout + entitlement
  if (loggedIn) {
    await page.goto(`${GUEST}/premium/${NEO}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await waitPremiumReady(page);
    const unlock = page.getByTestId("local-insider-unlock-cta").first();
    let o5 = "BLOCKED";
    let o5Reason = "No unlock CTA";
    if ((await unlock.count()) > 0) {
      await unlock.click();
      const t0 = Date.now();
      let confirmed = false;
      for (let i = 0; i < 45; i++) {
        const t = await page.locator("body").innerText();
        if (/Ask My banDit/i.test(t) && !/Confirming/i.test(t)) {
          confirmed = true;
          break;
        }
        if (/Checkout timed out|Checkout failed|not authorized/i.test(t) && !/Confirming/i.test(t)) break;
        if (Date.now() - t0 > 55000) break;
        await page.waitForTimeout(1500);
      }
      await shot(page, "O5-test-payment-entitlement.png");
      o5 = confirmed ? "PASS" : "FAIL";
      o5Reason = confirmed
        ? "TEST/treasury payment confirmed — Concierge OS unlocked"
        : "Payment did not confirm to ACTIVE";
    } else {
      await shot(page, "O5-test-payment-entitlement.png");
    }
    record("O5", o5, {
      route: `/premium/${NEO}`,
      source: "startOctopusConciergeCheckout → Workspace purchaseStayPass",
      reason: o5Reason,
    });
  } else {
    record("O5", "BLOCKED", { reason: "No auth" });
  }

  // O6 — entitled session still has service (reload)
  if (loggedIn && report.tests.O5?.status === "PASS") {
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitPremiumReady(page);
    const body6 = await page.locator("body").innerText();
    const ok6 = /Ask My banDit/i.test(body6);
    await shot(page, "O6-entitled-reload.png");
    record("O6", ok6 ? "PASS" : "FAIL", {
      route: `/premium/${NEO}`,
      source: "commerce entitlements + view=track",
      reason: ok6 ? "Entitled Concierge OS after reload" : "Lost entitlement on reload",
    });
  } else {
    record("O6", report.tests.O5?.status === "PASS" ? "FAIL" : "BLOCKED", {
      reason: "Depends on O5 PASS",
    });
  }

  // Lukas vs Neo permissions (API honesty)
  const lukasNoQa = await fetch(
    `${WS}/api/bandit/premium?view=visibility&banditId=${LUKAS}`,
    {
      headers: {
        Accept: "application/json",
        "X-Guest-Bridge": BRIDGE["X-Guest-Bridge"],
        "X-Guest-Email": guest.email || "guest@banditour.demo",
      },
    },
  ).then((r) => r.json());
  const lukasQa = await api(`/api/bandit/premium?view=visibility&banditId=${LUKAS}`, guest.email);
  const neoQa = await api(`/api/bandit/premium?view=visibility&banditId=${NEO}`, guest.email);
  report.lukasNeo = {
    lukasWithoutQa: lukasNoQa?.authorizationClass,
    lukasWithQa: lukasQa.json?.authorizationClass,
    neoWithQa: neoQa.json?.authorizationClass,
  };

  await browser.close();
  fs.writeFileSync(path.join(OUT, "REPORT.json"), JSON.stringify(report, null, 2));
  console.log("Wrote", path.join(OUT, "REPORT.json"));
})();
