import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, service, { auth: { persistSession: false } });

const IDS = [
  "f99f6a96-1355-4e3a-81d5-b34490989f33",
  "d8d90967-786a-425b-ac0e-c6c091517b51",
  "cce8094c-84a4-4453-b64e-b189ace08ee0",
  "8a5deed7-de67-4f4a-aa2a-b204f4711014",
];

const candidates = [
  "https://www.greeka.com/photos/og-images/hero/attica/athens/other-businesses/cinema/kolonaki/dexameni/og-dexameni.jpg",
];

// scrape greeka gallery
const page = await fetch("https://www.greeka.com/attica/athens/other-businesses/cinema/kolonaki/dexameni/", {
  headers: { "User-Agent": "Mozilla/5.0 banditour-recovery" },
});
if (page.ok) {
  const html = await page.text();
  for (const m of html.matchAll(/https:\/\/www\.greeka\.com\/photos\/[^"'\\\s>]+\.(?:jpg|jpeg|png|webp)/gi)) {
    candidates.push(m[0]);
  }
}

console.log("candidates", [...new Set(candidates)]);

let dl = null;
for (const u of [...new Set(candidates)]) {
  const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0 banditour-recovery" } });
  if (!r.ok) {
    console.log("fail", r.status, u);
    continue;
  }
  const buf = Buffer.from(await r.arrayBuffer());
  const ct = r.headers.get("content-type") || "";
  console.log("got", r.status, buf.length, ct, u);
  if (buf.length < 15000) continue;
  if (!(/image\//i.test(ct) || buf[0] === 0xff || buf[0] === 0x89)) continue;
  dl = { buf, ct: ct.split(";")[0] || "image/jpeg", ext: buf[0] === 0x89 ? "png" : "jpg", bytes: buf.length, source: u };
  break;
}

if (!dl) {
  console.error("no image");
  process.exit(1);
}

const out = [];
for (const id of IDS) {
  const path = `venue_heroes/athens/${id}/hero-${Date.now()}.${dl.ext}`;
  const { error: upErr } = await admin.storage.from("banditsassets4").upload(path, dl.buf, {
    contentType: dl.ct,
    upsert: true,
  });
  if (upErr) {
    out.push({ id, error: upErr.message });
    continue;
  }
  const pub = admin.storage.from("banditsassets4").getPublicUrl(path).data.publicUrl;
  const { error } = await admin
    .from("event")
    .update({ image_url: pub, image_gallery: JSON.stringify([pub]) })
    .eq("id", id);
  out.push({ id, error: error?.message || null, to: pub, bytes: dl.bytes, source: dl.source });
}
console.log(JSON.stringify(out, null, 2));
