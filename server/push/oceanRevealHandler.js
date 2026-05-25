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

module.exports = async function oceanRevealHandler(req, res) {
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

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  }

  const floatId = validUuid(body?.floatId || body?.float_id);
  if (!floatId) {
    return res.status(400).json({ error: 'floatId is required' });
  }

  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  const receiverId = validUuid(userData.user.id);
  if (!receiverId) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  const { data: vRow, error: floatErr } = await admin
    .from('local_friend_ocean_float')
    .select('id, sender_user_id, claimed_by_user_id, sender_persona_name, claim_notification_id, reveal_status')
    .eq('id', floatId)
    .maybeSingle();

  if (floatErr || !vRow) {
    return res.status(404).json({ error: 'float not found' });
  }
  if (String(vRow.claimed_by_user_id || '') !== receiverId) {
    return res.status(403).json({ error: 'only receiver may reveal sender' });
  }

  const persona = String(vRow.sender_persona_name || 'Traveler').trim() || 'Traveler';

  const { error: updateErr } = await admin
    .from('local_friend_ocean_float')
    .update({ reveal_status: 'revealed', revealed_at: new Date().toISOString() })
    .eq('id', floatId);

  if (updateErr) {
    return res.status(500).json({ error: updateErr.message || 'Could not reveal sender' });
  }

  if (vRow.claim_notification_id) {
    await admin
      .from('notifications')
      .update({ title: persona.slice(0, 500) })
      .eq('id', vRow.claim_notification_id)
      .eq('user_id', receiverId);
  }

  return res.status(200).json({
    ok: true,
    float_id: floatId,
    sender_user_id: vRow.sender_user_id,
    sender_persona_name: persona,
  });
};
