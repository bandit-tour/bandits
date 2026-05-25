/**
 * Apply migration 064 via direct Postgres (requires SUPABASE_DB_PASSWORD in .env).
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { config as loadEnv } from 'dotenv';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
loadEnv({ path: join(root, '.env') });
loadEnv({ path: join(root, '.env.local'), override: true });

const projectRef = 'zubcakeamyfqatdmleqx';
const pass = String(process.env.SUPABASE_DB_PASSWORD || '').trim();
const sqlFile = join(root, 'supabase', 'migrations', '064_user_push_tokens.sql');

if (!pass) {
  console.error('Missing SUPABASE_DB_PASSWORD in .env or .env.local');
  process.exit(1);
}

const sql = readFileSync(sqlFile, 'utf8');
const enc = encodeURIComponent(pass);
const connectionString =
  process.env.SUPABASE_DATABASE_URL?.trim() ||
  `postgresql://postgres.${projectRef}:${enc}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(sql);
  console.log('Applied 064_user_push_tokens');
  const { rows } = await client.query(
    `select to_regclass('public.user_push_tokens') as reg`,
  );
  console.log('verify:', rows[0]?.reg || 'missing');
  process.exit(rows[0]?.reg ? 0 : 1);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  if (/password authentication failed|Tenant or user not found/i.test(msg)) {
    const direct = `postgresql://postgres:${enc}@db.${projectRef}.supabase.co:5432/postgres`;
    const c2 = new pg.Client({ connectionString: direct, ssl: { rejectUnauthorized: false } });
    await c2.connect();
    await c2.query(sql);
    await c2.end();
    console.log('Applied 064 via direct db host');
    process.exit(0);
  }
  console.error(msg);
  process.exit(1);
} finally {
  await client.end().catch(() => undefined);
}
