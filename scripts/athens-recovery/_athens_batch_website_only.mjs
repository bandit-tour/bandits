/**
 * Rehost remaining Places/pexels Athens heroes via event.link website scrape only.
 * Places API quota exhausted — no Places calls. No stock. Preserves IDs.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, service, { auth: { persistSession: false } });
const LIMIT = Number(process.env.ATHENS_PHOTO_LIMIT || 80);

function isPlaces(u) {
  return /places\.googleapis\.com|maps\.googleapis\.com\/maps\/api\/place/i.test(String(u || ""));
}
function isLogoish(u) {
  return /logo|slogan|icon|favicon|sprite|avatar|badge|pixel|1x1|tracking|share-button|social/i.test(
    String(u || ""),
  );
}

async function download(u) {
  if (!u || isLogoish(u) || isPlaces(u)) return null;
  try {
    const r = await fetch(u, {
      headers: { "User-Agent": "Mozilla/5.0 banditour-recovery" },
      redirect: "follow",
    });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    const ct = r.headers.get("content-type") || "";
    if (buf.length < 20000) return null;
    if (!(/image\//i.test(ct) || buf[0] === 0xff || buf[0] === 0x89 || buf[8] === 0x57)) return null;
    const ext = buf[0] === 0x89 ? "png" : /webp/i.test(ct) || buf[8] === 0x57 ? "webp" : "jpg";
    return { buf, ct: ct.split(";")[0] || "image/jpeg", ext, bytes: buf.length, source: u };
  } catch {
    return null;
  }
}

async function scrape(site) {
  try {
    const r = await fetch(site, {
      headers: { "User-Agent": "Mozilla/5.0 banditour-recovery" },
      redirect: "follow",
    });
    if (!r.ok) return [];
    const html = await r.text();
    const out = [];
    for (const re of [
      /property=["']og:image["'][^>]*content=["']([^"']+)/i,
      /content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
    ]) {
      const m = html.match(re);
      if (m?.[1]) out.push(m[1].replace(/&amp;/g, "&"));
    }
    for (const m of html.matchAll(/src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi)) {
      out.push(m[1].replace(/&amp;/g, "&"));
      if (out.length > 25) break;
    }
    return [...new Set(out)].filter((u) => /^https?:\/\//i.test(u) && !isLogoish(u) && !isPlaces(u));
  } catch {
    return [];
  }
}

const { data: events } = await admin
  .from("event")
  .select("id,name,image_url,link")
  .eq("city", "Athens");

const need = (events || []).filter(
  (e) =>
    (isPlaces(e.image_url) || /pexels\.com/i.test(e.image_url || "")) &&
    e.link &&
    /^https?:\/\//i.test(e.link) &&
    !/google\.com\/maps|instagram\.com|facebook\.com/i.test(e.link),
);

const report = { attempted: 0, updated: 0, failed: 0, samples: [] };
for (const e of need.slice(0, LIMIT)) {
  report.attempted++;
  let done = false;
  const cands = await scrape(e.link);
  for (const c of cands.slice(0, 10)) {
    const dl = await download(c);
    if (!dl) continue;
    try {
      const path = `venue_heroes/athens/${e.id}/hero-${Date.now()}.${dl.ext}`;
      const { error: upErr } = await admin.storage.from("banditsassets4").upload(path, dl.buf, {
        contentType: dl.ct,
        upsert: true,
      });
      if (upErr) continue;
      const pub = admin.storage.from("banditsassets4").getPublicUrl(path).data.publicUrl;
      const { error } = await admin
        .from("event")
        .update({ image_url: pub, image_gallery: JSON.stringify([pub]) })
        .eq("id", e.id);
      if (!error) {
        report.updated++;
        if (report.samples.length < 15) report.samples.push({ name: e.name, to: pub, bytes: dl.bytes });
        done = true;
        break;
      }
    } catch {
      /* */
    }
  }
  if (!done) report.failed++;
  await new Promise((r) => setTimeout(r, 80));
}

fs.writeFileSync(
  "C:/Users/blonj/banditour workspace system/.data/athens-recovery/batch-website-only.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
