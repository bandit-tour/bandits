/**
 * Targeted recovery for Kinono + Dexameni rows still on Places 429.
 * Sources: official sites, known venue pages, Wikimedia Commons of the actual place.
 * No stock. No generated. Preserves IDs.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const placesKey = process.env.GOOGLE_PLACES_API_KEY || "";
if (!url || !service) {
  console.error("Missing credentials");
  process.exit(1);
}
const admin = createClient(url, service, { auth: { persistSession: false } });

const TARGETS = [
  {
    id: "914996fb-ebe7-432e-8f5d-722b977d9562",
    name: "Kinono",
    placeId: "ChIJWYfPyBq9oRQRK6BK4eSve1k",
    sites: [
      "https://kinono.gr",
      "https://www.kinono.gr",
      "https://kinonoathens.com",
      "https://www.instagram.com/kinonoathens/",
      "https://www.facebook.com/kinonoathens/",
    ],
    direct: [
      // Official / press / maps CDN candidates tried at runtime via scrape + Places
    ],
  },
  {
    ids: [
      "f99f6a96-1355-4e3a-81d5-b34490989f33",
      "d8d90967-786a-425b-ac0e-c6c091517b51",
      "cce8094c-84a4-4453-b64e-b189ace08ee0",
      "8a5deed7-de67-4f4a-aa2a-b204f4711014",
    ],
    name: "Dexameni Outdoor Cinema",
    placeId: "ChIJ0XLwm0e9oRQR2t1yAkLYZbg",
    sites: [
      "https://www.cinedexameni.gr",
      "https://cinedexameni.gr",
      "https://cine-dexameni.gr",
      "https://www.athensattica.com/experiences/cine-dexameni/",
      "https://www.thisisathens.org/things-to-do/cinema/cine-dexameni/",
      "https://en.wikipedia.org/wiki/Dexameni",
    ],
    commonsSearch: "Cine Dexameni Athens",
  },
];

function isPlaces(u) {
  return /places\.googleapis\.com|maps\.googleapis\.com\/maps\/api\/place/i.test(String(u || ""));
}
function isLogoish(u) {
  return /logo|slogan|icon|favicon|sprite|avatar|badge|pixel|1x1|tracking|share-button|social|og_plain/i.test(
    String(u || ""),
  );
}

async function download(u, { minBytes = 15000 } = {}) {
  if (!u || isLogoish(u) || isPlaces(u)) return null;
  try {
    const r = await fetch(u, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; banditour-recovery/1.0)" },
      redirect: "follow",
    });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    const ct = r.headers.get("content-type") || "";
    if (buf.length < minBytes) return null;
    if (!(/image\//i.test(ct) || buf[0] === 0xff || buf[0] === 0x89 || buf[0] === 0x52)) return null;
    const ext = buf[0] === 0x89 ? "png" : /webp/i.test(ct) ? "webp" : "jpg";
    return { buf, ct: ct.split(";")[0] || "image/jpeg", ext, bytes: buf.length, source: u };
  } catch {
    return null;
  }
}

async function scrape(site) {
  try {
    const r = await fetch(site, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; banditour-recovery/1.0)" },
      redirect: "follow",
    });
    if (!r.ok) {
      console.log("site fail", site, r.status);
      return [];
    }
    const html = await r.text();
    const out = [];
    for (const re of [
      /property=["']og:image["'][^>]*content=["']([^"']+)/i,
      /content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
      /name=["']twitter:image["'][^>]*content=["']([^"']+)/i,
      /rel=["']image_src["'][^>]*href=["']([^"']+)/i,
    ]) {
      const m = html.match(re);
      if (m?.[1]) out.push(m[1].replace(/&amp;/g, "&"));
    }
    for (const m of html.matchAll(
      /(?:src|data-src|content)=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi,
    )) {
      out.push(m[1].replace(/&amp;/g, "&"));
      if (out.length > 60) break;
    }
    // relative paths
    for (const m of html.matchAll(/(?:src|href)=["'](\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi)) {
      try {
        out.push(new URL(m[1], site).href);
      } catch {
        /* */
      }
    }
    return [...new Set(out)].filter((u) => /^https?:\/\//i.test(u) && !isLogoish(u) && !isPlaces(u));
  } catch (e) {
    console.log("scrape err", site, e.message);
    return [];
  }
}

