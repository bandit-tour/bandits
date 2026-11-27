/**
 * Proof harness: assert-guest-canonical-deploy rejects wrong sources.
 * Runs in a temp copy of critical files — does not mutate the canonical tree.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const guardSrc = join(ROOT, "scripts", "assert-guest-canonical-deploy.mjs");
const results = [];

function runCase(name, setup) {
  const dir = mkdtempSync(join(tmpdir(), "guest-guard-"));
  try {
    mkdirSync(join(dir, "scripts"), { recursive: true });
    mkdirSync(join(dir, ".vercel"), { recursive: true });
    mkdirSync(join(dir, "app"), { recursive: true });
    copyFileSync(guardSrc, join(dir, "scripts", "assert-guest-canonical-deploy.mjs"));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "bandits" }, null, 2));
    writeFileSync(join(dir, "CANONICAL.md"), "# canonical\n");
    writeFileSync(join(dir, "app.json"), "{}");
    writeFileSync(
      join(dir, ".vercel", "project.json"),
      JSON.stringify({
        projectId: "prj_V9Fsr4pTjyGvIgalyD3JOUN0l2Dw",
        projectName: "bandits",
      }),
    );
    // Fake git remote/branch via env where possible; also init mini git
    execFileSync("git", ["init"], { cwd: dir, stdio: "ignore" });
    execFileSync("git", ["config", "user.email", "guard@test.local"], { cwd: dir, stdio: "ignore" });
    execFileSync("git", ["config", "user.name", "Guard Proof"], { cwd: dir, stdio: "ignore" });
    execFileSync("git", ["remote", "add", "origin", "https://github.com/bandit-tour/bandits.git"], {
      cwd: dir,
      stdio: "ignore",
    });
    execFileSync("git", ["checkout", "-b", "production/guest-app"], { cwd: dir, stdio: "ignore" });
    writeFileSync(join(dir, "README.md"), "proof\n");
    execFileSync("git", ["add", "."], { cwd: dir, stdio: "ignore" });
    execFileSync("git", ["commit", "-m", "proof"], { cwd: dir, stdio: "ignore" });
    const envExtra = setup(dir) || {};
    let code = 0;
    let out = "";
    try {
      out = execFileSync("node", ["scripts/assert-guest-canonical-deploy.mjs"], {
        cwd: dir,
        encoding: "utf8",
        env: {
          ...process.env,
          GUEST_REQUIRE_PRODUCTION_BRANCH: "1",
          VERCEL_ENV: "production",
          ...envExtra,
        },
      });
    } catch (e) {
      code = e.status || 1;
      out = `${e.stdout || ""}${e.stderr || ""}`;
    }
    const rejected = code !== 0;
    results.push({ name, rejected, code, snippet: out.slice(0, 220).replace(/\s+/g, " ") });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

runCase("wrong-package-safekey", (dir) => {
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "safekey" }, null, 2));
});

runCase("wrong-remote", (dir) => {
  execFileSync("git", ["remote", "remove", "origin"], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["remote", "add", "origin", "https://github.com/other/wrong-repo.git"], {
    cwd: dir,
    stdio: "ignore",
  });
});

runCase("branch-main", (dir) => {
  execFileSync("git", ["checkout", "-b", "main"], { cwd: dir, stdio: "ignore" });
  return { VERCEL_GIT_COMMIT_REF: "main" };
});

runCase("wrong-vercel-project", (dir) => {
  writeFileSync(
    join(dir, ".vercel", "project.json"),
    JSON.stringify({ projectId: "prj_WRONG", projectName: "not-bandits" }),
  );
});

runCase("canonical-ok", () => {});

const report = {
  at: new Date().toISOString(),
  guard: "scripts/assert-guest-canonical-deploy.mjs",
  cases: results,
  allBadRejected: results.filter((r) => r.name !== "canonical-ok").every((r) => r.rejected),
  canonicalAccepted: results.find((r) => r.name === "canonical-ok")?.rejected === false,
};
writeFileSync(join(ROOT, "docs", "GUEST-DEPLOY-GUARD-PROOF.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!report.allBadRejected || !report.canonicalAccepted) process.exit(1);
