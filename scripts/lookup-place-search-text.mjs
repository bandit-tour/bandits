import fs from 'node:fs';
import path from 'node:path';

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

const q = process.argv.slice(2).join(' ') || 'Tromero Paidi Papadiamantopoulou 30 Athens';

loadEnvFile(path.join(process.cwd(), '.env'));
const k = String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '').trim();
if (!k) throw new Error('no key');

const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': k,
    'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
  },
  body: JSON.stringify({ textQuery: q, languageCode: 'en', regionCode: 'GR' }),
});
const j = await r.json();
console.log(JSON.stringify(j, null, 2));
