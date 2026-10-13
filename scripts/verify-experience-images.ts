/**
 * Validate bandiTour Experiences seed — covers must be unique + HTTP 200.
 * Run: npx tsx scripts/verify-experience-images.ts
 */
import {
  GUEST_EXPERIENCES,
  experiencesWithValidCover,
  isValidExperienceImageUrl,
} from "../lib/guest-workspace/productWorlds";
import { getExperienceDetail } from "../lib/guest-workspace/experienceDetail";

type Row = { check: string; status: "PASS" | "FAIL"; evidence: string };
const rows: Row[] = [];

function assert(check: string, ok: boolean, evidence: string) {
  rows.push({ check, status: ok ? "PASS" : "FAIL", evidence });
}

async function httpOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (res.ok) return true;
    const get = await fetch(url, { method: "GET", redirect: "follow" });
    return get.ok;
  } catch {
    return false;
  }
}

async function main() {
  const brochureWords = /acropolis|hop.?on|sightseeing|walking tour|historical walk|viator|getyourguide/i;

  assert(
    "Seed has DNA volume (16 bandiTour experiences)",
    GUEST_EXPERIENCES.length >= 16,
    `count=${GUEST_EXPERIENCES.length}`,
  );

  const withCover = experiencesWithValidCover(GUEST_EXPERIENCES);
  assert(
    "Every seeded listing has a valid cover URL shape",
    withCover.length === GUEST_EXPERIENCES.length,
    `valid=${withCover.length}/${GUEST_EXPERIENCES.length}`,
  );

  const covers = GUEST_EXPERIENCES.map((e) => e.imageUrl);
  const uniqueCovers = new Set(covers);
  assert(
    "Every listing has its OWN cover (no reused hero photos)",
    uniqueCovers.size === covers.length,
    `unique=${uniqueCovers.size} total=${covers.length}`,
  );

  const brochureHits = GUEST_EXPERIENCES.filter(
    (e) => brochureWords.test(e.title) || brochureWords.test(e.story),
  );
  assert(
    "No brochure tourism lead titles (Acropolis / hop-on / sightseeing)",
    brochureHits.length === 0,
    brochureHits.map((e) => e.id).join(",") || "none",
  );

  const requiredIds = [
    "exp_costume_warehouse",
    "exp_market_chef",
    "exp_destroy_clothes",
    "exp_dj_tonight",
    "exp_white_cube",
    "exp_dont_google",
  ];
  for (const id of requiredIds) {
    const exp = GUEST_EXPERIENCES.find((e) => e.id === id);
    assert(`Required DNA listing present: ${id}`, Boolean(exp), exp?.title || "missing");
  }

  let badHttp = 0;
  const checked = new Set<string>();
  for (const exp of GUEST_EXPERIENCES) {
    const detail = getExperienceDetail(exp.id);
    assert(`Detail resolves with gallery: ${exp.id}`, Boolean(detail && detail.gallery.length > 0), detail ? `gallery=${detail.gallery.length}` : "no detail");
    if (detail) {
      assert(
        `Host photo valid: ${exp.id}`,
        isValidExperienceImageUrl(detail.hostProfile.photoUrl),
        detail.hostProfile.photoUrl.slice(0, 60),
      );
    }
    for (const url of [exp.imageUrl, ...(detail?.gallery || []).slice(0, 3)]) {
      if (checked.has(url)) continue;
      checked.add(url);
      const ok = await httpOk(url);
      if (!ok) {
        badHttp += 1;
        assert(`HTTP image OK`, false, url);
      }
    }
  }
  if (badHttp === 0) {
    assert("Sampled cover/gallery images return HTTP OK", true, `checked=${checked.size}`);
  }

  console.log("\nbandiTour Experiences image/DNA verify\n");
  for (const r of rows) {
    console.log(`${r.status.padEnd(5)} ${r.check}`);
    console.log(`       ${r.evidence}\n`);
  }
  const failed = rows.filter((r) => r.status === "FAIL").length;
  console.log(`Result: ${rows.length - failed}/${rows.length} PASS\n`);
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
