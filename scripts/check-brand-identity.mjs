#!/usr/bin/env node
/**
 * Brand Identity Law — Guest App (intro / official touchpoints only).
 * Does not redesign internal screens. Verifies mirrored official assets.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const dirs = [
  join(root, "public", "assets", "brand"),
  join(root, "assets", "images", "brand", "intro"),
];
const REQUIRED = [
  { name: "logo-wordmark-dark-transparent.png", sha256: "FB0D282965AB2F0F4781AF53FB8BEB62CEAC66106B32110C892E697C74474084" },
  { name: "icon-mark-transparent.png", sha256: "17C6365536DE160541DE4CA08A2081FBFE9E3349D4ED59D590F283E6296AD028" },
  { name: "logo-lockup-light-transparent.png", sha256: "6A3C3A2F04BCF36D0602FE8F8288990960186E7D0086079C8DA22E2C731F1D21", publicOnly: true },
];

let failed = 0;
const fail = (m) => { console.error(`FAIL: ${m}`); failed += 1; };
const ok = (m) => console.log(`OK: ${m}`);

for (const dir of dirs) {
  const isIntro = /intro/i.test(dir);
  for (const asset of REQUIRED) {
    if (asset.publicOnly && isIntro) {
      // intro folder may omit lockup-light; public mirror required
      continue;
    }
    const p = join(dir, asset.name);
    if (!existsSync(p)) {
      // intro may still have dark lockup instead of light — require wordmark+octopus always
      if (asset.name.includes("lockup-light") && isIntro) continue;
      fail(`missing ${asset.name} in ${dir}`);
      continue;
    }
    const hash = createHash("sha256").update(readFileSync(p)).digest("hex").toUpperCase();
    if (hash !== asset.sha256) fail(`${asset.name} hash mismatch in ${dir}`);
    else ok(`${asset.name} @ ${dir.includes("intro") ? "intro" : "public"}`);
  }
}

const pubLockup = join(dirs[0], "logo-lockup-light-transparent.png");
if (!existsSync(pubLockup)) fail("public/assets/brand missing logo-lockup-light-transparent.png");
else {
  const hash = createHash("sha256").update(readFileSync(pubLockup)).digest("hex").toUpperCase();
  if (hash !== REQUIRED[2].sha256) fail("public lockup-light SHA mismatch");
  else ok("public lockup-light SHA match");
}

const introTs = readFileSync(join(root, "lib", "openingIntroAssets.ts"), "utf8");
if (!introTs.includes("#E72022")) fail("openingIntroAssets INTRO accent must use lockup red #E72022");
else ok("intro accent #E72022");
if (/INTRO_BANDANA_RED = '#E01850'|INTRO_BANDANA_RED = '#E41A54'/.test(introTs)) {
  fail("intro still assigns pink/magenta bandana CTA");
}

if (failed) { console.error(`\nBrand check failed (${failed}).`); process.exit(1); }
console.log("\nGuest brand identity check PASS (intro/touchpoints).");
