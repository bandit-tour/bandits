/**
 * Locates every column in the public schema where rows still contain mojibake markers.
 * Lists table, row id, column, and a snippet so we can target what was missed.
 *
 * node scripts/find-mojibake-rows.mjs
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

const supabase = createClient(
  String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim(),
  String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim(),
  { auth: { persistSession: false } },
);

// Broad set of tables and text-ish columns to scan.
const SCAN = [
  { table: 'event', cols: ['name', 'description', 'timing_info', 'address', 'neighborhood', 'city'] },
  { table: 'bandit', cols: ['name', 'family_name', 'occupation', 'description', 'why_follow', 'icon', 'city'] },
  { table: 'bandit_event', cols: ['personal_tip'] },
  { table: 'spots', cols: ['name', 'description'] },
  { table: 'trails', cols: ['title', 'description', 'mood', 'duration'] },
  { table: 'trail_stops', cols: ['stop_name', 'note'] },
  { table: 'scam_alerts', cols: ['title', 'description', 'category', 'location'] },
];

const NEEDLES = ['â€', 'Ã©', 'Ã¨', 'Ã­', 'Ã³', 'Ãº', 'Ã±', 'Ã¶', 'Ã¼', 'Ã¡', 'Ã'];

function shortSnippet(s, n = 90) {
  const t = String(s ?? '');
  const idx = NEEDLES.map((x) => t.indexOf(x)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, idx - 20);
  return t.slice(start, start + n);
}

let totalSuspect = 0;
for (const job of SCAN) {
  let from = 0;
  const PAGE = 500;
  while (true) {
    const { data, error } = await supabase
      .from(job.table)
      .select(['id', ...job.cols].join(','))
      .range(from, from + PAGE - 1);
    if (error) {
      console.log(`${job.table}: skip (${error.message})`);
      break;
    }
    const rows = data ?? [];
    if (!rows.length) break;
    for (const row of rows) {
      for (const col of job.cols) {
        const v = row[col];
        if (typeof v !== 'string' || v.length === 0) continue;
        if (NEEDLES.some((n) => v.includes(n))) {
          totalSuspect += 1;
          console.log(`${job.table}.${col} ${row.id} :: ${shortSnippet(v)}`);
        }
      }
    }
    from += rows.length;
    if (rows.length < PAGE) break;
  }
}
console.log(`\nTotal cells with mojibake markers: ${totalSuspect}`);
