/**
 * Refresh a stored Google place id into current photo media URLs.
 * The browser cannot call Places Details reliably. This route uses the maps key
 * already stored on guide photos, or EXPO_PUBLIC_GOOGLE_MAPS_KEY when set.
 * It returns photo URLs only.
 */
const { createClient } = require('@supabase/supabase-js');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function mediaUrl(apiKey, resourceName) {
  const path = String(resourceName || '')
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  if (!path || !apiKey) return null;
  return `https://places.googleapis.com/v1/${path}/media?maxWidthPx=1600&maxHeightPx=1200&key=${encodeURIComponent(apiKey)}`;
}

function keyFromStoredUrl(value) {
  const raw = String(value || '');
  if (!raw.includes('places.googleapis.com') || !raw.includes('key=')) return '';
  try {
    const key = new URL(raw).searchParams.get('key') || '';
    if (/^AIza[0-9A-Za-z_-]{20,}$/.test(key)) return key;
  } catch {
    const match = raw.match(/[?&]key=(AIza[0-9A-Za-z_-]{20,})/);
    if (match) return match[1];
  }
  return '';
}

let cachedKey = '';

async function storedPlacesKey(placeId) {
  if (cachedKey) return cachedKey;
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !service) return '';
  const admin = createClient(supabaseUrl, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: own } = await admin
    .from('event')
    .select('image_url')
    .eq('google_place_id', placeId)
    .limit(6);
  for (const row of own || []) {
    const key = keyFromStoredUrl(row.image_url);
    if (key) {
      cachedKey = key;
      return key;
    }
  }
  const { data: any } = await admin
    .from('event')
    .select('image_url')
    .ilike('image_url', '%places.googleapis.com%key=%')
    .limit(4);
  for (const row of any || []) {
    const key = keyFromStoredUrl(row.image_url);
    if (key) {
      cachedKey = key;
      return key;
    }
  }
  return '';
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ urls: [] });

  const placeId = String(req.query.placeId || '')
    .trim()
    .replace(/^places\//i, '');
  if (!/^[A-Za-z0-9_-]{8,}$/.test(placeId)) return res.status(400).json({ urls: [] });

  const apiKey =
    String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || process.env.GOOGLE_MAPS_API_KEY || '').trim() ||
    (await storedPlacesKey(placeId));
  if (!apiKey) return res.status(200).json({ urls: [] });

  const limit = Math.max(1, Math.min(4, Number(req.query.limit) || 4));
  try {
    const resp = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'photos',
      },
    });
    if (!resp.ok) return res.status(200).json({ urls: [] });
    const json = await resp.json();
    const urls = [];
    for (const photo of Array.isArray(json?.photos) ? json.photos : []) {
      if (urls.length >= limit) break;
      const url = mediaUrl(apiKey, photo?.name);
      if (url && !urls.includes(url)) urls.push(url);
    }
    return res.status(200).json({ urls });
  } catch {
    return res.status(200).json({ urls: [] });
  }
};
