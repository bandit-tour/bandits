import Constants from 'expo-constants';

/** Deterministic real photo when DB + Places are unavailable (never a gray box). */
export function picsumPlaceImage(seed: string, w = 800, h = 600): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
}

export function isLikelyLogoOrBadPlaceImage(uri: string | null | undefined): boolean {
  const t = String(uri ?? '').trim().toLowerCase();
  if (!t) return true;
  const looksLikeExplicitLogoAsset =
    /(?:^|[\/_.-])logo(?:[\/_.-]|$)/i.test(t) ||
    /(?:^|[\/_.-])favicon(?:[\/_.-]|$)/i.test(t) ||
    /(?:^|[\/_.-])icon(?:[\/_.-]|$)/i.test(t) ||
    /(?:^|[\/_.-])adaptive-icon(?:[\/_.-]|$)/i.test(t) ||
    /(?:^|[\/_.-])splash-icon(?:[\/_.-]|$)/i.test(t);
  // Block known app/brand assets and obvious non-place images.
  if (
    t.includes('logobanditourapp') ||
    t.includes('banditour-logo') ||
    t.includes('banditourmainlogo') ||
    t.includes('banditour-main-logo') ||
    t.includes('play-theatrou') ||
    t.includes('play_athens_bg') ||
    t.includes('play-psyri') ||
    looksLikeExplicitLogoAsset
  ) {
    return true;
  }
  return false;
}

/** Stable index 0..mod-1 from a string (djb2) — avoids duplicate picks from weak char-sum hashing. */
export function hashPickIndex(seed: string, modulo: number): number {
  if (modulo <= 1) return 0;
  let h = 5381;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % modulo;
}

/** Neutral city/places pool when genre is unknown (no random picsum). */
export function getGenericCityImagePoolUrls(w = 800, h = 600): readonly string[] {
  return [
    `https://images.pexels.com/photos/378570/pexels-photo-378570.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/2901209/pexels-photo-2901209.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/2904944/pexels-photo-2904944.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/3408354/pexels-photo-3408354.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/264636/pexels-photo-264636.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/1438761/pexels-photo-1438761.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/2904948/pexels-photo-2904948.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/325044/pexels-photo-325044.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
  ];
}

/** Ordered URLs for thematic fallbacks — used list-wide without repeating URLs in the same assignment pass. */
export function getCategoryImagePoolUrls(genre: string | null | undefined, w = 800, h = 600): readonly string[] {
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
    `https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/2251247/pexels-photo-2251247.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/2089698/pexels-photo-2089698.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/69903/pexels-photo-69903.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
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

  if (key.includes('food')) return FOOD_IMAGES;
  if (key.includes('shopping')) return SHOPPING_IMAGES;
  if (key.includes('nightlife')) return NIGHTLIFE_IMAGES;
  if (key.includes('culture')) return CULTURE_IMAGES;
  if (key.includes('coffee')) return COFFEE_IMAGES;
  return getGenericCityImagePoolUrls(w, h);
}

export function getCategoryFallbackImage(
  genre: string | null | undefined,
  seed: string,
  w = 800,
  h = 600,
): string {
  const key = String(genre ?? '').trim().toLowerCase();
  const themed = getCategoryImagePoolUrls(genre, w, h);
  const pickKey = `${seed}|${key}`;
  if (themed.length > 0) return themed[hashPickIndex(pickKey, themed.length)];
  const generic = getGenericCityImagePoolUrls(w, h);
  return generic[hashPickIndex(pickKey, generic.length)];
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
  const extra = String((Constants.expoConfig as any)?.extra?.googleMapsApiKey ?? '').trim();
  return (
    String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '').trim() ||
    extra ||
    (Constants.expoConfig as any)?.android?.config?.googleMaps?.apiKey ||
    (Constants.expoConfig as any)?.ios?.config?.googleMapsApiKey ||
    ''
  );
}

function normalizePlaceName(raw: string): string {
  return String(raw ?? '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function placeNameTokens(raw: string): string[] {
  const stop = new Set(['the', 'and', 'bar', 'cafe', 'restaurant', 'club', 'hotel', 'athens', 'greece']);
  return normalizePlaceName(raw)
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !stop.has(t));
}

