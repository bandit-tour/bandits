/**
 * Recover Athens venue heroes to durable Supabase storage.
 * - Prefer sibling durable rows for same venue name family
 * - Prefer official website OG/photos (no Places quota in browser)
 * - Optionally rehost Places media via server GOOGLE_PLACES_API_KEY → storage
 * Never writes stock/Pexels. Never invents ratings. Preserves IDs.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const placesKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "";
if (!url || !service) {
  console.error("Missing SUPABASE URL or SERVICE_ROLE_KEY");
  process.exit(1);
}
const admin = createClient(url, service, { auth: { persistSession: false } });

const FOUNDER_TARGETS = [
  {
    match: /^Kinono$/i,
    sites: ["https://kinono.gr", "https://www.kinono.gr", "https://kinonoathens.com"],
  },
  {
    match: /Kong Athens Vintage/i,
    sibling: /King Kong Athens Vintage/i,
    sites: ["https://www.instagram.com/kongathens/", "https://kongathens.com"],
  },
  {
    match: /Hammam Baths/i,
    sites: [
      "https://www.hammam.gr",
      "https://hammam.gr",
      "https://www.athenshammam.com",
      "https://thissiohammam.gr",
    ],
  },
  {
    match: /Dexameni/i,
    sites: [
      "https://www.cinedexameni.gr",
      "https://cinedexameni.gr",
      "https://www.dexameni.gr",
    ],
  },
  {
    match: /^Akira Sushi/i,
    sibling: /Akira Sushi Bar/i,
    sites: ["https://akirasushibar.gr", "https://www.akirasushi.gr", "https://akira.gr"],
  },
];

function isPlaces(u) {
  return /places\.googleapis\.com|maps\.googleapis\.com\/maps\/api\/place/i.test(String(u || ""));
}
function isDurable(u) {
  return /supabase\.co\/storage/i.test(String(u || ""));
}
function isLogoish(u) {
  return /logo|slogan|icon|favicon|sprite|avatar|badge|pixel|1x1|tracking|share-button|social/i.test(
    String(u || ""),
  );
}

async function download(u, { minBytes = 20000 } = {}) {
  if (!u || isLogoish(u)) return null;
  const r = await fetch(u, {
    headers: { "User-Agent": "Mozilla/5.0 banditour-recovery" },
    redirect: "follow",
  });
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  const ct = r.headers.get("content-type") || "";
  if (buf.length < minBytes) return null;
  if (!(/image\//i.test(ct) || buf[0] === 0xff || buf[0] === 0x89 || buf[0] === 0x52)) return null;
  const ext = buf[0] === 0x89 ? "png" : /webp/i.test(ct) ? "webp" : "jpg";
  return { buf, ct: ct.split(";")[0] || "image/jpeg", ext, bytes: buf.length, source: u };
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
      /name=["']twitter:image["'][^>]*content=["']([^"']+)/i,
    ]) {
      const m = html.match(re);
      if (m?.[1]) out.push(m[1].replace(/&amp;/g, "&"));
    }
    for (const m of html.matchAll(/src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi)) {
      out.push(m[1].replace(/&amp;/g, "&"));
      if (out.length > 40) break;
    }
    return [...new Set(out)].filter((u) => /^https?:\/\//i.test(u) && !isLogoish(u) && !isPlaces(u));
  } catch {
    return [];
  }
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

async function placesPhotoToBytes(placeId) {
  if (!placesKey || !placeId) return null;
  const details = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      headers: {
        "X-Goog-Api-Key": placesKey,
        "X-Goog-FieldMask": "photos",
      },
    },
  );
  if (!details.ok) return null;
  const j = await details.json();
  const photoName = j?.photos?.[0]?.name;
  if (!photoName) return null;
  const media = await fetch(
    `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1600&maxHeightPx=1200&key=${encodeURIComponent(placesKey)}`,
    { redirect: "follow" },
  );
  if (!media.ok) return null;
  const buf = Buffer.from(await media.arrayBuffer());
  if (buf.length < 20000) return null;
  const ct = media.headers.get("content-type") || "image/jpeg";
  const ext = /png/i.test(ct) ? "png" : /webp/i.test(ct) ? "webp" : "jpg";
  return { buf, ct, ext, bytes: buf.length, source: `places:${placeId}` };
}

async function probeOk(u) {
  if (!u || !isDurable(u)) return false;
  try {
    const r = await fetch(u);
    const n = (await r.arrayBuffer()).byteLength;
    return r.ok && n >= 8000;
  } catch {
    return false;
  }
}

const { data: events } = await admin
  .from("event")
  .select("id,name,image_url,image_gallery,google_place_id,city,link")
  .eq("city", "Athens");

const report = {
  founderUpdated: [],
  founderFailed: [],
  batchUpdated: 0,
  batchFailed: 0,
  skippedAlreadyDurable: 0,
};

// --- Founder first ---
for (const t of FOUNDER_TARGETS) {
  const rows = (events || []).filter((e) => t.match.test(e.name));
  for (const e of rows) {
    if (await probeOk(e.image_url)) {
      report.skippedAlreadyDurable++;
      continue;
    }
    let done = false;

    // Sibling durable copy
    if (t.sibling) {
      const sib = (events || []).find((x) => t.sibling.test(x.name) && isDurable(x.image_url));
      if (sib && (await probeOk(sib.image_url))) {
        const { error } = await admin
          .from("event")
          .update({
            image_url: sib.image_url,
            image_gallery: JSON.stringify([sib.image_url]),
          })
          .eq("id", e.id);
        if (!error) {
          report.founderUpdated.push({
            name: e.name,
            id: e.id,
            method: "sibling_copy",
            from: sib.name,
            to: sib.image_url,
          });
          done = true;
        }
      }
    }

    // Official sites
    if (!done) {
      const sites = [...(t.sites || [])];
      if (e.link && /^https?:\/\//i.test(e.link) && !/google\.com\/maps/i.test(e.link)) {
        sites.unshift(e.link);
      }
      for (const site of [...new Set(sites)]) {
        const cands = await scrape(site);
        for (const c of cands.slice(0, 12)) {
          try {
            const dl = await download(c);
            if (!dl) continue;
            const pub = await rehost(e.id, dl);
            const { error } = await admin
              .from("event")
              .update({ image_url: pub, image_gallery: JSON.stringify([pub]) })
              .eq("id", e.id);
            if (!error) {
              report.founderUpdated.push({
                name: e.name,
                id: e.id,
                method: "website",
                source: c,
                to: pub,
                bytes: dl.bytes,
              });
              done = true;
              break;
            }
          } catch {
            /* next */
          }
        }
        if (done) break;
      }
    }

    // Server Places → durable rehost
    if (!done && e.google_place_id) {
      try {
        const dl = await placesPhotoToBytes(e.google_place_id);
        if (dl) {
          const pub = await rehost(e.id, dl);
          const { error } = await admin
            .from("event")
            .update({ image_url: pub, image_gallery: JSON.stringify([pub]) })
            .eq("id", e.id);
          if (!error) {
            report.founderUpdated.push({
              name: e.name,
              id: e.id,
              method: "places_rehost",
              to: pub,
              bytes: dl.bytes,
            });
            done = true;
          }
        }
      } catch {
        /* fail */
      }
    }

    if (!done) report.founderFailed.push({ name: e.name, id: e.id, placeId: e.google_place_id });
  }
}

