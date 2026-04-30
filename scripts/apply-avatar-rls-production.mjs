/**
 * Apply storage RLS fix (supabase/migrations/030_profile_avatars_storage_rls_fix.sql) to production.
 * Add your database password to .env: SUPABASE_DB_PASSWORD=... (Settings → Database → database password, reset if unknown).
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const envPath = join(root, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    if (line.startsWith('#') || !line.trim()) continue;
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}

const projectRef = 'zubcakeamyfqatdmleqx';
const pass = process.env.SUPABASE_DB_PASSWORD;
const sqlFile = join(root, 'supabase', 'migrations', '030_profile_avatars_storage_rls_fix.sql');

if (!pass) {
  console.error('Missing SUPABASE_DB_PASSWORD in .env. Get it: Supabase Dashboard → Project → Settings → Database → Database password (reset and save if needed).');
  process.exit(1);
}

if (!existsSync(sqlFile)) {
  console.error('Missing migration file', sqlFile);
  process.exit(1);
}

const enc = encodeURIComponent(pass);
const url = `postgresql://postgres:${enc}@db.${projectRef}.supabase.co:5432/postgres`;
const r = spawnSync('npx', ['supabase', 'db', 'query', '-f', sqlFile, '--db-url', url], { stdio: 'inherit', shell: true, cwd: root });
process.exit(r.status === null ? 1 : r.status);
