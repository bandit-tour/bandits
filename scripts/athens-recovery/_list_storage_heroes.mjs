import { createClient } from "@supabase/supabase-js";
const url = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, service, { auth: { persistSession: false } });

async function listAll(prefix) {
  const out = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await admin.storage.from("banditsassets4").list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    out.push(...data);
    if (data.length < 100) break;
    offset += data.length;
  }
  return out;
}

const athens = await listAll("venue_heroes/athens");
console.log("athens dirs", athens.length);
// sample ids we care about
const want = new Set([
  "914996fb-ebe7-432e-8f5d-722b977d9562", // Kinono
  "f99f6a96-1355-4e3a-81d5-b34490989f33",
  "d8d90967-786a-425b-ac0e-c6c091517b51",
  "cce8094c-84a4-4453-b64e-b189ace08ee0",
  "8a5deed7-de67-4f4a-aa2a-b204f4711014",
  "42d6d9a4-c552-4234-9878-856cab7cf1e8",
  "20b97726-9c15-42ce-916a-c9cc3f05d9d9",
  "9bcfc862-0c5e-4369-bbb2-913653577572",
]);
const hits = athens.filter((d) => want.has(d.name));
console.log("wanted dirs present", hits.map((h) => h.name));

for (const id of want) {
  const files = await listAll(`venue_heroes/athens/${id}`);
  if (files.length) console.log(id, files.map((f) => `${f.name}:${f.metadata?.size || "?"}`));
}