async function commonsCandidates(query) {
  try {
    const api = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      query,
    )}&gsrlimit=8&prop=imageinfo&iiprop=url|size|mime&format=json&origin=*`;
    const r = await fetch(api, { headers: { "User-Agent": "banditour-recovery" } });
    if (!r.ok) return [];
    const j = await r.json();
    const pages = Object.values(j?.query?.pages || {});
    return pages
      .map((p) => p?.imageinfo?.[0])
      .filter((ii) => ii?.url && ii?.size > 40000 && /image\//i.test(ii?.mime || ""))
      .map((ii) => ii.url);
  } catch {
    return [];
  }
}

async function placesPhoto(placeId) {
  if (!placesKey || !placeId) {
    console.log("places skip", { hasKey: !!placesKey, placeId });
    return null;
  }
  const details = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: { "X-Goog-Api-Key": placesKey, "X-Goog-FieldMask": "photos,displayName" },
  });
  const body = await details.text();
  console.log("places details", placeId, details.status, body.slice(0, 180));
  if (!details.ok) return null;
  const j = JSON.parse(body);
  const photoName = j?.photos?.[0]?.name;
  if (!photoName) return null;
  const media = await fetch(
    `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1600&maxHeightPx=1200&key=${encodeURIComponent(placesKey)}`,
    { redirect: "follow" },
  );
  console.log("places media", media.status, media.headers.get("content-type"));
  if (!media.ok) return null;
  const buf = Buffer.from(await media.arrayBuffer());
  if (buf.length < 20000) return null;
  const ct = media.headers.get("content-type") || "image/jpeg";
  const ext = /png/i.test(ct) ? "png" : /webp/i.test(ct) ? "webp" : "jpg";
  return { buf, ct, ext, bytes: buf.length, source: `places:${placeId}` };
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

async function apply(id, dl, method) {
  const pub = await rehost(id, dl);
  const { error } = await admin
    .from("event")
    .update({ image_url: pub, image_gallery: JSON.stringify([pub]) })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { id, method, source: dl.source, to: pub, bytes: dl.bytes };
}

const report = { updated: [], failed: [], placesKeyLen: placesKey.length };

for (const t of TARGETS) {
  const ids = t.ids || [t.id];
  let sharedDl = null;

  // Places first (original Google photo for the place)
  sharedDl = await placesPhoto(t.placeId);

  if (!sharedDl) {
    for (const site of t.sites || []) {
      const cands = await scrape(site);
      console.log("scraped", site, cands.length, cands.slice(0, 3));
      for (const c of cands.slice(0, 20)) {
        const dl = await download(c);
        if (dl) {
          sharedDl = dl;
          break;
        }
      }
      if (sharedDl) break;
    }
  }

  if (!sharedDl && t.commonsSearch) {
    const commons = await commonsCandidates(t.commonsSearch);
    console.log("commons", t.commonsSearch, commons.length, commons.slice(0, 3));
    for (const c of commons) {
      const dl = await download(c, { minBytes: 40000 });
      if (dl) {
        sharedDl = dl;
        break;
      }
    }
  }

  if (!sharedDl) {
    for (const id of ids) report.failed.push({ id, name: t.name, reason: "no_source" });
    continue;
  }

  for (const id of ids) {
    try {
      report.updated.push(await apply(id, sharedDl, sharedDl.source.startsWith("places:") ? "places_rehost" : "web_or_commons"));
    } catch (e) {
      report.failed.push({ id, name: t.name, reason: e.message });
    }
  }
}

fs.writeFileSync(
  "C:/Users/blonj/banditour workspace system/.data/athens-recovery/founder-remaining.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
