/**
 * Rehost known authentic venue photos (press/guide pages) into durable storage.
 * No stock. No generated. Preserves event IDs.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, service, { auth: { persistSession: false } });

const JOBS = [
  {
    name: "Kinono",
    ids: ["914996fb-ebe7-432e-8f5d-722b977d9562"],
    sources: [
      "https://flaginlife.gr/wp-content/uploads/2024/02/kentriki-22.webp",
      "https://flaginlife.gr/wp-content/uploads/2024/02/kentriki-22.jpg",
    ],
  },
  {
    name: "Dexameni Outdoor Cinema",
    ids: [
      "f99f6a96-1355-4e3a-81d5-b34490989f33",
      "d8d90967-786a-425b-ac0e-c6c091517b51",
      "cce8094c-84a4-4453-b64e-b189ace08ee0",
      "8a5deed7-de67-4f4a-aa2a-b204f4711014",
    ],
    sources: [
      // Atlas Obscura user photos of Hadrian's Reservoir / Cinema Dexameni above
      // filled at runtime from argv extras or page scrape below
    ],
  },
];

// Extra sources from CLI
const extras = process.argv.slice(2);
for (const e of extras) {
  if (e.startsWith("kinono=")) JOBS[0].sources.unshift(e.slice(7));
  if (e.startsWith("dexameni=")) JOBS[1].sources.unshift(e.slice(9));
}

async function download(u) {
  const r = await fetch(u, {
    headers: { "User-Agent": "Mozilla/5.0 banditour-recovery", Accept: "image/*,*/*" },
    redirect: "follow",
  });
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  const ct = r.headers.get("content-type") || "";
  if (buf.length < 12000) return null;
  if (!( /image\//i.test(ct) || buf[0] === 0xff || buf[0] === 0x89 || buf[0] === 0x52 || buf[0] === 0x52 || buf[8] === 0x57))
    return null;
  let ext = "jpg";
  if (buf[0] === 0x89) ext = "png";
  else if (/webp/i.test(ct) || (buf[8] === 0x57 && buf[9] === 0x45)) ext = "webp";
  return { buf, ct: ct.split(";")[0] || "image/jpeg", ext, bytes: buf.length, source: u };
}

async function scrapeAtlas() {
  const page = await fetch("https://www.atlasobscura.com/places/hadrians-reservoir", {
    headers: { "User-Agent": "Mozilla/5.0 banditour-recovery" },
  });
  if (!page.ok) return [];
  const html = await page.text();
  const out = [];
  for (const m of html.matchAll(/https:\/\/[^"'\s]+(?:atlasobscura|imgix)[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi)) {
    out.push(m[0].replace(/&amp;/g, "&").split("?")[0] + "?auto=format&w=1600");
  }
  for (const m of html.matchAll(/https:\/\/img\.atlasobscura\.com\/[^"'\s]+/gi)) {
    out.push(m[0].replace(/&amp;/g, "&"));
  }
  return [...new Set(out)];
}

async function scrapeFlagin() {
  const page = await fetch("https://flaginlife.gr/kinono-ena-pareistiko-all-day-steki-sto-koukaki/", {
    headers: { "User-Agent": "Mozilla/5.0 banditour-recovery" },
  });
  if (!page.ok) return [];
  const html = await page.text();
  const out = [];
  for (const m of html.matchAll(/https:\/\/flaginlife\.gr\/wp-content\/uploads\/[^"']+\.(?:jpg|jpeg|png|webp)/gi)) {
    out.push(m[0].replace(/&amp;/g, "&"));
  }
  return [...new Set(out)];
}

async function scrapeAthensVoice() {
  const page = await fetch(
    "https://www.athensvoice.gr/life/geusi/resto/887632/sto-kainourgio-kinono-sto-koukaki-to-fagito-einai-mia-teletourgia/",
    { headers: { "User-Agent": "Mozilla/5.0 banditour-recovery" } },
  );
  if (!page.ok) return [];
  const html = await page.text();
  const out = [];
  for (const m of html.matchAll(/https:\/\/[^"']+\.(?:jpg|jpeg|png|webp)/gi)) {
    const u = m[0];
    if (/athensvoice|avmedia|cloudfront|wp-content/i.test(u)) out.push(u.replace(/&amp;/g, "&"));
  }
  return [...new Set(out)].slice(0, 30);
}

async function rehost(id, dl) {
  const path = `venue_heroes/athens/${id}/hero-${Date.now()}.${dl.ext}`;
  const { error } = await admin.storage.from("banditsassets4").upload(path, dl.buf, {
    contentType: dl.ct,
    upsert: true,
  });
  if (error) throw new Error(error.message);
  return admin.storage.from("banditsassets4").getPublicUrl(path).data.publicUrl;
}

// Enrich sources
JOBS[0].sources.push(...(await scrapeFlagin()), ...(await scrapeAthensVoice()));
JOBS[1].sources.push(...(await scrapeAtlas()));
JOBS[0].sources = [...new Set(JOBS[0].sources)];
JOBS[1].sources = [...new Set(JOBS[1].sources)];
console.log("kinono candidates", JOBS[0].sources.length, JOBS[0].sources.slice(0, 5));
console.log("dexameni candidates", JOBS[1].sources.length, JOBS[1].sources.slice(0, 5));

const report = { updated: [], failed: [] };

for (const job of JOBS) {
  let dl = null;
  for (const s of job.sources) {
    dl = await download(s);
    if (dl) {
      console.log("got", job.name, s, dl.bytes);
      break;
    }
  }
  if (!dl) {
    for (const id of job.ids) report.failed.push({ id, name: job.name, reason: "download_fail" });
    continue;
  }
  for (const id of job.ids) {
    try {
      const pub = await rehost(id, dl);
      const { error } = await admin
        .from("event")
        .update({ image_url: pub, image_gallery: JSON.stringify([pub]) })
        .eq("id", id);
      if (error) throw new Error(error.message);
      report.updated.push({ id, name: job.name, to: pub, bytes: dl.bytes, source: dl.source });
    } catch (e) {
      report.failed.push({ id, name: job.name, reason: e.message });
    }
  }
}

fs.writeFileSync(
  "C:/Users/blonj/banditour workspace system/.data/athens-recovery/direct-heroes.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
