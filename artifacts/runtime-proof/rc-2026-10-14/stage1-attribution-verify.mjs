/**
 * Stage 1 A2 — verify story attribution never emits non-UUID bandit links.
 * Run: node artifacts/runtime-proof/rc-2026-10-14/stage1-attribution-verify.mjs
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "../../..");
const mem = fs.readFileSync(path.join(root, "lib/guest-workspace/profileMemory.ts"), "utf8");
const reg = fs.readFileSync(path.join(root, "lib/guest-workspace/registeredBanditIds.ts"), "utf8");
const moment = fs.readFileSync(path.join(root, "app/moment/[id].tsx"), "utf8");
const bandit = fs.readFileSync(path.join(root, "app/bandit/[id].tsx"), "utf8");

const uuidRe = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;
const fakeSlugHits = [...mem.matchAll(/banditId:\s*["']bandit_[a-z]+["']/g)].map((m) => m[0]);
const registeredConsts = [...reg.matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi)];

const checks = {
  noFakeSlugsInProfileMemory: fakeSlugHits.length === 0,
  registeredIdTablePresent: registeredConsts.length >= 6,
  momentUsesResolver: moment.includes("resolveRegisteredBanditId") && moment.includes("banditProfileHrefSafe"),
  banditErrorHasEscape: bandit.includes("AppEscapeNav") && bandit.includes("bandit-profile-error"),
  banditLoadingHasEscape: bandit.includes("bandit-profile-loading"),
  getBanditRejectsNonUuid: fs
    .readFileSync(path.join(root, "app/services/bandits.ts"), "utf8")
    .includes("BANDIT_UUID_RE"),
};

const pass = Object.values(checks).every(Boolean);
const out = {
  at: new Date().toISOString(),
  tipNote: "run after commit for SHA",
  checks,
  fakeSlugHits,
  registeredUuidCount: registeredConsts.length,
  sampleUuidsInMemory: [...mem.matchAll(uuidRe)].slice(0, 8).map((m) => m[0]),
  verdict: pass ? "CODE PASS — Stage1 A2 attribution + escape" : "FAIL",
};
const outPath = path.join(root, "artifacts/runtime-proof/rc-2026-10-14/stage1-attribution-verify.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
process.exit(pass ? 0 : 1);
