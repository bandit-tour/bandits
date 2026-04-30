const { createClient } = require('@supabase/supabase-js');

const MAX_BYTES = 4 * 1024 * 1024; // 4MB decoded

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !service) {
    return res.status(503).json({ error: 'Avatar upload is not configured' });
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
  const { user } = userData;

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Expected JSON body' });
  }

  const { ext, image: b64 } = body;
  if (ext !== 'png' && ext !== 'jpg') {
    return res.status(400).json({ error: 'ext must be png or jpg' });
  }
  if (typeof b64 !== 'string' || b64.length === 0) {
    return res.status(400).json({ error: 'Missing image (base64)' });
  }

  let buffer;
  try {
    buffer = Buffer.from(b64, 'base64');
  } catch {
    return res.status(400).json({ error: 'Invalid base64' });
  }

  if (buffer.length < 8) {
    return res.status(400).json({ error: 'Image too small' });
  }
  if (buffer.length > MAX_BYTES) {
    return res.status(413).json({ error: 'Image too large' });
  }

  const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
  const objectPath = `${user.id}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('profile_avatars')
    .upload(objectPath, buffer, { contentType, upsert: true });

  if (uploadError) {
    // eslint-disable-next-line no-console
    console.error('[avatar-upload]', uploadError);
    return res.status(500).json({ error: uploadError.message || 'Upload failed' });
  }

  const { data: publicData } = supabase.storage.from('profile_avatars').getPublicUrl(objectPath);
  const publicUrl = (publicData?.publicUrl && publicData.publicUrl.trim()) || '';
  if (!publicUrl) {
    return res.status(500).json({ error: 'Could not resolve public URL' });
  }

  return res.status(200).json({ publicUrl, bucket: 'profile_avatars' });
};
