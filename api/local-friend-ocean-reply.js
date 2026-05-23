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

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  }

  const floatId = validUuid(body?.floatId || body?.float_id);
  const message = String(body?.message ?? '').trim().slice(0, 4000);
  if (!floatId || !message) {
    return res.status(400).json({ error: 'floatId and message are required' });
  }

  const admin = createClient(supabaseUrl, service, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  const authorId = validUuid(userData.user.id);
  if (!authorId) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  const { data: floatRow, error: floatErr } = await admin
    .from('local_friend_ocean_float')
    .select('id, sender_user_id, claimed_by_user_id, status, sender_persona_name')
    .eq('id', floatId)
    .maybeSingle();

  if (floatErr || !floatRow) {
    return res.status(404).json({ error: 'Bottle thread not found' });
  }
  if (floatRow.status !== 'claimed') {
    return res.status(400).json({ error: 'Thread is not active' });
  }

  const senderId = validUuid(floatRow.sender_user_id);
  const receiverId = validUuid(floatRow.claimed_by_user_id);
  if (!senderId || !receiverId) {
    return res.status(400).json({ error: 'Invalid thread participants' });
  }
  if (authorId !== senderId && authorId !== receiverId) {
    return res.status(403).json({ error: 'Not a participant' });
  }

  const recipientId = authorId === senderId ? receiverId : senderId;
  const authorLabel =
    authorId === senderId
      ? String(floatRow.sender_persona_name || 'Traveler').trim() || 'Traveler'
      : 'Traveler';

  const { error: msgErr } = await admin.from('local_friend_ocean_message').insert({
    ocean_float_id: floatId,
    author_user_id: authorId,
    body: message,
  });
  if (msgErr) {
    return res.status(500).json({ error: msgErr.message || 'Could not save message' });
  }

  const { error: notifErr } = await admin.from('notifications').insert({
    user_id: recipientId,
    type: 'local_friend_bottle',
    title: authorLabel,
    message,
    reference_id: floatId,
    reference_type: 'local_friend_ocean_peer',
    is_read: false,
  });
  if (notifErr) {
    return res.status(500).json({ error: notifErr.message || 'Could not notify recipient' });
  }

  return res.status(200).json({ ok: true });
};
