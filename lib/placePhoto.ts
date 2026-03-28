import Constants from 'expo-constants';

/** Deterministic real photo when DB + Places are unavailable (never a gray box). */
export function picsumPlaceImage(seed: string, w = 800, h = 600): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
}

export function isLikelyLogoOrBadPlaceImage(uri: string | null | undefined): boolean {
  const t = String(uri ?? '').trim().toLowerCase();
  if (!t) return true;
  // Block known app/brand assets and obvious non-place images.
  if (
    t.includes('logobanditourapp') ||
    t.includes('banditour-logo') ||
    t.includes('banditourmainlogo') ||
    t.includes('play-theatrou') ||
    t.includes('play-psyri') ||
    t.includes('/logo') ||
    t.includes('icon.png') ||
    t.includes('favicon') ||
    t.includes('adaptive-icon') ||
    t.includes('splash-icon')
  ) {
    return true;
  }
  return false;
}

export function getCategoryFallbackImage(
  genre: string | null | undefined,
  seed: string,
  w = 800,
  h = 600,
): string {
  const key = String(genre ?? '').trim().toLowerCase();

  const FOOD_IMAGES = [
    `https://images.pexels.com/photos/262978/pexels-photo-262978.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/67468/pexels-photo-67468.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/70497/pexels-photo-70497.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/460537/pexels-photo-460537.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
  ];
  const NIGHTLIFE_IMAGES = [
    `https://images.pexels.com/photos/274192/pexels-photo-274192.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/167636/pexels-photo-167636.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/941864/pexels-photo-941864.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/696218/pexels-photo-696218.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/1540406/pexels-photo-1540406.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
  ];
  const SHOPPING_IMAGES = [
    `https://images.pexels.com/photos/264547/pexels-photo-264547.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/1884584/pexels-photo-1884584.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/994523/pexels-photo-994523.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/2954405/pexels-photo-2954405.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/5632402/pexels-photo-5632402.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/972995/pexels-photo-972995.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
  ];
  const CULTURE_IMAGES = [
    `https://images.pexels.com/photos/2363/france-landmark-lights-night.jpg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/161154/stained-glass-museum-art-glass-161154.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/256369/pexels-photo-256369.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/2251247/pexels-photo-2251247.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/2089698/pexels-photo-2089698.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/69903/pexels-photo-69903.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
  ];
  const COFFEE_IMAGES = [
    `https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/2074130/pexels-photo-2074130.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/312418/pexels-photo-312418.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/1233528/pexels-photo-1233528.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/585753/pexels-photo-585753.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/374885/pexels-photo-374885.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
  ];

  const all = key.includes('food')
    ? FOOD_IMAGES
    : key.includes('shopping')
      ? SHOPPING_IMAGES
      : key.includes('nightlife')
        ? NIGHTLIFE_IMAGES
        : key.includes('culture')
          ? CULTURE_IMAGES
          : key.includes('coffee')
            ? COFFEE_IMAGES
            : null;

  const idx = Math.abs(
    `${seed}-${key}`.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0),
  ) % (all?.length || 1);
  if (all && all.length > 0) return all[idx];
  return picsumPlaceImage(seed, w, h);
}

/**
 * Ensures storage paths work on web (and native) when the DB stores a path
 * without the project host, e.g. `/storage/v1/object/public/...`.
 */
export function normalizeEventImageUri(uri: string | null | undefined): string | null {
  if (uri == null) return null;
  const t = String(uri).trim();
  if (!t) return null;
  if (/^(https?:|data:|blob:)/i.test(t)) return t;
  const base = String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  if (!base) return t;
  if (t.startsWith('/')) return `${base}${t}`;
  return `${base}/${t.replace(/^\//, '')}`;
}

export function getMapsApiKey(): string {
  return (
    String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '').trim() ||
    (Constants.expoConfig as any)?.android?.config?.googleMaps?.apiKey ||
    (Constants.expoConfig as any)?.ios?.config?.googleMapsApiKey ||
    ''
  );
}

export async function fetchGooglePlacePhotoUrl(args: {
  placeId?: string | null;
  name: string;
  address: string;
  city: string;
  neighborhood: string;
}): Promise<string | null> {
  const apiKey = getMapsApiKey();
  if (!apiKey) return null;
  const query = [args.name, args.address, args.city, args.neighborhood].filter(Boolean).join(' ').trim();
  const normalizedPlaceId = String(args.placeId ?? '').trim();
  let placeId = normalizedPlaceId || '';
  if (!placeId) {
    if (!query) return null;
    const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?key=${encodeURIComponent(
      apiKey,
    )}&input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name,formatted_address`;
    const findResp = await fetch(findUrl);
    const findJson = await findResp.json();
    const candidate = findJson?.candidates?.[0];
    const candidateName = String(candidate?.name ?? '').trim().toLowerCase();
    const expectedName = String(args.name ?? '').trim().toLowerCase();
    // reject low-confidence match to reduce wrong photos/logos
    if (candidateName && expectedName && !candidateName.includes(expectedName.slice(0, Math.min(6, expectedName.length)))) {
      return null;
    }
    placeId = String(candidate?.place_id ?? '').trim();
  }
  if (!placeId) return null;

  const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?key=${encodeURIComponent(
    apiKey,
  )}&place_id=${encodeURIComponent(placeId)}&fields=name,types,photos`;

  const detailsResp = await fetch(detailsUrl);
  const detailsJson = await detailsResp.json();
  const photoRef = detailsJson?.result?.photos?.[0]?.photo_reference as string | undefined;
  if (!photoRef) return null;

  const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${encodeURIComponent(
    photoRef,
  )}&key=${encodeURIComponent(apiKey)}`;
  if (isLikelyLogoOrBadPlaceImage(photoUrl)) return null;
  return photoUrl;
}