// --- Batch remaining Places/pexels (limit) ---
const LIMIT = Number(process.env.ATHENS_PHOTO_LIMIT || 60);
const need = (events || []).filter((e) => isPlaces(e.image_url) || /pexels\.com/i.test(e.image_url || ""));
let processed = 0;
for (const e of need) {
  if (processed >= LIMIT) break;
  // skip if already updated in founder pass
  if (report.founderUpdated.some((x) => x.id === e.id)) continue;
  processed++;
  let done = false;
  if (e.google_place_id && placesKey) {
    try {
      const dl = await placesPhotoToBytes(e.google_place_id);
      if (dl) {
        const pub = await rehost(e.id, dl);
        const { error } = await admin
          .from("event")
          .update({ image_url: pub, image_gallery: JSON.stringify([pub]) })
          .eq("id", e.id);
        if (!error) {
          report.batchUpdated++;
          done = true;
        }
      }
    } catch {
      /* next */
    }
  }
  if (!done && e.link && /^https?:\/\//i.test(e.link) && !/google\.com\/maps/i.test(e.link)) {
    const cands = await scrape(e.link);
    for (const c of cands.slice(0, 8)) {
      try {
        const dl = await download(c);
        if (!dl) continue;
        const pub = await rehost(e.id, dl);
        const { error } = await admin
          .from("event")
          .update({ image_url: pub, image_gallery: JSON.stringify([pub]) })
          .eq("id", e.id);
        if (!error) {
          report.batchUpdated++;
          done = true;
          break;
        }
      } catch {
        /* next */
      }
    }
  }
  if (!done) report.batchFailed++;
  await new Promise((r) => setTimeout(r, 120));
}

// Final founder probe
report.verify = [];
const { data: after } = await admin
  .from("event")
  .select("id,name,image_url")
  .eq("city", "Athens");
for (const name of ["Kinono", "Kong Athens Vintage", "Hammam Baths Thissio", "Dexameni Outdoor Cinema", "Akira Sushi"]) {
  const rows = (after || []).filter((e) => e.name === name || e.name?.startsWith(name));
  for (const e of rows.slice(0, 3)) {
    try {
      const r = await fetch(e.image_url);
      const bytes = (await r.arrayBuffer()).byteLength;
      report.verify.push({
        name: e.name,
        id: e.id,
        host: new URL(e.image_url).host,
        status: r.status,
        bytes,
        ok: r.ok && bytes >= 8000 && !isPlaces(e.image_url),
      });
    } catch (err) {
      report.verify.push({ name: e.name, id: e.id, ok: false, error: err.message });
    }
  }
}

const hosts = {};
let durable = 0;
for (const e of after || []) {
  try {
    const h = new URL(e.image_url).host;
    hosts[h] = (hosts[h] || 0) + 1;
    if (/supabase\.co/i.test(h)) durable++;
  } catch {
    hosts.bad = (hosts.bad || 0) + 1;
  }
}
report.hostsAfter = hosts;
report.durableAfter = durable;
report.total = after?.length || 0;

fs.writeFileSync(
  "C:/Users/blonj/banditour workspace system/.data/athens-recovery/founder-batch-recover.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
