const { createClient } = require('@supabase/supabase-js');

function toUuidOrNull(value) {
  const v = String(value ?? '').trim();
  if (!v) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v) ? v : null;
}

const SCAM_ALERT_INSERT_UUID_KEYS = new Set([
  'id',
  'reported_by',
  'reporter_id',
  'created_by',
  'user_id',
]);

function isValidUuidString(s) {
  const t = String(s || '').trim();
  return (
    t !== '' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t)
  );
}

/** Omit "", invalid UUID columns entirely (no cast / no null fill). */
function stripScamAlertInsertPayload(row) {
  const payload = { ...(row || {}) };

  for (const key of Object.keys(payload)) {
    if (payload[key] === undefined) {
      delete payload[key];
    }
  }

  for (const key of Object.keys(payload)) {
    const value = payload[key];
    if (value === '') {
      delete payload[key];
      continue;
    }
    if (typeof value === 'string') {
      const t = value.trim();
      if (t === '') {
        delete payload[key];
        continue;
      }
      if (SCAM_ALERT_INSERT_UUID_KEYS.has(key)) {
        if (!isValidUuidString(t)) {
          delete payload[key];
        } else {
          payload[key] = t;
        }
      } else {
        payload[key] = t;
      }
      continue;
    }
    if (SCAM_ALERT_INSERT_UUID_KEYS.has(key)) {
      delete payload[key];
    }
  }

  for (const key of Object.keys(payload)) {
    if (payload[key] === '') {
      delete payload[key];
    }
  }

  return payload;
}

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
    return res.status(503).json({ error: 'Service temporarily unavailable' });
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
  const reportedBy = toUuidOrNull(user?.id);
  if (!reportedBy) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  }
  const city = String(body?.city || '').trim();
  const location = String(body?.location || '').trim();
  const title = String(body?.title || '').trim();
  const description = String(body?.description || '').trim();
  const category = String(body?.category || 'Other').trim() || 'Other';
  const severity = Math.min(3, Math.max(1, Math.round(Number(body?.severity ?? 2) || 2)));
  if (!city || !location || !title || !description) {
    return res.status(400).json({ error: 'city, location, title, and description are required' });
  }

  let imageUrl = null;
  if (body?.imageBase64 && typeof body.imageBase64 === 'string' && body.imageBase64.length > 40) {
    try {
      const b64 = body.imageBase64.includes(',') ? body.imageBase64.split(',').pop() : body.imageBase64;
      const buffer = Buffer.from(b64, 'base64');
      if (buffer.length > 0 && buffer.length < 5 * 1024 * 1024) {
        const path = `scam_reports/${user.id}/${Date.now()}.jpg`;
        const { data: up, error: upErr } = await admin.storage
          .from('profile_avatars')
          .upload(path, buffer, { contentType: 'image/jpeg', upsert: false });
        if (!upErr && up?.path) {
          const { data: pub } = admin.storage.from('profile_avatars').getPublicUrl(up.path);
          imageUrl = pub?.publicUrl || null;
        }
      }
    } catch {
      /* optional image */
    }
  } else if (body?.imageUrl && typeof body.imageUrl === 'string' && body.imageUrl.startsWith('http')) {
    imageUrl = body.imageUrl.trim();
  }

  const rowFull = stripScamAlertInsertPayload({
    city,
    location,
    title,
    description,
    reported_by: reportedBy,
    category,
    severity,
    ...(imageUrl ? { image_url: imageUrl } : {}),
    moderation_status: 'published',
    admin_verified: false,
  });
  const rowToInsert = stripScamAlertInsertPayload({
    ...rowFull,
    ...(imageUrl && String(imageUrl).trim() ? { image_url: String(imageUrl).trim() } : {}),
  });
  console.log('FINAL PAYLOAD', JSON.stringify(rowToInsert, null, 2));
  const { data: insData, error: insErr } = await admin.from('scam_alerts').insert(rowToInsert).select('id').maybeSingle();
  let newId = insData?.id || null;
  if (insErr) {
    const errMsg = (insErr.message || '').toLowerCase();
    const isMissing = errMsg.includes('column') && (errMsg.includes('category') || errMsg.includes('moderation'));
    if (isMissing) {
      const legacy = stripScamAlertInsertPayload({
        city: rowFull.city,
        location: rowFull.location,
        title: rowFull.title,
        description: rowFull.description,
        reported_by: reportedBy,
        ...(imageUrl ? { image_url: imageUrl } : {}),
      });
      const legacyInsert = stripScamAlertInsertPayload({ ...legacy });
      console.log('FINAL PAYLOAD', JSON.stringify(legacyInsert, null, 2));
      const second = await admin.from('scam_alerts').insert(legacyInsert).select('id').maybeSingle();
      if (second.error) {
        return res.status(500).json({ error: 'Could not save report.' });
      }
      newId = second.data?.id || null;
    } else {
      return res.status(500).json({ error: 'Could not save report.' });
    }
  }
  if (!newId) {
    newId = (await fetchLatestReportId(admin, user.id, title)) || null;
  }

  /** Operator notification: handled by `tr_scam_alerts_notify_operator` (DB trigger) so all insert paths are covered. */

  return res.status(200).json({ ok: true, id: newId });
};

async function fetchLatestReportId(admin, userId, title) {
  const { data } = await admin
    .from('scam_alerts')
    .select('id')
    .eq('reported_by', userId)
    .eq('title', title)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id || null;
}
