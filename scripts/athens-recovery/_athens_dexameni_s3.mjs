import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, service, { auth: { persistSession: false } });

const IDS = [
  "f99f6a96-1355-4e3a-81d5-b34490989f33",
  "d8d90967-786a-425b-ac0e-c6c091517b51",
  "cce8094c-84a4-4453-b64e-b189ace08ee0",
  "8a5deed7-de67-4f4a-aa2a-b204f4711014",
];

// Decode Atlas imgix proxies from page HTML → S3 originals
async function atlasS3FromPage() {
  const page = await fetch("https://www.atlasobscura.com/places/hadrians-reservoir", {
    headers: { "User-Agent": "Mozilla/5.0 banditour-recovery" },
  });
  const html = await page.text();
  const proxies = [...html.matchAll(/https:\/\/img\.atlasobscura\.com\/[^"'\\\s]+/g)].map((m) =>
    m[0].replace(/&amp;/g, "&"),
  );
  const outs = [];
  for (const p of [...new Set(proxies)]) {
    const idx = p.indexOf("/aHR0");
    if (idx < 0) continue;
    let b64 = p.slice(idx + 1).split("?")[0].replace(/\//g, "");
    // url-safe
    b64 = b64.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    try {
      const original = Buffer.from(b64, "base64").toString("utf8");
      if (/^https:\/\/atlas-dev\.s3\.amazonaws\.com\/uploads\/place_images\//i.test(original)) {
        outs.push(original);
      }
    } catch {
      /* */
    }
  }
  return [...new Set(outs)];
}

const known = [
  "https://atlas-dev.s3.amazonaws.com/uploads/place_images/2924ff3f-154b-4ef1-9816-e259df1ea17cc3c9765f61c6247751_2.jpg",
];
const candidates = [...new Set([...(await atlasS3FromPage()), ...known])];
console.log("s3 candidates", candidates.length, candidates);

async function download(u) {
  const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0 banditour-recovery" } });
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 20000) return null;
  return { buf, ct: "image/jpeg", ext: "jpg", bytes: buf.length, source: u };
}

let dl = null;
for (const c of candidates) {
  dl = await download(c);
  if (dl) {
    console.log("got", c, dl.bytes);
    break;
  }
}
if (!dl) {
  console.error("no download");
  process.exit(1);
}

const report = { updated: [], failed: [] };
for (const id of IDS) {
  try {
    const path = `venue_heroes/athens/${id}/hero-${Date.now()}.jpg`;
    const { error: upErr } = await admin.storage.from("banditsassets4").upload(path, dl.buf, {
      contentType: "image/jpeg",
      upsert: true,
    });
    if (upErr) throw new Error(upErr.message);
    const pub = admin.storage.from("banditsassets4").getPublicUrl(path).data.publicUrl;
    const { error } = await admin
      .from("event")
      .update({ image_url: pub, image_gallery: JSON.stringify([pub]) })
      .eq("id", id);
    if (error) throw new Error(error.message);
    report.updated.push({ id, to: pub, bytes: dl.bytes, source: dl.source });
  } catch (e) {
    report.failed.push({ id, reason: e.message });
  }
}

fs.writeFileSync(
  "C:/Users/blonj/banditour workspace system/.data/athens-recovery/dexameni-s3.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
