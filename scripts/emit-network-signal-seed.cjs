/**
 * Reads lib/signalBank.ts and prints SQL INSERT rows for network_signal seed.
 * Run: node scripts/emit-network-signal-seed.cjs
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'lib', 'signalBank.ts'), 'utf8');
const m = src.match(/export const SIGNAL_BANK_LINES = \[([\s\S]*?)\]\s*as const/);
if (!m) {
  console.error('Could not parse SIGNAL_BANK_LINES');
  process.exit(1);
}
const block = m[1];
const lines = [];
const re = /'((?:\\'|[^'])*)'/g;
let mm;
while ((mm = re.exec(block)) !== null) {
  const raw = mm[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  lines.push(raw);
}

let sql = `insert into public.network_signal (body, brand, sort_index, is_active)\nvalues\n`;
sql += lines
  .map((body, i) => {
    const esc = body.replace(/'/g, "''");
    return `  ('${esc}', 'all', ${i + 1}, true)`;
  })
  .join(',\n');
sql += ';\n';
process.stdout.write(sql);
