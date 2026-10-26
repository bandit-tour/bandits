/**
 * Guest follow-up in an existing Chat thread (QR welcome / signal / Local Friend).
 * Persists traveler-visible reply + routes to operator Local Friend inbox.
 */
const { createClient } = require('@supabase/supabase-js');
const { dispatchPushForNotificationInsert } = require('../server/push/expoPushDispatch');

const DEFAULT_OPERATOR_USER_ID = 'e6d8cb02-6f1a-40c0-96c4-b96961878407';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function validUuid(value) {
  const t = String(value ?? '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t)
    ? t
    : null;
}

function newUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${s4()}${s4()}-${s4()}-4${s4().slice(0, 3)}-${(
    (8 + Math.floor(Math.random() * 4)).toString(16) + s4().slice(0, 3)
  )}-${s4()}${s4()}${s4()}`;
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

  const threadRootId = validUuid(body?.threadRootId);
  const message = String(body?.message ?? '').trim().slice(0, 4000);
  const travelerTitle = String(body?.title ?? 'Traveler').trim().slice(0, 500) || 'Traveler';
  if (!threadRootId || !message) {
    return res.status(400).json({ error: 'threadRootId and message are required' });
  }

  const operatorUserId = await resolveOperatorUserId(admin);

  const guestReplyId = newUuid();
  const guestRow = {
    id: guestReplyId,
    user_id: travelerId,
    type: 'local_friend',
    title: travelerTitle,
    message,
    reference_id: threadRootId,
    reference_type: 'hotel_qr_guest_reply',
    is_read: true,
  };

  const { error: guestError } = await admin.from('notifications').insert(guestRow);
  if (guestError) {
    return res.status(500).json({ error: guestError.message || 'Could not save reply' });
  }

  const { data: existingOp } = await admin
    .from('notifications')
    .select('id')
    .eq('id', threadRootId)
    .eq('user_id', operatorUserId)
    .maybeSingle();

  let operatorRow;
  if (existingOp?.id) {
    operatorRow = {
      id: newUuid(),
      user_id: operatorUserId,
      type: 'local_friend',
      title: travelerTitle,
      message,
      reference_id: travelerId,
      reference_type: 'local_friend_request',
      is_read: false,
    };
  } else {
    operatorRow = {
      id: threadRootId,
      user_id: operatorUserId,
      type: 'local_friend',
      title: travelerTitle,
      message,
      reference_id: travelerId,
      reference_type: 'local_friend_request',
      is_read: false,
    };
  }

  const { error: operatorError } = await admin.from('notifications').insert(operatorRow);
  if (operatorError) {
    console.warn('[guest-chat-reply] operator route:', operatorError.message || operatorError);
  } else {
    void dispatchPushForNotificationInsert(admin, operatorUserId, operatorRow).catch((e) =>
      console.warn('[guest-chat-reply] operator push:', e?.message || e),
    );
  }

  return res.status(200).json({ ok: true, replyId: guestReplyId, threadRootId });
};
