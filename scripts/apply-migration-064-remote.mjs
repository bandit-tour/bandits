/**
 * Apply user_push_tokens table (064) to production Postgres.
 * Requires .env: SUPABASE_DB_PASSWORD (Supabase → Settings → Database).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
for (const name of ['.env', '.env.local']) {
  const envPath = join(root, name);
  if (!existsSync(envPath)) continue;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    if (line.startsWith('#') || !line.trim()) continue;
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}

const projectRef = 'zubcakeamyfqatdmleqx';
const pass = process.env.SUPABASE_DB_PASSWORD;
const sqlFile = join(root, 'supabase', 'migrations', '064_user_push_tokens.sql');

if (!pass) {
  console.error('Missing SUPABASE_DB_PASSWORD — apply 064 in Supabase SQL editor manually.');
  process.exit(1);
}

if (!existsSync(sqlFile)) {
  console.error('Missing', sqlFile);
  process.exit(1);
}

const enc = encodeURIComponent(pass);
const url = `postgresql://postgres:${enc}@db.${projectRef}.supabase.co:5432/postgres`;
console.error('Applying', sqlFile);
const r = spawnSync('npx', ['supabase', 'db', 'query', '-f', sqlFile, '--db-url', url], {
  stdio: 'inherit',
  shell: true,
  cwd: root,
});
if (r.status !== 0) process.exit(r.status === null ? 1 : r.status);
console.log('Applied 064_user_push_tokens');
