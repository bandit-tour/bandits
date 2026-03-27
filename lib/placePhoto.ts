import Constants from 'expo-constants';

/** Deterministic real photo when DB + Places are unavailable (never a gray box). */
export function picsumPlaceImage(seed: string, w = 800, h = 600): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
}

export function getCategoryFallbackImage(
  genre: string | null | undefined,
  seed: string,
  w = 800,
  h = 600,
): string {
  const key = String(genre ?? '').trim().toLowerCase();
  if (key.includes('food')) return `https://loremflickr.com/${w}/${h}/restaurant?lock=11`;
  if (key.includes('shopping')) return `https://loremflickr.com/${w}/${h}/shopping?lock=12`;
  if (key.includes('nightlife')) return `https://loremflickr.com/${w}/${h}/bar?lock=13`;
  if (key.includes('culture')) return `https://loremflickr.com/${w}/${h}/museum?lock=14`;
  if (key.includes('coffee')) return `https://loremflickr.com/${w}/${h}/coffee-shop?lock=15`;
  return picsumPlaceImage(seed, w, h);
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
  name: string;
  address: string;
  city: string;
  neighborhood: string;
}): Promise<string | null> {
  const apiKey = getMapsApiKey();
  if (!apiKey) return null;
  const query = [args.name, args.address, args.city, args.neighborhood].filter(Boolean).join(' ');
  if (!query.trim()) return null;

  const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?key=${encodeURIComponent(
    apiKey,
  )}&input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id`;

  const findResp = await fetch(findUrl);
  const findJson = await findResp.json();
  const placeId = findJson?.candidates?.[0]?.place_id as string | undefined;
  if (!placeId) return null;

  const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?key=${encodeURIComponent(
    apiKey,
  )}&place_id=${encodeURIComponent(placeId)}&fields=photos`;

  const detailsResp = await fetch(detailsUrl);
  const detailsJson = await detailsResp.json();
  const photoRef = detailsJson?.result?.photos?.[0]?.photo_reference as string | undefined;
  if (!photoRef) return null;

  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${encodeURIComponent(
    photoRef,
  )}&key=${encodeURIComponent(apiKey)}`;
}
