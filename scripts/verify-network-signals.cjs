/**
 * Verifies public.network_signal exists and active row count matches lib/signalBank.ts.
 * Usage: node scripts/verify-network-signals.cjs
 * Requires: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY in .env
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function parseSignalBankLineCount() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'signalBank.ts'), 'utf8');
  const m = src.match(/export const SIGNAL_BANK_LINES = \[([\s\S]*?)\]\s*as const/);
  if (!m) throw new Error('Could not parse SIGNAL_BANK_LINES in lib/signalBank.ts');
  const block = m[1];
  const re = /'((?:\\'|[^'])*)'/g;
  let mm;
  let n = 0;
  while ((mm = re.exec(block)) !== null) {
    n += 1;
  }
  return n;
}

async function main() {
  const expected = parseSignalBankLineCount();
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY (see .env)');
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(url, key);
  const { count, error } = await supabase
    .from('network_signal')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  if (error) {
    console.error('network_signal query failed:', error.message);
    process.exitCode = 1;
    return;
  }

  console.log(`network_signal (is_active=true): ${count} rows — signalBank.ts expects ${expected} lines`);

  if (count !== expected) {
    console.error(
      'Count mismatch. Apply supabase/migrations/020_network_signal_seed_idempotent.sql in the SQL editor or run: npx supabase db push',
    );
    process.exitCode = 1;
    return;
  }

  console.log('OK: table exists and seed count matches signal bank.');
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
