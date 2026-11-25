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

const buf = fs.readFileSync(
  "C:/Users/blonj/banditour workspace system/.data/athens-recovery/dexameni-greeka.jpg",
);
const out = [];
for (const id of IDS) {
  const path = `venue_heroes/athens/${id}/hero-${Date.now()}.jpg`;
  const { error: upErr } = await admin.storage.from("banditsassets4").upload(path, buf, {
    contentType: "image/jpeg",
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
  out.push({ id, error: error?.message || null, to: pub, bytes: buf.length });
}
console.log(JSON.stringify(out, null, 2));
