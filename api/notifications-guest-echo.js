const { createClient } = require('@supabase/supabase-js');

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

const DEFAULT_OPERATOR_USER_ID = 'e6d8cb02-6f1a-40c0-96c4-b96961878407';

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
    return res.status(503).json({ error: 'Notifications service unavailable' });
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
  const uid = validUuid(userData.user.id);
  if (!uid) {
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
  if (!threadRootId) {
    return res.status(400).json({ error: 'threadRootId is required' });
  }

  const title = String(body?.title ?? '').trim().slice(0, 500);
  const message = String(body?.message ?? '').trim().slice(0, 4000);
  if (!title || !message) {
    return res.status(400).json({ error: 'title and message are required' });
  }

  const routeOperator = body?.routeOperator === true;
  const operatorUserId = routeOperator ? await resolveOperatorUserId(admin) : null;
  const operatorTitle = String(body?.operatorTitle ?? title).trim().slice(0, 500);
  const operatorMessage = String(body?.operatorMessage ?? message).trim().slice(0, 4000);

  let row;

  if (kind === 'ask_me') {
    const bid = validUuid(body?.askTargetBanditId);
    if (!bid) {
      return res.status(400).json({ error: 'askTargetBanditId is required' });
    }
    if (routeOperator) {
      const { error: operatorError } = await admin.from('notifications').insert({
        id: threadRootId,
        user_id: operatorUserId,
        type: 'bandit_question',
        title: operatorTitle,
        message: operatorMessage,
        reference_id: uid,
        reference_type: 'bandit_question_request',
        ask_target_bandit_id: bid,
        is_read: false,
      });
      if (operatorError) {
        return res.status(500).json({ error: operatorError.message || 'Could not route to operator' });
      }
    }
    row = {
      user_id: uid,
      type: 'bandit_question',
      title,
      message,
      reference_id: threadRootId,
      reference_type: 'bandit_question_guest_echo',
      ask_target_bandit_id: bid,
      is_read: false,
    };
  } else if (kind === 'local_friend') {
    if (routeOperator) {
      const { error: operatorError } = await admin.from('notifications').insert({
        id: threadRootId,
        user_id: operatorUserId,
        type: 'local_friend',
        title: operatorTitle,
        message: operatorMessage,
        reference_id: uid,
        reference_type: 'local_friend_request',
        is_read: false,
      });
      if (operatorError) {
        return res.status(500).json({ error: operatorError.message || 'Could not route to operator' });
      }
    }
    row = {
      user_id: uid,
      type: 'local_friend',
      title,
      message,
      reference_id: threadRootId,
      reference_type: 'local_friend_guest_echo',
      is_read: false,
    };
  } else {
    return res.status(400).json({ error: 'Unsupported kind' });
  }

  const { error } = await admin.from('notifications').insert(row);
  if (error) {
    return res.status(500).json({ error: error.message || 'Could not insert notification' });
  }
  return res.status(200).json({ ok: true });
};
