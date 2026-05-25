/**
 * One-shot DDL apply (service role only). Set SUPABASE_DB_PASSWORD on Vercel, then:
 * POST /api/apply-db-migration?migration=064
 * Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 */
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const pg = require('pg');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

const ALLOWED = new Set(['064']);

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = req.headers.authorization || '';
  const expected = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!expected || auth !== `Bearer ${expected}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const migration = String(req.query?.migration || '064').trim();
  if (!ALLOWED.has(migration)) {
    return res.status(400).json({ error: 'Unsupported migration' });
  }

  const pass = String(process.env.SUPABASE_DB_PASSWORD || '').trim();
  if (!pass) {
    return res.status(503).json({
      error: 'SUPABASE_DB_PASSWORD not configured on Vercel',
    });
  }

  const projectRef = 'zubcakeamyfqatdmleqx';
  const sqlFile = join(process.cwd(), 'supabase', 'migrations', '064_user_push_tokens.sql');
  if (!existsSync(sqlFile)) {
    return res.status(500).json({ error: 'Migration file missing in deployment' });
  }

  const sql = readFileSync(sqlFile, 'utf8');
  const enc = encodeURIComponent(pass);
  const urls = [
    process.env.SUPABASE_DATABASE_URL,
    `postgresql://postgres.${projectRef}:${enc}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres:${enc}@db.${projectRef}.supabase.co:5432/postgres`,
  ].filter(Boolean);

  let lastErr = null;
  for (const connectionString of urls) {
    const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      await client.query(sql);
      const { rows } = await client.query(`select to_regclass('public.user_push_tokens') as reg`);
      await client.end();
      return res.status(200).json({ ok: true, table: rows[0]?.reg || null });
    } catch (e) {
      lastErr = e;
      await client.end().catch(() => undefined);
    }
  }

  return res.status(500).json({
    error: lastErr instanceof Error ? lastErr.message : String(lastErr),
  });
};
