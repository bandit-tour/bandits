/**
 * Find rows by partial text snippet (raw chars). Prints row id, name, snippet, and any mojibake markers.
 *   node scripts/find-row-by-text.mjs "stylish Kolonaki hotspot"
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
loadEnvFile(path.join(ROOT, '.env'));
const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const queries = process.argv.slice(2);
if (!queries.length) {
  console.error('Usage: node scripts/find-row-by-text.mjs "snippet 1" "snippet 2" ...');
  process.exit(1);
}

const TABLES = [
  { table: 'event', cols: ['name', 'description', 'timing_info', 'address'] },
  { table: 'bandit', cols: ['name', 'description', 'why_follow'] },
  { table: 'bandit_event', cols: ['personal_tip'] },
  { table: 'spots', cols: ['name', 'description'] },
];

function listMojibake(s) {
  const m = [];
  if (s.includes('â€')) m.push('â€');
  if (/Ã[©¨­³ºñöüáéíóú]/.test(s)) m.push('Ã*');
  return m;
}

for (const q of queries) {
  console.log(`\n== Searching for: ${JSON.stringify(q)} ==`);
  for (const { table, cols } of TABLES) {
    for (const col of cols) {
      const { data, error } = await supabase
        .from(table)
        .select(['id', 'name', col].join(','))
        .ilike(col, `%${q}%`)
        .limit(5);
      if (error) continue;
      for (const row of data ?? []) {
        const v = String(row[col] ?? '');
        const markers = listMojibake(v);
        const idx = v.toLowerCase().indexOf(q.toLowerCase());
        const start = Math.max(0, idx - 30);
        const snippet = v.slice(start, start + 140).replace(/\s+/g, ' ');
        console.log(`${table}.${col} id=${row.id} markers=${markers.join(',') || 'none'}\n  …${snippet}…`);
      }
    }
  }
}
