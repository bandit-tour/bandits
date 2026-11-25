/**
 * Audit Athens event + bandit image URLs for actual HTTP renderability.
 * Lists founder-named missing venues and overall durable/broken counts.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !service) {
  console.error("Missing SUPABASE URL or SERVICE_ROLE_KEY", {
    hasUrl: !!url,
    hasService: !!service,
  });
  process.exit(1);
}
const admin = createClient(url, service, { auth: { persistSession: false } });

const FOUNDER = [
  "Kinono",
  "Kong Athens Vintage",
  "Hammam Baths Thissio",
  "Dexameni Outdoor Cinema",
  "Akira Sushi",
];

function hostOf(u) {
  try {
    return new URL(u).host;
  } catch {
    return "bad";
  }
}
function isPlaces(u) {
  return /places\.googleapis\.com|maps\.googleapis\.com\/maps\/api\/place/i.test(String(u || ""));
}
function isDurable(u) {
  return /supabase\.co\/storage|wikimedia\.org|wikipedia\.org/i.test(String(u || ""));
}
function isStaticMap(u) {
  return /staticmap/i.test(String(u || ""));
}

async function probe(u) {
  if (!u) return { ok: false, status: 0, bytes: 0, reason: "empty" };
  try {
    const r = await fetch(u, { redirect: "follow", headers: { "User-Agent": "banditour-audit" } });
    const buf = Buffer.from(await r.arrayBuffer());
    const ct = r.headers.get("content-type") || "";
    const ok =
      r.ok &&
      buf.length >= 8000 &&
      (/image\//i.test(ct) || buf[0] === 0xff || buf[0] === 0x89 || buf[0] === 0x52) &&
      !isStaticMap(u) &&
      !isPlaces(u);
    return {
      ok,
      status: r.status,
      bytes: buf.length,
      ct,
      host: hostOf(u),
      reason: !r.ok
        ? `http_${r.status}`
        : isPlaces(u)
          ? "ephemeral_places"
          : isStaticMap(u)
            ? "static_map"
            : buf.length < 8000
              ? "too_small"
              : !/image\//i.test(ct) && buf[0] !== 0xff && buf[0] !== 0x89
                ? "not_image"
                : ok
                  ? "ok"
                  : "fail",
    };
  } catch (e) {
    return { ok: false, status: 0, bytes: 0, host: hostOf(u), reason: e.message };
  }
}

const { data: events, error } = await admin
  .from("event")
  .select("id,name,image_url,image_gallery,city,rating,genre,google_place_id,description")
  .eq("city", "Athens");
if (error) throw error;

const { data: bandits } = await admin
  .from("bandit")
  .select("id,name,face_image_url,image_url,city")
  .eq("city", "Athens");

const report = {
  publishedPlaces: events?.length || 0,
  bandits: bandits?.length || 0,
  hosts: {},
  durableOk: 0,
  brokenOrEphemeral: 0,
  founder: [],
  missing: [],
  banditFaces: { ok: 0, bad: [] },
};

for (const e of events || []) {
  try {
    const h = hostOf(e.image_url);
    report.hosts[h] = (report.hosts[h] || 0) + 1;
  } catch {
    report.hosts.bad = (report.hosts.bad || 0) + 1;
  }
  const p = await probe(e.image_url);
  if (p.ok) report.durableOk++;
  else {
    report.brokenOrEphemeral++;
    report.missing.push({
      id: e.id,
      name: e.name,
      genre: e.genre,
      placeId: e.google_place_id,
      host: p.host,
      reason: p.reason,
      status: p.status,
      bytes: p.bytes,
    });
  }
}

for (const name of FOUNDER) {
  const rows = (events || []).filter((e) => e.name === name || e.name?.includes(name));
  for (const e of rows) {
    const p = await probe(e.image_url);
    report.founder.push({
      id: e.id,
      name: e.name,
      image_url: e.image_url,
      probe: p,
      gallery0: (() => {
        try {
          const g = JSON.parse(e.image_gallery || "[]");
          return g[0] ? hostOf(g[0]) : null;
        } catch {
          return null;
        }
      })(),
    });
  }
  if (!rows.length) report.founder.push({ name, missingRow: true });
}

for (const b of bandits || []) {
  const u = b.face_image_url || b.image_url;
  const p = await probe(u);
  if (p.ok) report.banditFaces.ok++;
  else report.banditFaces.bad.push({ id: b.id, name: b.name, reason: p.reason, host: p.host, status: p.status, bytes: p.bytes });
}

const out =
  "C:/Users/blonj/banditour workspace system/.data/athens-recovery/audit-missing-heroes.json";
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      publishedPlaces: report.publishedPlaces,
      durableOk: report.durableOk,
      brokenOrEphemeral: report.brokenOrEphemeral,
      hosts: report.hosts,
      founder: report.founder,
      bandits: report.bandits,
      banditOk: report.banditFaces.ok,
      banditBad: report.banditFaces.bad.length,
      missingSample: report.missing.slice(0, 15),
    },
    null,
    2,
  ),
);
