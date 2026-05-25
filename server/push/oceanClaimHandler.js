const { createClient } = require('@supabase/supabase-js');
const { dispatchPushForNotificationInsert } = require('./expoPushDispatch');

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

const SIGNAL_BANK_LINES = [
  'Trust the street with no sign.',
  'Some nights begin after midnight.',
  'Follow music, not maps.',
  'Cities reward curiosity.',
  'Arrive hungry for the wrong turn.',
  'Listen for laughter behind closed doors.',
  'Walk until the crowd thins.',
  'Borrow courage from strangers.',
  'Rain makes the city honest.',
  'Your feet already decided.',
];

function stableStringHash(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pickIndexFromSeed(seed, n) {
  if (n <= 0) return 0;
  return stableStringHash(seed) % n;
}

function banditDisplayName(row) {
  const first = String(row.name || '').trim();
  const last = String(row.family_name || '').trim();
  return [first, last].filter(Boolean).join(' ') || 'A local banDit';
}

function firstWhyFollowLine(whyFollow) {
  const wf = String(whyFollow || '').trim();
  if (!wf) return '';
  const line = wf
    .split('\n')
    .map((l) => l.trim().replace(/^•\s*/, ''))
    .find(Boolean);
  return line || '';
}

function momentBodyFromBandit(row) {
  const desc = String(row.description || '').trim();
  if (desc.length >= 12) return desc;
  const why = firstWhyFollowLine(row.why_follow);
  if (why.length >= 12) return why;
  const city = String(row.city || 'Athens').trim() || 'Athens';
  const name = String(row.name || 'A local banDit').trim();
  return `${name} is out in ${city} — follow the city rhythm they trust.`;
}

async function pickBanditMomentForBottle(admin, receiverId) {
  const seed = `${receiverId}:${new Date().toISOString().slice(0, 10)}`;
  const { data, error } = await admin
    .from('bandit')
    .select('id, name, family_name, city, description, why_follow')
    .order('created_at', { ascending: true });
  if (!error && data?.length) {
    const pool = data
      .map((row) => ({
        banditId: String(row.id),
        banditName: banditDisplayName(row),
        body: momentBodyFromBandit(row),
      }))
      .filter((m) => m.body.trim().length >= 8);
    if (pool.length) {
      const pick = pool[pickIndexFromSeed(seed, pool.length)] ?? pool[0];
      return pick;
    }
  }
  const idx = pickIndexFromSeed(`signal-bank:${seed}`, SIGNAL_BANK_LINES.length);
  return {
    banditId: '',
    banditName: 'Athens',
    body: SIGNAL_BANK_LINES[idx] ?? SIGNAL_BANK_LINES[0],
  };
}

module.exports = async function oceanClaimHandler(req, res) {
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
    const moment = await pickBanditMomentForBottle(admin, receiverId);
    return res.status(200).json({
      ok: true,
      source: 'bandit_moment',
      message: moment.body,
      bandit_id: moment.banditId || null,
      bandit_name: moment.banditName,
    });
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

  void dispatchPushForNotificationInsert(admin, receiverId, {
    type: 'local_friend_bottle',
    title: 'Message in a bottle',
    message: vRow.message_body,
    reference_id: floatId,
    reference_type: 'local_friend_ocean_claim',
    is_read: false,
  }).catch((e) => console.warn('[ocean-claim] guest push:', e?.message || e));

  void dispatchPushForNotificationInsert(admin, vRow.sender_user_id, {
    type: 'local_friend_bottle',
    title: 'Someone found your bottle',
    message: String(vRow.message_body || '').slice(0, 500),
    reference_id: floatId,
    reference_type: 'local_friend_ocean_found',
    is_read: false,
  }).catch((e) => console.warn('[ocean-claim] sender push:', e?.message || e));

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
    source: 'local_friend',
    float_id: floatId,
    message: vRow.message_body,
    notification_id: notifId,
    sender_notification_id: senderNotifId,
  });
};
