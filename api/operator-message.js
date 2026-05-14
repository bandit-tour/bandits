const { createClient } = require('@supabase/supabase-js');

const DEFAULT_OPERATOR_USER_ID = 'e6d8cb02-6f1a-40c0-96c4-b96961878407';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function validUuid(value) {
  const t = String(value ?? '').trim();
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t) ? t : null
  );
}

async function resolveOperatorUserId(admin) {
  const { data } = await admin
    .from('app_public_config')
    .select('value')
    .eq('key', 'operator_user_id')
    .maybeSingle();
  return validUuid(data?.value) || DEFAULT_OPERATOR_USER_ID;
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !service) {
    return res.status(503).json({ error: 'Messaging service unavailable' });
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
  const travelerId = validUuid(userData.user.id);
  if (!travelerId) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  }

  const kind = String(body?.kind || '').trim();
  const threadRootId = validUuid(body?.threadRootId);
  const title = String(body?.title ?? '').trim().slice(0, 500);
  const message = String(body?.message ?? '').trim().slice(0, 4000);
  if (!threadRootId || !title || !message) {
    return res.status(400).json({ error: 'threadRootId, title, and message are required' });
  }

  const operatorUserId = await resolveOperatorUserId(admin);
  let operatorRow;
  let guestRow;

  if (kind === 'ask_me') {
    const askTargetBanditId = validUuid(body?.askTargetBanditId);
    if (!askTargetBanditId) {
      return res.status(400).json({ error: 'askTargetBanditId is required' });
    }
    const askMessage = String(body?.operatorMessage ?? message).trim().slice(0, 4000);
    operatorRow = {
      id: threadRootId,
      user_id: operatorUserId,
      type: 'bandit_question',
      title,
      message: askMessage,
      reference_id: travelerId,
      reference_type: 'bandit_question_request',
      ask_target_bandit_id: askTargetBanditId,
      is_read: false,
    };
    guestRow = {
      user_id: travelerId,
      type: 'bandit_question',
      title: String(body?.guestTitle ?? title).trim().slice(0, 500),
      message,
      reference_id: threadRootId,
      reference_type: 'bandit_question_guest_echo',
      ask_target_bandit_id: askTargetBanditId,
      is_read: false,
    };
  } else if (kind === 'local_friend') {
    operatorRow = {
      id: threadRootId,
      user_id: operatorUserId,
      type: 'local_friend',
      title,
      message,
      reference_id: travelerId,
      reference_type: 'local_friend_request',
      is_read: false,
    };
    guestRow = {
      user_id: travelerId,
      type: 'local_friend',
      title: String(body?.guestTitle ?? 'Local Friend request sent').trim().slice(0, 500),
      message,
      reference_id: threadRootId,
      reference_type: 'local_friend_guest_echo',
      is_read: false,
    };
  } else {
    return res.status(400).json({ error: 'Unsupported kind' });
  }

  const { error: operatorError } = await admin.from('notifications').insert(operatorRow);
  if (operatorError) {
    return res.status(500).json({ error: operatorError.message || 'Could not route message to operator' });
  }

  const { error: guestError } = await admin.from('notifications').insert(guestRow);
  if (guestError) {
    return res.status(500).json({ error: guestError.message || 'Could not create traveler notification' });
  }

  return res.status(200).json({ ok: true, threadRootId });
};