function scorePlaceNameSimilarity(expectedRaw: string, candidateRaw: string): number {
  const expected = normalizePlaceName(expectedRaw);
  const candidate = normalizePlaceName(candidateRaw);
  if (!expected || !candidate) return 0;
  if (candidate === expected) return 1;
  if (candidate.includes(expected) || expected.includes(candidate)) return 0.92;

  const expectedTokens = placeNameTokens(expectedRaw);
  const candidateTokens = new Set(placeNameTokens(candidateRaw));
  if (expectedTokens.length === 0) {
    const words = expected.split(/\s+/).filter((w) => w.length >= 2);
    for (const w of words) {
      if (candidate.includes(w)) return 0.45;
    }
    return 0;
  }

  let overlap = 0;
  for (const t of expectedTokens) {
    if (candidateTokens.has(t)) overlap += 1;
  }
  const forward = overlap / expectedTokens.length;
  if (expectedTokens.length === 1) return overlap === 1 ? 0.85 : 0;

  const backward = overlap / Math.max(candidateTokens.size, 1);
  return Math.max(forward * 0.9, backward * 0.75);
}

function normalizeForAddressMatch(s: string): string {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Google-hosted venue photo URLs only (Places legacy photo, Places New media, common Google CDNs). */
export function isGooglePlacesDerivedPhotoUrl(uri: string | null | undefined): boolean {
  const t = String(uri ?? '').trim().toLowerCase();
  if (!t) return false;
  if (t.includes('maps.googleapis.com/maps/api/place/photo')) return true;
  if (t.includes('places.googleapis.com/') && t.includes('/media')) return true;
  if (t.includes('googleusercontent.com') || t.includes('ggpht.com')) return true;
  return false;
}

export function hasPlacesFormattedAddressAlignment(
  expectedAddress: string,
  expectedCity: string,
  formattedAddress: string | null | undefined,
): boolean {
  const fa = normalizeForAddressMatch(formattedAddress ?? '');
  if (!fa) return false;
  const city = normalizeForAddressMatch(expectedCity);
  const addr = normalizeForAddressMatch(expectedAddress);

  const cityParts = city.split(/\s+/).filter((p) => p.length >= 3);
  for (const part of cityParts) {
    if (fa.includes(part)) return true;
  }

  const tokens = addr.split(/\s+/).filter((t) => t.length >= 3);
  const generic = new Set([
    'athina',
    'athens',
    'greece',
    'ellada',
    'ελλάδα',
    'gr',
    'the',
    'and',
  ]);
  const significant = tokens.filter((t) => !generic.has(t));
  if (significant.length === 0) return false;

  let hits = 0;
  for (const t of significant) {
    if (fa.includes(t)) hits += 1;
  }
  if (hits >= 2) return true;
  return hits >= 1 && cityParts.some((c) => fa.includes(c));
}

/**
 * Accept a Places hit only for near-exact name OR strong name + city/address alignment.
 * Prevents unrelated venues (similar tokens, wrong business) from supplying photos.
 */
export function isConfidentVenuePlacesMatch(
  expectedName: string,
  googleDisplayName: string,
  formattedAddress: string | null | undefined,
  expectedCity: string,
  expectedAddress: string,
): boolean {
  const en = String(expectedName ?? '').trim();
  const gn = String(googleDisplayName ?? '').trim();
  if (!en || !gn) return false;
  const nameScore = scorePlaceNameSimilarity(en, gn);
  if (nameScore >= 0.9) return true;
  if (nameScore >= 0.72 && hasPlacesFormattedAddressAlignment(expectedAddress, expectedCity, formattedAddress)) {
    return true;
  }
  return false;
}

function stripParentheticalGuideName(name: string): string {
  return String(name ?? '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildPlacesSearchQueries(args: {
  name: string;
  address: string;
  city: string;
  neighborhood: string;
}): string[] {
  const name = String(args.name ?? '').trim();
  const stripped = stripParentheticalGuideName(name);
  const parts = [name, args.address, args.city, args.neighborhood].filter(Boolean);
  const base = parts.join(', ').trim();
  const out: string[] = [];
  const push = (q: string) => {
    const t = String(q ?? '').trim();
    if (t && !out.includes(t)) out.push(t);
  };

  push(base);
  if (stripped && stripped !== name) {
    push([stripped, args.address, args.city, args.neighborhood].filter(Boolean).join(', ').trim());
  }
  const missingGeo = !String(args.city ?? '').trim() && !String(args.address ?? '').trim();
  if (missingGeo) {
    push(`${name}, Athens, Greece`);
    if (stripped !== name) push(`${stripped}, Athens, Greece`);
  }
  push(`${stripped || name}, Athens, Greece`);
  return out;
}

const PLACES_API_NEW_BASE = 'https://places.googleapis.com/v1';

/** Path-encode full resource segments: places/ChIJ…/photos/AW… → safe v1 suffix */
function encodePlacesNewResourceSegments(fullResourceName: string): string {
  return String(fullResourceName ?? '')
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

/** Public media URL used in Supabase/UI (redirects to actual image CDN). */
export function buildPlacesNewPhotoMediaUrl(apiKey: string, photoResourceName: string): string | null {
  const name = String(photoResourceName ?? '').trim();
  const key = String(apiKey ?? '').trim();
  if (!name || !key) return null;
  const path = encodePlacesNewResourceSegments(name);
  if (!path) return null;
  return `${PLACES_API_NEW_BASE}/${path}/media?maxWidthPx=1600&maxHeightPx=1200&key=${encodeURIComponent(key)}`;
}

function normalizeStoredPlaceId(raw: string): string {
  return String(raw ?? '')
    .trim()
    .replace(/^places\//i, '')
    .trim();
}

async function placesNewFetchPlace(placeIdBare: string, apiKey: string): Promise<any | null> {
  const id = normalizeStoredPlaceId(placeIdBare);
  if (!id) return null;
  const url = `${PLACES_API_NEW_BASE}/places/${encodeURIComponent(id)}`;
  const resp = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      // Place Details (New) field mask — photos + locality for enrichment
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,addressComponents,location,photos',
    },
  });
  if (!resp.ok) return null;
  try {
    return await resp.json();
  } catch {
    return null;
  }
}

