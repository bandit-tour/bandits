const { createClient } = require('@supabase/supabase-js');

const DEFAULT_OPERATOR_USER_ID = 'e6d8cb02-6f1a-40c0-96c4-b96961878407';

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
    return res.status(503).json({ error: 'Pilot live alert is not configured' });
  }

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization' });
  }
  const jwt = auth.slice(7);

  const supabase = createClient(supabaseUrl, service, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  const user = userData.user;
  const operatorUserId = String(process.env.EXPO_PUBLIC_OPERATOR_USER_ID || DEFAULT_OPERATOR_USER_ID).trim();
  if (!operatorUserId || user.id !== operatorUserId) {
    return res.status(403).json({ error: 'Only operator account can send live alerts.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  }
  const title = String(body?.title || '').trim();
  const message = String(body?.message || '').trim();
  if (!title) return res.status(400).json({ error: 'Alert title is required.' });
  if (!message) return res.status(400).json({ error: 'Alert message is required.' });

  const [{ data: notificationRows, error: notificationError }, { data: profileRows, error: profileError }] =
    await Promise.all([
      supabase.from('notifications').select('user_id,reference_id').limit(5000),
      supabase.from('user_profile').select('id').limit(5000),
    ]);

  if (notificationError) {
    return res.status(500).json({ error: notificationError.message || 'Could not load recipients.' });
  }
  if (profileError) {
    return res.status(500).json({ error: profileError.message || 'Could not load traveler profiles.' });
  }

  const recipientIds = Array.from(
    new Set(
      [
        operatorUserId,
        ...(notificationRows || []).map((r) => String(r.user_id || '').trim()),
        ...(notificationRows || []).map((r) => String(r.reference_id || '').trim()),
        ...(profileRows || []).map((r) => String(r.id || '').trim()),
      ].filter((id) => id),
    ),
  );

  if (recipientIds.length === 0) {
    return res
      .status(400)
      .json({ error: 'No active travelers available right now. Recipients appear after first guest interaction.' });
  }

  const payload = recipientIds.map((uid) => ({
    user_id: uid,
    type: 'live_alert',
    title,
    message,
    reference_id: operatorUserId,
    reference_type: 'pilot_live_alert',
  }));

  const { error: insertError } = await supabase.from('notifications').insert(payload);
  if (insertError) {
    return res.status(500).json({ error: insertError.message || 'Could not send live alert.' });
  }

  return res.status(200).json({ recipientCount: recipientIds.length });
};
