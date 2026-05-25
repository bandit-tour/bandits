const { createClient } = require('@supabase/supabase-js');
const { saveExpoPushToken, removeExpoPushToken } = require('../server/push/pushTokenStore');
const { dispatchExpoPushToUser } = require('../server/push/expoPushDispatch');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function validUuid(value) {
  const t = String(value ?? '').trim();
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t) ? t : null
  );
}

function adminClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !service) return null;
  return createClient(supabaseUrl, service, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body && typeof body === 'object' ? body : {};
}

function resolveAction(req) {
  const q = String(req.query?.action || '').trim().toLowerCase();
  if (q) return q;
  const body = parseBody(req);
  return String(body.action || 'register').trim().toLowerCase();
}

async function handleRegister(req, res, admin) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization' });
  }
  const jwt = auth.slice(7);
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  const userId = validUuid(userData.user.id);
  if (!userId) return res.status(401).json({ error: 'Invalid session' });

  if (req.method === 'DELETE') {
    const body = parseBody(req);
    const token = String(body.expoPushToken ?? body.token ?? '').trim();
    if (!token) return res.status(400).json({ error: 'expoPushToken required' });
    const result = await removeExpoPushToken(admin, userId, token);
    if (!result.ok) return res.status(500).json({ error: result.error || 'Could not remove token' });
    return res.status(200).json({ ok: true, storage: result.storage });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = parseBody(req);
  const expoPushToken = String(body.expoPushToken ?? body.token ?? '').trim();
  if (!expoPushToken.startsWith('ExponentPushToken[') && !expoPushToken.startsWith('ExpoPushToken[')) {
    return res.status(400).json({ error: 'Invalid Expo push token' });
  }
  const platform = String(body.platform ?? '').trim().slice(0, 32) || null;
  const deviceId = String(body.deviceId ?? body.device_id ?? '').trim().slice(0, 128) || null;
  const result = await saveExpoPushToken(admin, userId, expoPushToken, { platform, deviceId });
  if (!result.ok) {
    return res.status(500).json({ error: result.error || 'Could not save push token' });
  }
  return res.status(200).json({ ok: true, storage: result.storage });
}

async function handleNotify(req, res, admin) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization' });
  }
  const jwt = auth.slice(7);
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  const body = parseBody(req);
  const recipientId = validUuid(body.recipientUserId ?? body.userId);
  const referenceId = String(body.referenceId ?? body.reference_id ?? '').trim();
  const referenceType = String(body.referenceType ?? body.reference_type ?? '').trim();
  if (!recipientId || !referenceId) {
    return res.status(400).json({ error: 'recipientUserId and referenceId are required' });
  }

  const since = new Date(Date.now() - 120_000).toISOString();
  let q = admin
    .from('notifications')
    .select('id, type, title, message, reference_id, reference_type, is_read, created_at')
    .eq('user_id', recipientId)
    .eq('reference_id', referenceId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1);
  if (referenceType) q = q.eq('reference_type', referenceType);
  const { data: rows, error: rowErr } = await q;
  if (rowErr) return res.status(500).json({ error: rowErr.message || 'Lookup failed' });
  const row = rows?.[0];
  if (!row || row.is_read) {
    return res.status(404).json({ error: 'No recent unread notification for recipient' });
  }

  const title = String(body.title ?? row.title ?? 'bandiTour').trim().slice(0, 120);
  const pushBody = String(body.body ?? row.message ?? '').trim().slice(0, 240);
  const surface = String(body.surface ?? 'chat').trim() === 'inbox' ? 'inbox' : 'chat';
  const kind = String(body.kind ?? 'chat_message').trim();

  const result = await dispatchExpoPushToUser(admin, {
    userId: recipientId,
    title,
    body: pushBody || 'New message',
    channelId: surface === 'inbox' ? 'bottle' : 'messages',
    data: {
      surface,
      kind,
      referenceType: String(row.reference_type || referenceType),
      referenceId,
      floatId: referenceType === 'local_friend_ocean_thread' ? referenceId : '',
      notificationTitle: String(row.title || ''),
    },
  });

  return res.status(200).json({ ok: true, ...result });
}

/** Single serverless route: ?action=register|notify */
module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const admin = adminClient();
  if (!admin) return res.status(503).json({ error: 'Push service unavailable' });

  const action = resolveAction(req);
  if (action === 'notify' || action === 'notify-event') {
    return handleNotify(req, res, admin);
  }
  return handleRegister(req, res, admin);
};
