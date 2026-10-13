import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (v && String(process.env[k] ?? '').trim() === '') process.env[k] = v;
  }
}

const TROMERO_ID = 'd2d8dee1-69df-4910-b83c-248354bd9fa6';

async function main() {
  loadEnvFile(path.join(process.cwd(), '.env'));
  const url = String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { error } = await supabase
    .from('event')
    .update({
      address: 'Papadiamantopoulou 30, Ilissia, Athens 115 28, Greece',
      city: 'Athens',
      neighborhood: 'Ilisia',
      location_lat: 37.9872,
      location_lng: 23.7554,
    })
    .eq('id', TROMERO_ID);
  if (error) throw error;
  console.log('Updated TromeroPaidi row with canonical address for Places matching.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
