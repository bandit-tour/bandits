/**
 * Service-role delete for Pilot Desk — bypasses RLS when the JWT user is the configured operator.
 *
 * Authorization matches Postgres `is_pilot_operator()` / client `ensureOperatorUserId` + session id check:
 * resolve `operator_user_id` from `app_public_config` (then env fallback), require `user.id === operatorUserId`.
 *
 * Do **not** re-check EXPO_PUBLIC_APP_ADMIN_EMAILS here: that list is embedded in the mobile/web bundle at
 * build time, while this route reads server env — mismatch caused “Pilot Desk visible but delete 403”.
 */
const { createClient } = require('@supabase/supabase-js');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeOperatorId(raw) {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!v || !UUID_RE.test(v)) return null;
  return v;
}

/** Same shape handling as `parseOperatorUserIdFromAppPublicConfigRow` in lib/operatorConfig.ts */
function operatorIdFromConfigRow(row) {
  if (!row || typeof row !== 'object') return null;
  const raw =
    row.value ??
    row.config_value ??
    row.val ??
    (typeof row.data === 'object' && row.data !== null ? row.data.operator_user_id : undefined);
  if (typeof raw === 'string') return normalizeOperatorId(raw);
  if (raw != null) return normalizeOperatorId(String(raw));
  return null;
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !service) {
    return res.status(503).json({ error: 'Pilot delete API not configured' });
  }

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization' });
  }
  const jwt = auth.slice(7);

  const admin = createClient(supabaseUrl, service, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  const user = userData.user;

  const { data: cfgRow } = await admin
    .from('app_public_config')
    .select('*')
    .eq('key', 'operator_user_id')
    .maybeSingle();

  let operatorUserId = operatorIdFromConfigRow(cfgRow);
  if (!operatorUserId) {
    operatorUserId = normalizeOperatorId(process.env.EXPO_PUBLIC_OPERATOR_USER_ID);
  }
  const sessionUid = String(user.id ?? '')
    .trim()
    .toLowerCase();
  if (!operatorUserId || sessionUid !== operatorUserId) {
    return res.status(403).json({ error: 'Only operator can delete reports.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  }
  const id = String(body?.id ?? '').trim();
  if (!id) return res.status(400).json({ error: 'Missing report id' });

  const { error: delErr } = await admin.from('scam_alerts').delete().eq('id', id);
  if (delErr) {
    return res.status(500).json({ error: delErr.message || 'Delete failed' });
  }
  return res.status(200).json({ ok: true });
};
