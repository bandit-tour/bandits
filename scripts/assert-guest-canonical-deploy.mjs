#!/usr/bin/env node
/**
 * Permanent Guest App deployment guard (LOCKED 2026-11-26).
 *
 * Rejects deploys that are not the accepted canonical source:
 *   repo    bandit-tour/bandits
 *   branch  production/guest-app
 *   local   C:\Users\blonj\guest-explore-maps-fix (documented; any clone OK if repo/branch/project match)
 *   vercel  prj_V9Fsr4pTjyGvIgalyD3JOUN0l2Dw (project name bandits)
 *
 * Also rejects SafeKey-contaminated trees (package name safekey / wrong product).
 *
 * Escape hatch (local/CI dry-runs only — never for production):
 *   GUEST_DEPLOY_GUARD_BYPASS=founder-explicit
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CANONICAL = {
  githubRepo: "bandit-tour/bandits",
  productionBranch: "production/guest-app",
  vercelProjectId: "prj_V9Fsr4pTjyGvIgalyD3JOUN0l2Dw",
  vercelProjectName: "bandits",
  packageName: "bandits",
  productionAlias: "https://bandits-two.vercel.app",
  localPathDoc: String.raw`C:\Users\blonj\guest-explore-maps-fix`,
};

function fail(msg) {
  console.error("\n[GUEST DEPLOY GUARD] REJECTED");
  console.error(msg);
  console.error(
    `\nCanonical: ${CANONICAL.githubRepo} @ ${CANONICAL.productionBranch}` +
      `\nVercel: ${CANONICAL.vercelProjectName} (${CANONICAL.vercelProjectId})` +
      `\nLocal: ${CANONICAL.localPathDoc}` +
      `\nAlias: ${CANONICAL.productionAlias}\n`,
  );
  process.exit(1);
}

function git(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

if (process.env.GUEST_DEPLOY_GUARD_BYPASS === "founder-explicit") {
  console.warn("[GUEST DEPLOY GUARD] bypass set — production use forbidden");
  process.exit(0);
}

const pkgPath = join(ROOT, "package.json");
if (!existsSync(pkgPath)) fail("Missing package.json");
let pkg;
try {
  pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
} catch {
  fail("package.json is not valid JSON");
}

const name = String(pkg.name || "").toLowerCase();
if (name === "safekey" || name.includes("safekey")) {
  fail(`SafeKey-contaminated tree (package.json name="${pkg.name}"). Never deploy to bandits.`);
}
if (name !== CANONICAL.packageName) {
  fail(`Wrong package name "${pkg.name}" — expected "${CANONICAL.packageName}".`);
}

if (!existsSync(join(ROOT, "CANONICAL.md"))) {
  fail("Missing CANONICAL.md — this tree is not the locked Guest App source.");
}
if (!existsSync(join(ROOT, "app")) || !existsSync(join(ROOT, "app.json"))) {
  fail("Missing Expo app/ or app.json — not the Guest App product tree.");
}

// Contaminated Documents\bandits historically carried SafeKey while linked to this Vercel project.
const cwdNorm = process.cwd().replace(/\\/g, "/").toLowerCase();
if (cwdNorm.includes("/documents/bandits") && !cwdNorm.includes("guest-explore-maps-fix")) {
  fail(
    "Working directory looks like Documents\\bandits (SafeKey contamination history). Use guest-explore-maps-fix.",
  );
}

const onVercel = process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
const remote = git("git remote get-url origin") || git("git config --get remote.origin.url");
const remoteNorm = remote.replace(/\.git$/i, "").toLowerCase();
const vercelOwner = String(process.env.VERCEL_GIT_REPO_OWNER || "").trim().toLowerCase();
const vercelSlug = String(process.env.VERCEL_GIT_REPO_SLUG || "").trim().toLowerCase();
const vercelRepo =
  vercelOwner && vercelSlug ? `${vercelOwner}/${vercelSlug}` : "";

if (remoteNorm) {
  if (!remoteNorm.includes("bandit-tour/bandits")) {
    fail(`Incorrect git remote "${remote}". Expected github.com/bandit-tour/bandits.`);
  }
} else if (vercelRepo) {
  if (vercelRepo !== "bandit-tour/bandits") {
    fail(`Incorrect Vercel git repo "${vercelRepo}". Expected bandit-tour/bandits.`);
  }
} else if (onVercel) {
  // Vercel build sandbox has no .git — project id check below is the hard lock.
  console.warn(
    "[GUEST DEPLOY GUARD] no local git remote on Vercel build; enforcing via VERCEL_PROJECT_ID + package/CANONICAL",
  );
} else {
  fail(`Incorrect git remote "(none)". Expected github.com/bandit-tour/bandits.`);
}

const branch =
  process.env.VERCEL_GIT_COMMIT_REF ||
  process.env.GITHUB_REF_NAME ||
  git("git rev-parse --abbrev-ref HEAD");
const isVercelProd =
  process.env.VERCEL_ENV === "production" ||
  (process.env.VERCEL === "1" && String(process.env.VERCEL_ENV || "") === "production");
const requireProductionBranch =
  isVercelProd || process.env.GUEST_REQUIRE_PRODUCTION_BRANCH === "1";

if (branch === "main" || branch === "master") {
  fail(
    `Refusing deploy from "${branch}" — GitHub main is SafeKey-contaminated. Use ${CANONICAL.productionBranch}.`,
  );
}

if (requireProductionBranch) {
  if (branch && branch !== "HEAD" && branch !== CANONICAL.productionBranch) {
    fail(`Branch "${branch}" is not ${CANONICAL.productionBranch}. Production deploys rejected.`);
  }
  if (!branch || branch === "HEAD") {
    // CLI / file upload to the locked bandits project: require matching project id (checked below).
    if (!onVercel) {
      fail(
        `Production deploy requires an explicit ${CANONICAL.productionBranch} ref (got "${branch || "(empty)"}").`,
      );
    }
    console.warn(
      `[GUEST DEPLOY GUARD] Vercel production build without git ref — accepting only if project id is ${CANONICAL.vercelProjectId}`,
    );
  }
} else if (branch && branch !== "HEAD" && branch !== CANONICAL.productionBranch) {
  console.warn(
    `[GUEST DEPLOY GUARD] warning: branch "${branch}" ≠ ${CANONICAL.productionBranch} (non-production build only)`,
  );
}

const vercelProjectPath = join(ROOT, ".vercel", "project.json");
if (existsSync(vercelProjectPath)) {
  let linked;
  try {
    linked = JSON.parse(readFileSync(vercelProjectPath, "utf8"));
  } catch {
    fail(".vercel/project.json is corrupt");
  }
  if (linked.projectId && linked.projectId !== CANONICAL.vercelProjectId) {
    fail(
      `Incorrect Vercel projectId "${linked.projectId}". Expected ${CANONICAL.vercelProjectId} (${CANONICAL.vercelProjectName}).`,
    );
  }
  if (linked.projectName && linked.projectName !== CANONICAL.vercelProjectName) {
    fail(`Incorrect Vercel projectName "${linked.projectName}". Expected "${CANONICAL.vercelProjectName}".`);
  }
}

// When Vercel injects project id, reject mismatch. Production on Vercel MUST match.
const vercelPid = process.env.VERCEL_PROJECT_ID || "";
if (vercelPid && vercelPid !== CANONICAL.vercelProjectId) {
  fail(`VERCEL_PROJECT_ID="${vercelPid}" ≠ ${CANONICAL.vercelProjectId}. Wrong Vercel project.`);
}
if (isVercelProd && !vercelPid && !existsSync(vercelProjectPath)) {
  fail("Production Vercel build missing VERCEL_PROJECT_ID and .vercel/project.json.");
}
if (isVercelProd && vercelPid && vercelPid !== CANONICAL.vercelProjectId) {
  fail(`Production Vercel project mismatch: ${vercelPid}`);
}

console.log("[GUEST DEPLOY GUARD] OK");
console.log(`  repo=${CANONICAL.githubRepo} branch=${branch || "(vercel-file-upload)"}`);
console.log(`  vercel=${CANONICAL.vercelProjectId}`);
console.log(`  package=${pkg.name}`);
process.exit(0);
