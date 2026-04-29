const { createClient } = require('@supabase/supabase-js');

const BANDIT_QUESTION_GUEST_ECHO_REF = 'bandit_question_guest_echo';

const DEFAULT_OPERATOR_USER_ID = 'e6d8cb02-6f1a-40c0-96c4-b96961878407';

function isAskTargetBanditIdMissingColumnError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('ask_target_bandit_id') && (msg.includes('schema cache') || msg.includes('column'));
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function getOperatorUserId() {
  return String(process.env.EXPO_PUBLIC_OPERATOR_USER_ID || DEFAULT_OPERATOR_USER_ID).trim();
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !service) {
    return res.status(503).json({ error: 'Ask Me routing is not configured' });
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

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  }
  const banditId = String(body?.banditId || '').trim();
  const question = String(body?.question || '').trim();
  if (!banditId) return res.status(400).json({ error: 'banditId is required' });
  if (!question) return res.status(400).json({ error: 'question is required' });

  const operatorUserId = getOperatorUserId();
  if (!operatorUserId) {
    return res.status(503).json({ error: 'Operator routing is not configured' });
  }

  const { data: banditRow } = await admin.from('bandit').select('id, name').eq('id', banditId).maybeSingle();
  const banditName = String(banditRow?.name || 'banDit').trim() || 'banDit';

  const { data: prof } = await admin
    .from('user_profile')
    .select('name')
    .eq('id', user.id)
    .maybeSingle();
  const meta = (user.user_metadata && typeof user.user_metadata === 'object' ? user.user_metadata : {}) || {};
  const metaName =
    (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
    (typeof meta.name === 'string' && meta.name.trim()) ||
    '';
  const fromProfile = String((prof && prof.name) || '').trim();
  const travelerName = (fromProfile || metaName).trim() || 'Traveler';

  const aboutMessage = `About: ${banditName}\n\n${question}`;

  const withAskTarget = {
    user_id: operatorUserId,
    type: 'bandit_question',
    title: travelerName,
    message: aboutMessage,
    reference_id: user.id,
    reference_type: 'bandit_question_request',
    ask_target_bandit_id: banditId,
  };
  const withoutAskTarget = {
    user_id: operatorUserId,
    type: 'bandit_question',
    title: travelerName,
    message: aboutMessage,
    reference_id: user.id,
    reference_type: 'bandit_question_request',
  };

  let { data: opRow, error: insErr } = await admin
    .from('notifications')
    .insert(withAskTarget)
    .select('id')
    .maybeSingle();
  if (insErr && isAskTargetBanditIdMissingColumnError(insErr)) {
    const retry = await admin.from('notifications').insert(withoutAskTarget).select('id').maybeSingle();
    opRow = retry.data;
    insErr = retry.error;
  }

  if (insErr) {
    return res.status(500).json({ error: insErr.message || 'Could not route Ask Me message.' });
  }

  const rootId = opRow?.id ? String(opRow.id) : '';
  if (rootId) {
    await admin.from('notifications').insert({
      user_id: user.id,
      type: 'bandit_question',
      title: banditName,
      message: question,
      reference_id: rootId,
      reference_type: BANDIT_QUESTION_GUEST_ECHO_REF,
    });
  }

  return res.status(200).json({ ok: true });
};
