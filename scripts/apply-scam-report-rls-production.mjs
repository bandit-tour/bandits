/**
 * Apply scam_alerts RLS + notify + uuid-cast fixes to production Postgres (034–035, 037, 038).
 * Requires .env: SUPABASE_DB_PASSWORD (Supabase → Settings → Database).
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
for (const name of ['.env', '.env.local', '.env.production.local']) {
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
const sqlFiles = [
  join(root, 'supabase', 'migrations', '034_scam_alerts_insert_authenticated_and_anon.sql'),
  join(root, 'supabase', 'migrations', '035_scam_alerts_notify_operator_fix_uuid_cast.sql'),
  join(root, 'supabase', 'migrations', '037_uuid_cast_nullif_precedence.sql'),
  join(root, 'supabase', 'migrations', '038_safe_uuid_text_cast.sql'),
  join(root, 'supabase', 'migrations', '039_scam_report_notify_safe_uuid.sql'),
  join(root, 'supabase', 'migrations', '041_scam_alerts_notify_reported_by_text_guard.sql'),
  join(root, 'supabase', 'migrations', '042_scam_notify_operator_user_profile_optional.sql'),
  join(root, 'supabase', 'migrations', '043_scam_alert_delete_cleanup_notification.sql'),
  join(root, 'supabase', 'migrations', '044_scam_alert_delete_notify_rls_safe.sql'),
  join(root, 'supabase', 'migrations', '045_scam_alert_delete_notify_owner_and_refs.sql'),
];

if (!pass) {
  console.error('Missing SUPABASE_DB_PASSWORD in .env');
  process.exit(1);
}
for (const f of sqlFiles) {
  if (!existsSync(f)) {
    console.error('Missing', f);
    process.exit(1);
  }
}

const enc = encodeURIComponent(pass);
const url = `postgresql://postgres:${enc}@db.${projectRef}.supabase.co:5432/postgres`;
for (const sqlFile of sqlFiles) {
  console.error('Applying', sqlFile);
  const r = spawnSync('npx', ['supabase', 'db', 'query', '-f', sqlFile, '--db-url', url], {
    stdio: 'inherit',
    shell: true,
    cwd: root,
  });
  if (r.status !== 0) process.exit(r.status === null ? 1 : r.status);
}
process.exit(0);