async function placesNewSearchText(textQuery: string, apiKey: string): Promise<any[]> {
  const resp = await fetch(`${PLACES_API_NEW_BASE}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.photos',
    },
    body: JSON.stringify({
      textQuery,
      languageCode: 'en',
      regionCode: 'GR',
    }),
  });
  if (!resp.ok) return [];
  let json: any;
  try {
    json = await resp.json();
  } catch {
    return [];
  }
  return Array.isArray(json?.places) ? json.places : [];
}

function cityFromPlacesNewAddressComponents(place: any): string | null {
  const comps = Array.isArray(place?.addressComponents) ? place.addressComponents : [];
  const locality = comps.find(
    (c: any) => Array.isArray(c?.types) && c.types.includes('locality'),
  );
  const s = String(locality?.longText ?? locality?.long_name ?? '').trim();
  return s || null;
}

function photoUrlsFromPlacesNewPayload(apiKey: string, place: any, limit: number): string[] {
  const photos = Array.isArray(place?.photos) ? place.photos : [];
  const out: string[] = [];
  for (const p of photos) {
    if (out.length >= limit) break;
    const resourceName = String((p as any)?.name ?? '').trim();
    const media = buildPlacesNewPhotoMediaUrl(apiKey, resourceName);
    if (!media || isLikelyLogoOrBadPlaceImage(media)) continue;
    if (!out.includes(media)) out.push(media);
  }
  return out;
}

/**
 * Prefer Places API (New); legacy Places Web Service is optional fallback where still enabled.
 */
async function resolveGooglePlaceBusinessDataNew(args: {
  placeId?: string | null;
  name: string;
  address: string;
  city: string;
  neighborhood: string;
  photoLimit?: number;
  apiKey: string;
}): Promise<{
  placeId: string;
  name: string | null;
  formattedAddress: string | null;
  city: string | null;
  locationLat: number | null;
  locationLng: number | null;
  photoUrls: string[];
} | null> {
  const expectedName = String(args.name ?? '').trim();
  if (!expectedName) return null;
  const normalizedPlaceId = normalizeStoredPlaceId(String(args.placeId ?? '').trim());
  const apiKey = args.apiKey;
  const photoLimit = Math.max(1, Math.min(10, Number(args.photoLimit ?? 6) || 6));

  let place: any = null;

  if (normalizedPlaceId) {
    place = await placesNewFetchPlace(normalizedPlaceId, apiKey);
    const fetchedName =
      String(place?.displayName?.text ?? '').trim() || String(place?.display_name?.text ?? '').trim();
    const faStored =
      String(place?.formattedAddress ?? '').trim() || String(place?.formatted_address ?? '').trim() || null;
    if (
      expectedName &&
      fetchedName &&
      !isConfidentVenuePlacesMatch(expectedName, fetchedName, faStored, args.city, args.address)
    ) {
      place = null;
    }
  }

  if (!place) {
    const queries = buildPlacesSearchQueries({
      name: args.name,
      address: args.address,
      city: args.city,
      neighborhood: args.neighborhood,
    });
    let matched: any = null;
    for (const query of queries) {
      if (!query) continue;
      const places = await placesNewSearchText(query, apiKey);
      matched = places.find((p: any) => {
        const n = String(p?.displayName?.text ?? '').trim();
        if (!n) return false;
        const fa = String(p?.formattedAddress ?? '').trim();
        return isConfidentVenuePlacesMatch(expectedName, n, fa, args.city, args.address);
      });
      if (matched) break;
    }
    if (!matched) return null;

    const idFromSearch = normalizeStoredPlaceId(String(matched.id ?? '').trim());
    if (!idFromSearch) return null;

    const fullDetails = await placesNewFetchPlace(idFromSearch, apiKey);
    place = fullDetails ?? matched;
  }

  const placeIdBare = normalizeStoredPlaceId(String(place?.id ?? '').trim());
  if (!placeIdBare) return null;

  const displayName =
    String(place?.displayName?.text ?? '').trim() || String(place?.display_name?.text ?? '').trim();

  const formattedAddress =
    String(place?.formattedAddress ?? '').trim() || String(place?.formatted_address ?? '').trim() || null;

  if (
    expectedName &&
    displayName &&
    !isConfidentVenuePlacesMatch(expectedName, displayName, formattedAddress, args.city, args.address)
  ) {
    return null;
  }
  const city =
    cityFromPlacesNewAddressComponents(place) ||
    String(args.city ?? '').trim() ||
    null;
  const loc = place?.location;
  let locationLat: number | null = null;
  let locationLng: number | null = null;
  if (loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
    locationLat = loc.latitude;
    locationLng = loc.longitude;
  }

  let photoUrls = photoUrlsFromPlacesNewPayload(apiKey, place, photoLimit);
  if (photoUrls.length === 0) {
    const refetch = await placesNewFetchPlace(placeIdBare, apiKey);
    if (refetch) photoUrls = photoUrlsFromPlacesNewPayload(apiKey, refetch, photoLimit);
  }

  return {
    placeId: placeIdBare,
    name: displayName || null,
    formattedAddress,
    city,
    locationLat,
    locationLng,
    photoUrls,
  };
}

async function resolveGooglePlaceBusinessDataLegacy(args: {
  placeId?: string | null;
  name: string;
  address: string;
  city: string;
  neighborhood: string;
  photoLimit?: number;
  apiKey: string;
}): Promise<{
  placeId: string;
  name: string | null;
  formattedAddress: string | null;
  city: string | null;
  locationLat: number | null;
  locationLng: number | null;
  photoUrls: string[];
} | null> {
  const apiKey = args.apiKey;
  const query = [args.name, args.address, args.city, args.neighborhood].filter(Boolean).join(' ').trim();
  const expectedName = String(args.name ?? '').trim();
  const normalizedPlaceId = String(args.placeId ?? '').trim();
  let placeId = '';

  if (query) {
    const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?key=${encodeURIComponent(
      apiKey,
    )}&input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name,formatted_address`;
    const findResp = await fetch(findUrl);
    const findJson = await findResp.json();
    const candidates = Array.isArray(findJson?.candidates) ? findJson.candidates : [];
    const matched = candidates.find((c: any) => {
      const n = String(c?.name ?? '').trim();
      const fa = String(c?.formatted_address ?? '').trim();
      return isConfidentVenuePlacesMatch(expectedName, n, fa, args.city, args.address);
    });
    if (matched?.place_id) {
      placeId = String(matched.place_id).trim();
    }
  }

  if (!placeId) placeId = normalizedPlaceId;
  if (!placeId) return null;

  const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?key=${encodeURIComponent(
    apiKey,
  )}&place_id=${encodeURIComponent(
    placeId,
  )}&fields=place_id,name,formatted_address,address_components,geometry/location,photos`;
  const detailsResp = await fetch(detailsUrl);
  const detailsJson = await detailsResp.json();
  const result = detailsJson?.result;
  if (!result) return null;

  const detailsName = String(result?.name ?? '').trim();
  const formattedAddr = String(result?.formatted_address ?? '').trim() || null;
  if (
    expectedName &&
    detailsName &&
    !isConfidentVenuePlacesMatch(expectedName, detailsName, formattedAddr, args.city, args.address)
  ) {
    return null;
  }

  const addressComponents = Array.isArray(result?.address_components) ? result.address_components : [];
  const cityComponent = addressComponents.find((c: any) =>
    Array.isArray(c?.types) && c.types.includes('locality'),
  );
  const city =
    String(cityComponent?.long_name ?? '').trim() ||
    String(args.city ?? '').trim() ||
    null;

  const photos = Array.isArray(result?.photos) ? result.photos : [];
  const out: string[] = [];
  const limit = Math.max(1, Math.min(10, Number(args.photoLimit ?? 6) || 6));
  for (const p of photos) {
    if (out.length >= limit) break;
    const photoRef = String((p as any)?.photo_reference ?? '').trim();
    if (!photoRef) continue;
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photoreference=${encodeURIComponent(
      photoRef,
    )}&key=${encodeURIComponent(apiKey)}`;
    if (isLikelyLogoOrBadPlaceImage(photoUrl)) continue;
    if (!out.includes(photoUrl)) out.push(photoUrl);
  }

  return {
    placeId,
    name: detailsName || null,
    formattedAddress: String(result?.formatted_address ?? '').trim() || null,
    city,
    locationLat:
      typeof result?.geometry?.location?.lat === 'number' ? result.geometry.location.lat : null,
    locationLng:
      typeof result?.geometry?.location?.lng === 'number' ? result.geometry.location.lng : null,
    photoUrls: out,
  };
}

