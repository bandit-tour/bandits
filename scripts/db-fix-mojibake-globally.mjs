/**
 * Rewrites mojibake (UTF-8 mis-decoded as Latin-1/Windows-1252) in text columns.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and EXPO_PUBLIC_SUPABASE_URL in `.env` (repo root).
 *
 *   node scripts/db-fix-mojibake-globally.mjs
 *   DRY_RUN=1 node scripts/db-fix-mojibake-globally.mjs
 *
 * Encoding: this file is UTF-8; reads/writes JSON from Supabase as UTF-8.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { repairDisplayText } from './repairMojibakeText.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value === '') continue;
    if (String(process.env[key] ?? '').trim() === '') process.env[key] = value;
  }
}

loadEnvFile(path.join(ROOT, '.env'));

const url = String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
const dryRun = String(process.env.DRY_RUN ?? '').trim() === '1';

if (!url || !key) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

/** Heuristic: leftover UTF-8-as-Latin1 mojibake (avoid flagging normal “€” prices). */
function stillLooksMojibaked(s) {
  if (!s || typeof s !== 'string') return false;
  return (
    s.includes('â€') ||
    s.includes('â€œ') ||
    s.includes('â€') ||
    s.includes('â€™') ||
    s.includes('â€“') ||
    s.includes('â€¦')
  );
}

const JOBS = [
  { table: 'event', idCol: 'id', cols: ['name', 'description', 'timing_info', 'address', 'neighborhood'] },
  { table: 'bandit', idCol: 'id', cols: ['description', 'why_follow'] },
  { table: 'bandit_event', idCol: 'id', cols: ['personal_tip'] },
  // Production `spots` may predate address/neighborhood columns; keep text-only.
  { table: 'spots', idCol: 'id', cols: ['description'] },
  { table: 'trails', idCol: 'id', cols: ['title', 'description', 'mood', 'duration'] },
  { table: 'trail_stops', idCol: 'id', cols: ['stop_name', 'note'] },
];

/** Some projects expose `recommendation_place` (not in all repo snapshots). */
const OPTIONAL_JOBS = [
  {
    table: 'recommendation_place',
    idCol: 'id',
    cols: ['name', 'description', 'why_recommended', 'bandit_tip', 'opening_hours_text'],
  },
];

function isMissingTableOrColumnError(msg) {
  const m = String(msg ?? '');
  return /does not exist|schema cache|Could not find the table/i.test(m);
}

const PAGE = 400;

async function repairTable(job, { optional = false } = {}) {
  const { table, idCol, cols } = job;
  const selectList = [idCol, ...cols].join(',');
  let from = 0;
  let updatedRows = 0;
  let touchedCells = 0;

  while (true) {
    const { data, error } = await supabase.from(table).select(selectList).range(from, from + PAGE - 1);
    if (error) {
      if (optional && isMissingTableOrColumnError(error.message)) {
        console.log(`${table}: skip (${error.message})`);
        return { updatedRows: 0, touchedCells: 0, skipped: true };
      }
      throw new Error(`${table} select: ${error.message}`);
    }
    const rows = data ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      const patch = {};
      for (const col of cols) {
        const v = row[col];
        if (typeof v !== 'string' || v.length === 0) continue;
        const fixed = repairDisplayText(v);
        if (fixed !== v) {
          patch[col] = fixed;
          touchedCells += 1;
        }
      }
      if (Object.keys(patch).length === 0) continue;
      updatedRows += 1;
      if (!dryRun) {
        const { error: uErr } = await supabase.from(table).update(patch).eq(idCol, row[idCol]);
        if (uErr) {
          if (optional && isMissingTableOrColumnError(uErr.message)) {
            console.log(`${table}: skip during update (${uErr.message})`);
            return { updatedRows: 0, touchedCells: 0, skipped: true };
          }
          throw new Error(`${table} update ${row[idCol]}: ${uErr.message}`);
        }
      }
    }

    from += rows.length;
    if (rows.length < PAGE) break;
  }

  return { updatedRows, touchedCells, skipped: false };
}

async function countSuspectCells() {
  let suspects = 0;
  const allJobs = [...JOBS, ...OPTIONAL_JOBS];
  for (const job of allJobs) {
    const { table, cols } = job;
    const selectList = ['id', ...cols].join(',');
    let from = 0;
    while (true) {
      const { data, error } = await supabase.from(table).select(selectList).range(from, from + PAGE - 1);
      if (error) {
        if (isMissingTableOrColumnError(error.message)) break;
        throw error;
      }
      const rows = data ?? [];
      if (!rows.length) break;
      for (const row of rows) {
        for (const col of cols) {
          const v = row[col];
          if (typeof v === 'string' && stillLooksMojibaked(v)) suspects += 1;
        }
      }
      from += rows.length;
      if (rows.length < PAGE) break;
    }
  }
  return suspects;
}

async function main() {
  console.log(dryRun ? 'DRY_RUN: no writes' : 'Applying updates…');

  let totalRows = 0;
  let totalCells = 0;
  for (const job of JOBS) {
    const r = await repairTable(job);
    console.log(
      `${job.table}: rows with ≥1 fixed column = ${r.updatedRows}, cell updates = ${r.touchedCells}`,
    );
    totalRows += r.updatedRows;
    totalCells += r.touchedCells;
  }
  for (const job of OPTIONAL_JOBS) {
    const r = await repairTable(job, { optional: true });
    if (r.skipped) continue;
    console.log(
      `${job.table}: rows with ≥1 fixed column = ${r.updatedRows}, cell updates = ${r.touchedCells}`,
    );
    totalRows += r.updatedRows;
    totalCells += r.touchedCells;
  }
  console.log(`Done. Total rows patched: ${totalRows}, total cells: ${totalCells}`);

  const remaining = await countSuspectCells();
  console.log(`Post-check: text cells still matching mojibake heuristics ≈ ${remaining} (0 is ideal)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
