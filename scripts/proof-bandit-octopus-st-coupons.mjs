/**
 * Octopus Verified (10 bandits) + SmartTraveler listing coupons — production proof.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
dotenv.config({ path: path.join(root, ".env") });

const GUEST = process.env.RUNTIME_BASE_URL || "https://bandits-two.vercel.app";
const WS = process.env.EXPO_PUBLIC_WORKSPACE_URL || "https://banditour-workspace.vercel.app";
const OUT = path.join(root, "artifacts", "runtime-proof", "bandit-octopus-st-coupons");

const NEO = "d76cb120-018d-4a2e-8b5f-0578a71fd8f9";
const FOLIA_ID = "st_st_merchant_mvcqvifx_banditour_live";
const EDITORIAL_ID = "st_studio_nera";
const SAMPLE_SEED = 20261018;

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickTenBandits(all) {
  const rng = mulberry32(SAMPLE_SEED);
  const copy = [...all];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, 10);
}

async function api(pathname) {
  const res = await fetch(`${WS}${pathname}`, { headers: { Accept: "application/json" } });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json };
}

async function shot(page, name) {
  await fs.mkdir(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, name), fullPage: true });
}

async function run() {
  const url = String(process.env.EXPO_PUBLIC_SUPABASE_URL || "").trim();
  const key =
    String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim() ||
    String(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  if (!url || !key) throw new Error("Missing Supabase URL/key for bandit inventory");

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  let bandits = [];
  const { data, error } = await admin.from("bandit").select("id,name").order("created_at", { ascending: false });
  if (error) console.warn("[proof] supabase bandit list:", error.message);
  else bandits = data || [];

  if (bandits.length < 10) {
    const invPath = path.join(
      root,
      "artifacts/runtime-proof/rc-2026-10-16/octopus-verified/inventory.json",
    );
    try {
      const inv = JSON.parse(await fs.readFile(invPath, "utf8"));
      bandits = (inv.all || []).map((b) => ({ id: b.id, name: b.name }));
    } catch (e) {
      console.warn("[proof] inventory fallback unavailable:", e.message);
    }
  }

  const sample = pickTenBandits(bandits);
  const banditMatrix = [];
  for (const b of sample) {
    const vis = await api(`/api/bandit/premium?view=visibility&banditId=${b.id}`);
    banditMatrix.push({
      id: b.id,
      name: b.name,
      octopusVerified: vis.json?.octopusVerified === true,
      showPremiumInsights: vis.json?.showPremiumInsights === true,
      authorizationClass: vis.json?.authorizationClass || null,
      blockers: vis.json?.blockers || [],
    });
  }

  const stPublic = await api("/api/public/smarttraveler");
  const folia = (stPublic.json?.businesses || []).find((x) => x.id === FOLIA_ID) || null;
  const partnerCode = folia?.offers?.[0]?.uniqueCode || null;

  const checks = {};
  const browser = await chromium.launch({ headless: true });
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await mobile.goto(`${GUEST}/bandits`, { waitUntil: "networkidle", timeout: 120000 });
  await mobile.waitForTimeout(2500);
  await shot(mobile, "mobile-bandits-list.png");

  await mobile.goto(`${GUEST}/bandit/${NEO}`, { waitUntil: "networkidle", timeout: 120000 });
  await mobile.waitForTimeout(2000);
  const neoBody = await mobile.locator("body").innerText();
  await shot(mobile, "mobile-neo-profile-verified.png");
  checks.neoOctopusBadge =
    (await mobile.getByTestId("octopus-verified-badge").count()) > 0 ||
    /Octopus Verified/i.test(neoBody);

  await mobile.goto(`${GUEST}/premium/${NEO}`, { waitUntil: "networkidle", timeout: 120000 });
  await mobile.waitForTimeout(2000);
  const neoPremium = await mobile.locator("body").innerText();
  await shot(mobile, "mobile-neo-stay-pass-eligible.png");
  checks.neoStayPassEntry =
    /Stay Pass|Octopus Concierge|€19/i.test(neoPremium) &&
    !/not commercially authorized/i.test(neoPremium);

  const notVerified = banditMatrix.find((b) => !b.octopusVerified && b.id !== NEO);
  if (notVerified?.id) {
    await mobile.goto(`${GUEST}/premium/${notVerified.id}`, { waitUntil: "networkidle", timeout: 120000 });
    await mobile.waitForTimeout(2000);
    const unauth = await mobile.locator("body").innerText();
    await shot(mobile, "mobile-bandit-stay-pass-ineligible.png");
    checks.stayPassBlockedWhenNotVerified =
      /not commercially authorized|not Octopus Verified|City Guide and Ask Me/i.test(unauth);
  } else {
    checks.stayPassBlockedWhenNotVerified = false;
  }

  await mobile.goto(`${GUEST}/smarttraveler`, { waitUntil: "networkidle", timeout: 120000 });
  await mobile.getByTestId("st-find-count").waitFor({ timeout: 30000 });
  await mobile.waitForTimeout(1500);
  const stMobile = await mobile.locator("body").innerText();
  checks.stListingCopyCode = (await mobile.getByTestId("st-copy-code").count()) >= 3;
  checks.stPreviewLabel = /NON-REDEEMABLE PREVIEW/i.test(stMobile);
  await shot(mobile, "mobile-smarttraveler-coupons.png");

  await mobile.goto(`${GUEST}/localFind/${EDITORIAL_ID}`, { waitUntil: "networkidle", timeout: 120000 });
  await mobile.waitForTimeout(1200);
  const edBody = await mobile.locator("body").innerText();
  checks.editorialPreviewOnly =
    /NON-REDEEMABLE PREVIEW/i.test(edBody) && !/Claim discount code/i.test(edBody);
  await shot(mobile, "mobile-editorial-coupon-preview.png");

  await mobile.goto(`${GUEST}/localFind/${FOLIA_ID}`, { waitUntil: "networkidle", timeout: 120000 });
  await mobile.waitForTimeout(2000);
  const foliaBody = await mobile.locator("body").innerText();
  checks.partnerListingCoupon =
    (await mobile.getByTestId("st-coupon-code-value").count()) > 0 &&
    !/NON-REDEEMABLE PREVIEW/i.test(foliaBody);
  await shot(mobile, "mobile-partner-coupon.png");

  await desktop.goto(`${GUEST}/smarttraveler`, { waitUntil: "networkidle", timeout: 120000 });
  await desktop.waitForTimeout(2000);
  checks.desktopCopyCode = (await desktop.getByTestId("st-copy-code").count()) >= 3;
  await shot(desktop, "desktop-smarttraveler-coupons.png");

  await desktop.goto(`${GUEST}/bandits`, { waitUntil: "networkidle", timeout: 120000 });
  await desktop.waitForTimeout(2000);
  await shot(desktop, "desktop-bandits-verified-first.png");

  await browser.close();

  const verifiedCount = banditMatrix.filter((b) => b.octopusVerified).length;
  checks.tenBanditSample = banditMatrix.length === 10;
  checks.visibilityFromWorkspace = banditMatrix.every((b) => typeof b.octopusVerified === "boolean");
  checks.exactlyProductionVerified =
    verifiedCount >= 1 && banditMatrix.find((b) => b.id === NEO)?.octopusVerified === true;

  const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  const report = {
    at: new Date().toISOString(),
    guest: GUEST,
    workspace: WS,
    sampleSeed: SAMPLE_SEED,
    banditSample: banditMatrix,
    verifiedCountInSample: verifiedCount,
    smartTraveler: {
      partnerId: FOLIA_ID,
      partnerOfferCodeFromApi: partnerCode,
      editorialId: EDITORIAL_ID,
      editorialExpect: "NON-REDEEMABLE PREVIEW",
    },
    checks,
    pass: failed.length === 0,
    failed,
  };

  let guestSha = "";
  let workspaceSha = "";
  try {
    guestSha = execSync("git rev-parse HEAD", { cwd: root }).toString().trim();
  } catch {
    guestSha = "unknown";
  }
  try {
    workspaceSha = execSync("git rev-parse HEAD", {
      cwd: path.join(process.env.USERPROFILE || "", "banditour workspace system"),
    }).toString().trim();
  } catch {
    workspaceSha = "unknown";
  }

  await fs.mkdir(OUT, { recursive: true });
  await fs.writeFile(path.join(OUT, "REPORT.json"), JSON.stringify(report, null, 2));
  await fs.writeFile(
    path.join(OUT, "DEPLOY.json"),
    JSON.stringify(
      {
        at: report.at,
        guest: { url: GUEST, gitSha: guestSha, vercelProject: "bandits-two" },
        workspace: { url: WS, gitSha: workspaceSha, vercelProject: "banditour-workspace" },
        deployIds: process.env.PROOF_DEPLOY_IDS ? JSON.parse(process.env.PROOF_DEPLOY_IDS) : null,
      },
      null,
      2,
    ),
  );
  await fs.writeFile(
    path.join(OUT, "RESULT.md"),
    `# Octopus Verified + SmartTraveler coupons\n\n- **Pass:** ${report.pass}\n- **Guest:** ${GUEST}\n- **Workspace:** ${WS}\n- **Sample:** 10 bandits (seed ${SAMPLE_SEED}), ${verifiedCount} verified in sample\n\n## Matrix\n${Object.entries(checks)
      .map(([k, v]) => `- ${k}: ${v ? "PASS" : "FAIL"}`)
      .join("\n")}\n\n## Bandit sample\n${banditMatrix
      .map((b) => `- ${b.name} (\`${b.id.slice(0, 8)}…\`) — verified=${b.octopusVerified}`)
      .join("\n")}\n\n${failed.length ? `## Failed\n${failed.map((f) => `- ${f}`).join("\n")}\n` : ""}`,
  );

  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
