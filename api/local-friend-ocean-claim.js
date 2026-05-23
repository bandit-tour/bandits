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

function adminClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !service) return null;
  return createClient(supabaseUrl, service, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const admin = adminClient();
  if (!admin) {
    return res.status(503).json({ error: 'Messaging service unavailable' });
  }

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization' });
  }
  const jwt = auth.slice(7);

  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  const receiverId = validUuid(userData.user.id);
  if (!receiverId) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  const { data: floats, error: floatErr } = await admin
    .from('local_friend_ocean_float')
    .select('id, message_body, sender_user_id, status')
    .eq('status', 'floating')
    .neq('sender_user_id', receiverId)
    .order('created_at', { ascending: true })
    .limit(1);

  if (floatErr) {
    return res.status(500).json({ error: floatErr.message || 'Could not claim message' });
  }

  const vRow = floats?.[0];
  if (!vRow?.id) {
    return res.status(200).json({ ok: false, reason: 'no_floating_message' });
  }

  const notifId = crypto.randomUUID();
  const senderNotifId = crypto.randomUUID();
  const floatId = String(vRow.id);

  const { error: receiverNotifErr } = await admin.from('notifications').insert({
    id: notifId,
    user_id: receiverId,
    type: 'local_friend_bottle',
    title: 'Message in a bottle',
    message: vRow.message_body,
    reference_id: floatId,
    reference_type: 'local_friend_ocean_claim',
    is_read: false,
  });
  if (receiverNotifErr) {
    return res.status(500).json({ error: receiverNotifErr.message || 'Could not create inbox row' });
  }

  const { error: senderNotifErr } = await admin.from('notifications').insert({
    id: senderNotifId,
    user_id: vRow.sender_user_id,
    type: 'local_friend_bottle',
    title: 'Someone found your bottle',
    message: String(vRow.message_body || '').slice(0, 500),
    reference_id: floatId,
    reference_type: 'local_friend_ocean_found',
    is_read: false,
  });
  if (senderNotifErr) {
    await admin.from('notifications').delete().eq('id', notifId);
    return res.status(500).json({ error: senderNotifErr.message || 'Could not notify sender' });
  }

  const { error: updateErr } = await admin
    .from('local_friend_ocean_float')
    .update({
      status: 'claimed',
      claimed_by_user_id: receiverId,
      claimed_at: new Date().toISOString(),
      claim_notification_id: notifId,
    })
    .eq('id', floatId)
    .eq('status', 'floating');

  if (updateErr) {
    await admin.from('notifications').delete().eq('id', notifId);
    await admin.from('notifications').delete().eq('id', senderNotifId);
    return res.status(500).json({ error: updateErr.message || 'Could not claim message' });
  }

  return res.status(200).json({
    ok: true,
    float_id: floatId,
    message: vRow.message_body,
    notification_id: notifId,
    sender_notification_id: senderNotifId,
  });
};