export async function fetchGooglePlacePhotoUrl(args: {
  placeId?: string | null;
  name: string;
  address: string;
  city: string;
  neighborhood: string;
}): Promise<string | null> {
  const urls = await fetchGooglePlacePhotoUrls(args);
  return urls[0] ?? null;
}

export async function fetchGooglePlacePhotoUrls(args: {
  placeId?: string | null;
  name: string;
  address: string;
  city: string;
  neighborhood: string;
  limit?: number;
}): Promise<string[]> {
  const resolved = await resolveGooglePlaceBusinessData({
    ...args,
    photoLimit: args.limit ?? 5,
  });
  return resolved?.photoUrls ?? [];
}

export async function resolveGooglePlaceBusinessData(args: {
  placeId?: string | null;
  name: string;
  address: string;
  city: string;
  neighborhood: string;
  photoLimit?: number;
}): Promise<{
  placeId: string;
  name: string | null;
  formattedAddress: string | null;
  city: string | null;
  locationLat: number | null;
  locationLng: number | null;
  photoUrls: string[];
} | null> {
  const apiKey = getMapsApiKey();
  if (!apiKey) return null;

  const nextTry = await resolveGooglePlaceBusinessDataNew({
    ...args,
    apiKey,
  });
  // New API already applied strict venue matching; never fall through to legacy for a different wrong venue.
  if (nextTry !== null) return nextTry;

  const legacy = await resolveGooglePlaceBusinessDataLegacy({
    ...args,
    apiKey,
  });
  return legacy;
}
