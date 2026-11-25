import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, service, { auth: { persistSession: false } });

const NAMES = [
  "Kinono",
  "Kong Athens Vintage",
  "Hammam Baths Thissio",
  "Dexameni Outdoor Cinema",
  "Akira Sushi",
];

const { data: events } = await admin
  .from("event")
  .select("id,name,image_url,city")
  .eq("city", "Athens");

const { count: total } = await admin
  .from("event")
  .select("id", { count: "exact", head: true })
  .eq("city", "Athens");

let durableOk = 0;
let placesLeft = 0;
const hosts = {};
for (const e of events || []) {
  try {
    const h = new URL(e.image_url).host;
    hosts[h] = (hosts[h] || 0) + 1;
    if (/places\.googleapis/i.test(h)) placesLeft++;
  } catch {
    hosts.bad = (hosts.bad || 0) + 1;
  }
}

const founder = [];
for (const name of NAMES) {
  const rows = (events || []).filter((e) => e.name === name || e.name?.startsWith(name));
  for (const e of rows) {
    const r = await fetch(e.image_url);
    const buf = Buffer.from(await r.arrayBuffer());
    const ct = r.headers.get("content-type") || "";
    const ok =
      r.ok &&
      buf.length >= 8000 &&
      /supabase\.co\/storage/i.test(e.image_url) &&
      (/image\//i.test(ct) || buf[0] === 0xff || buf[0] === 0x89 || buf[8] === 0x57);
    if (ok) durableOk++;
    founder.push({
      id: e.id,
      name: e.name,
      host: (() => {
        try {
          return new URL(e.image_url).host;
        } catch {
          return "bad";
        }
      })(),
      status: r.status,
      bytes: buf.length,
      ct,
      ok,
      url: e.image_url,
    });
  }
}

// overall durable probe sample of non-founder supabase
const report = {
  publishedPlaces: total ?? events?.length ?? 0,
  hosts,
  placesEphemeralRemaining: placesLeft,
  founder,
  founderAllOk: founder.every((f) => f.ok),
};
fs.writeFileSync(
  "C:/Users/blonj/banditour workspace system/.data/athens-recovery/founder-verify.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
