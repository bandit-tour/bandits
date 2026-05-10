/**
 * Re-hydrate every event row linked from bandit_event with Places API (New) photos + coordinates.
 * Loads EXPO_* from .env; Google key falls back to app.json native maps key if EXPO_PUBLIC_GOOGLE_MAPS_KEY is unset.
 * Prefer EXPO_PUBLIC_GOOGLE_MAPS_KEY from the same GCP project where **Places API (New)** is enabled — app.json keys are often Maps-SDK-only or a different project (403 SERVICE_DISABLED → every row skipped).
 *
 * Uses two-step reads (bandit_event.event_id → event by id). Embedded selects are unreliable if PostgREST
 * FK hints are missing.
 *
 *   npm run backfill:recommendation-places
 *   BACKFILL_FILTER=pending|all   (default: pending = rows that still need Google photos)
 *   BACKFILL_SKIP_TRACE_FIRST_N=5   (after run: replays first N skipped_no_match rows with full Places request/response logs)
 *
 * Auth: requires SUPABASE_SERVICE_ROLE_KEY in .env (anon cannot bypass RLS on bandit_event/event).
 *
 * After resolving photos, updates `event` plus `bandit_event.recommendation_place_photo_url` (migration 048).
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const PLACES_NEW_BASE = 'https://places.googleapis.com/v1';

const STOCK_IMAGE_HOSTS = ['images.pexels.com', 'pexels.com', 'images.unsplash.com', 'unsplash.com', 'picsum.photos'];

function isStockHostUri(uri) {
  const raw = String(uri ?? '').trim();
  if (!raw) return true;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return STOCK_IMAGE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/** True when DB primary image is not an obvious Google venue photo (matches “Image pending verification” UX). */
function eventNeedsGooglePhotoBackfill(ev) {
  const raw = String(ev.image_url ?? '').trim();
  if (!raw) return true;
  const u = raw.toLowerCase();
  if (u.startsWith('data:image/svg+xml')) return true;
  if (isStockHostUri(raw)) return true;
  if (u.includes('maps.googleapis.com/maps/api/place/photo')) return false;
  if (u.includes('places.googleapis.com/v1/places') && u.includes('/media')) return false;
  if (u.includes('googleusercontent.com') || u.includes('ggpht.com')) return false;
  return true;
}

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value === '') continue;
    // Replace empty shell vars (common on Windows) so .env supplies the real API key.
    if (String(process.env[key] ?? '').trim() === '') process.env[key] = value;
  }
}

function readMapsKeyFromAppJson() {
  try {
    const p = path.resolve(process.cwd(), 'app.json');
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    const extra = j?.expo?.extra?.googleMapsApiKey;
    const ios = j?.expo?.ios?.config?.googleMapsApiKey;
    const android = j?.expo?.android?.config?.googleMaps?.apiKey;
    return String(extra || ios || android || '').trim();
  } catch {
    return '';
  }
}

/** Unicode-aware: Greek/non-Latin venue names were stripped by [^a-z0-9], breaking many matches. */
function normalizeName(raw) {
  return String(raw ?? '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function placeNameTokens(raw) {
  const stop = new Set(['the', 'and', 'bar', 'cafe', 'restaurant', 'club', 'hotel', 'athens', 'greece']);
  return normalizeName(raw)
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !stop.has(t));
}

function scorePlaceNameSimilarity(expectedRaw, candidateRaw) {
  const expected = normalizeName(expectedRaw);
  const candidate = normalizeName(candidateRaw);
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
  for (const t of expectedTokens) if (candidateTokens.has(t)) overlap += 1;
  const forward = overlap / expectedTokens.length;
  if (expectedTokens.length === 1) return overlap === 1 ? 0.85 : 0;

  const backward = overlap / Math.max(candidateTokens.size, 1);
  return Math.max(forward * 0.9, backward * 0.75);
}

function normalizeForAddressMatch(s) {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasPlacesFormattedAddressAlignment(expectedAddress, expectedCity, formattedAddress) {
  const fa = normalizeForAddressMatch(formattedAddress ?? '');
  if (!fa) return false;
  const city = normalizeForAddressMatch(expectedCity);
  const addr = normalizeForAddressMatch(expectedAddress);

  const cityParts = city.split(/\s+/).filter((p) => p.length >= 3);
  for (const part of cityParts) {
    if (fa.includes(part)) return true;
  }

  const tokens = addr.split(/\s+/).filter((t) => t.length >= 3);
  const generic = new Set(['athina', 'athens', 'greece', 'ellada', 'ελλάδα', 'gr', 'the', 'and']);
  const significant = tokens.filter((t) => !generic.has(t));
  if (significant.length === 0) return false;

  let hits = 0;
  for (const t of significant) {
    if (fa.includes(t)) hits += 1;
  }
  if (hits >= 2) return true;
  return hits >= 1 && cityParts.some((c) => fa.includes(c));
}

/** Mirror lib/placePhoto.ts — avoid unrelated Places hits supplying venue photos. */
function isConfidentVenuePlacesMatch(
  expectedName,
  googleDisplayName,
  formattedAddress,
  expectedCity,
  expectedAddress,
) {
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

function stripParenthetical(name) {
  return String(name ?? '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSearchQueries(event) {
  const name = String(event.name ?? '').trim();
  const stripped = stripParenthetical(name);
  const parts = [name, event.address, event.city, event.neighborhood].filter(Boolean);
  const base = parts.join(', ').trim();
  const out = [];
  const push = (q) => {
    const t = String(q ?? '').trim();
    if (t && !out.includes(t)) out.push(t);
  };

  push(base);
  if (stripped && stripped !== name) {
    push([stripped, event.address, event.city, event.neighborhood].filter(Boolean).join(', ').trim());
  }
  const missingGeo = !String(event.city ?? '').trim() && !String(event.address ?? '').trim();
  if (missingGeo) {
    push(`${name}, Athens, Greece`);
    if (stripped !== name) push(`${stripped}, Athens, Greece`);
  }
  push(`${stripped || name}, Athens, Greece`);
  return out;
}

function buildLocationBiasCircle(event) {
  const lat = Number(event.location_lat);
  const lng = Number(event.location_lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  return {
    circle: {
      center: { latitude: lat, longitude: lng },
      radius: 35000.0,
    },
  };
}

function encodeSegments(fullResourceName) {
  return String(fullResourceName ?? '')
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function buildPhotoMediaUrl(apiKey, photoResourceName) {
  const name = String(photoResourceName ?? '').trim();
  if (!name) return null;
  const pathEncoded = encodeSegments(name);
  return `${PLACES_NEW_BASE}/${pathEncoded}/media?maxWidthPx=1600&maxHeightPx=1200&key=${encodeURIComponent(apiKey)}`;
}

function normalizePlaceId(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/^places\//i, '')
    .trim();
}

const PLACES_GET_FIELD_MASK = 'id,displayName,formattedAddress,addressComponents,location,photos';
const PLACES_SEARCH_FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.location,places.photos';

let placesHttpErrorLogged = false;

function warnPlacesFailureOnce(label, status, responseBodyRaw) {
  if (placesHttpErrorLogged) return;
  placesHttpErrorLogged = true;
  console.warn(`[backfill] ${label} HTTP ${status}`, String(responseBodyRaw ?? '').slice(0, 520));
}

async function placesNewFetchPlace(placeIdBare, apiKey, traceCollector) {
  const id = normalizePlaceId(placeIdBare);
  if (!id) return null;
  const url = `${PLACES_NEW_BASE}/places/${encodeURIComponent(id)}`;
  const resp = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': PLACES_GET_FIELD_MASK,
    },
  });
  const responseBodyRaw = await resp.text();
  if (traceCollector) {
    traceCollector.push({
      step: 'places GET (Place Details New)',
      request: {
        method: 'GET',
        url,
        headers: { 'X-Goog-FieldMask': PLACES_GET_FIELD_MASK, 'X-Goog-Api-Key': '<redacted>' },
      },
      responseStatus: resp.status,
      responseBodyRaw,
    });
  } else if (!resp.ok) {
    warnPlacesFailureOnce('places GET', resp.status, responseBodyRaw);
  }
  if (!resp.ok) return null;
  try {
    return JSON.parse(responseBodyRaw);
  } catch {
    return null;
  }
}

async function placesNewSearchText(textQuery, apiKey, locationBias, traceCollector) {
  const url = `${PLACES_NEW_BASE}/places:searchText`;
  const body = { textQuery, languageCode: 'en', regionCode: 'GR' };
  if (locationBias) body.locationBias = locationBias;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': PLACES_SEARCH_FIELD_MASK,
    },
    body: JSON.stringify(body),
  });
  const responseBodyRaw = await resp.text();
  if (traceCollector) {
    traceCollector.push({
      step: 'places:searchText',
      request: {
        method: 'POST',
        url,
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-FieldMask': PLACES_SEARCH_FIELD_MASK,
          'X-Goog-Api-Key': '<redacted>',
        },
        body,
      },
      responseStatus: resp.status,
      responseBodyRaw,
    });
  } else if (!resp.ok) {
    warnPlacesFailureOnce('places:searchText', resp.status, responseBodyRaw);
  }
  if (!resp.ok) return [];
  let json;
  try {
    json = JSON.parse(responseBodyRaw);
  } catch {
    return [];
  }
  return Array.isArray(json?.places) ? json.places : [];
}

function cityFromComponents(place) {
  const comps = Array.isArray(place?.addressComponents) ? place.addressComponents : [];
  const locality = comps.find((c) => Array.isArray(c?.types) && c.types.includes('locality'));
  return String(locality?.longText ?? locality?.long_name ?? '').trim() || null;
}

function photoUrlsFromPlace(apiKey, place, limit) {
  const photos = Array.isArray(place?.photos) ? place.photos : [];
  const out = [];
  for (const p of photos) {
    if (out.length >= limit) break;
    const resourceName = String(p?.name ?? '').trim();
    const media = buildPhotoMediaUrl(apiKey, resourceName);
    if (media) out.push(media);
  }
  return out;
}

async function resolvePlacesNewEvent(event, apiKey, traceCollector) {
  const trace = (phase, detail) => {
    if (traceCollector) traceCollector.push({ phase, ...detail });
  };

  const expectedName = String(event.name ?? '').trim();
  if (!expectedName) {
    trace('skip_reason', { reason: 'empty_event_name' });
    return null;
  }
  const photoLimit = 8;
  const bias = buildLocationBiasCircle(event);

  trace('event_context', {
    eventId: event.id,
    name: event.name,
    address: event.address ?? null,
    city: event.city ?? null,
    neighborhood: event.neighborhood ?? null,
    location_lat: event.location_lat ?? null,
    location_lng: event.location_lng ?? null,
    google_place_id: event.google_place_id ?? null,
    locationBiasCircle: bias,
  });

  let place = null;
  const existingId = normalizePlaceId(String(event.google_place_id ?? '').trim());
  if (existingId) {
    trace('try_stored_place_id', { google_place_id: existingId });
    place = await placesNewFetchPlace(existingId, apiKey, traceCollector);
    if (!place) {
      trace('stored_place_id', { outcome: 'fetch_returned_null_or_non_ok' });
    } else {
      const dn = String(place?.displayName?.text ?? '').trim();
      const faStored = String(place?.formattedAddress ?? '').trim() || null;
      if (expectedName && dn) {
        const ok = isConfidentVenuePlacesMatch(
          expectedName,
          dn,
          faStored,
          String(event.city ?? ''),
          String(event.address ?? ''),
        );
        trace('stored_place_id_confidence', { displayNameFromGoogle: dn, confident: ok });
        if (!ok) place = null;
      }
    }
  }

  if (!place) {
    const queries = buildSearchQueries(event);
    trace('search_queries_planned', { textQueriesInOrder: queries });
    let matched = null;
    let lastPlaces = [];
    for (const q of queries) {
      if (!q) continue;
      const places = await placesNewSearchText(q, apiKey, bias, traceCollector);
      lastPlaces = places;
      matched = places.find((p) => {
        const n = String(p?.displayName?.text ?? '').trim();
        if (!n) return false;
        const fa = String(p?.formattedAddress ?? '').trim();
        return isConfidentVenuePlacesMatch(
          expectedName,
          n,
          fa,
          String(event.city ?? ''),
          String(event.address ?? ''),
        );
      });
      if (matched) break;
    }

    if (!matched) {
      const ranked = Array.isArray(lastPlaces)
        ? lastPlaces
            .map((p) => {
              const n = String(p?.displayName?.text ?? '').trim();
              return {
                id: p?.id ?? null,
                displayName: n,
                similarityScore: n ? scorePlaceNameSimilarity(expectedName, n) : 0,
                photoCount: Array.isArray(p?.photos) ? p.photos.length : 0,
              };
            })
            .sort((a, b) => b.similarityScore - a.similarityScore)
            .slice(0, 8)
        : [];
      trace('skip_reason', {
        reason: 'no_matching_place_after_searchText_attempts',
        lastSearchResultCount: lastPlaces.length,
        topCandidatesBySimilarity: ranked,
      });
      return null;
    }
    const idFromSearch = normalizePlaceId(String(matched.id ?? '').trim());
    if (!idFromSearch) {
      trace('skip_reason', {
        reason: 'matched_place_missing_normalizable_id',
        matchedPreview: { id: matched.id, displayName: matched?.displayName?.text },
      });
      return null;
    }
    trace('search_match_selected', {
      placeResourceId: matched.id ?? null,
      displayName: matched?.displayName?.text ?? null,
    });
    const fullDetails = await placesNewFetchPlace(idFromSearch, apiKey, traceCollector);
    place = fullDetails ?? matched;
  }

  const placeIdBare = normalizePlaceId(String(place?.id ?? '').trim());
  if (!placeIdBare) {
    trace('skip_reason', { reason: 'empty_place_id_after_resolution', placePreview: place });
    return null;
  }

  const dnFinal = String(place?.displayName?.text ?? '').trim();
  const formattedAddress =
    String(place?.formattedAddress ?? '').trim() || String(place?.formatted_address ?? '').trim() || null;

  if (
    expectedName &&
    dnFinal &&
    !isConfidentVenuePlacesMatch(
      expectedName,
      dnFinal,
      formattedAddress,
      String(event.city ?? ''),
      String(event.address ?? ''),
    )
  ) {
    trace('skip_reason', {
      reason: 'venue_confidence_failed_after_resolution',
      displayNameFromGoogle: dnFinal,
    });
    return null;
  }

  let photoUrls = photoUrlsFromPlace(apiKey, place, photoLimit);
  if (photoUrls.length === 0) {
    trace('photos_empty_on_place_payload', { placeIdBare, note: 'refetching_place_details' });
    const refetch = await placesNewFetchPlace(placeIdBare, apiKey, traceCollector);
    if (refetch) photoUrls = photoUrlsFromPlace(apiKey, refetch, photoLimit);
  }
  if (photoUrls.length === 0) {
    trace('skip_reason', {
      reason: 'no_photo_urls_after_place_details',
      placeIdBare,
      rawPhotoFieldLength: Array.isArray(place?.photos) ? place.photos.length : 0,
    });
    return null;
  }

  const loc = place?.location ?? {};
  const locationLat =
    typeof loc.latitude === 'number' ? loc.latitude : event.location_lat != null ? Number(event.location_lat) : null;
  const locationLng =
    typeof loc.longitude === 'number' ? loc.longitude : event.location_lng != null ? Number(event.location_lng) : null;

  return {
    placeId: placeIdBare,
    formattedAddress,
    city: cityFromComponents(place) || String(event.city ?? '').trim() || null,
    locationLat,
    locationLng,
    photoUrls,
  };
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), '.env'));
  loadEnvFile(path.resolve(process.cwd(), '.env.local'));

  const supabaseUrl = String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
  const serviceRole = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  const mapsKey = String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '').trim() || readMapsKeyFromAppJson();

  if (!supabaseUrl) {
    throw new Error(
      '[backfill] Missing EXPO_PUBLIC_SUPABASE_URL. Add it to .env at the repo root.',
    );
  }

  if (!serviceRole) {
    throw new Error(
      [
        'SUPABASE_SERVICE_ROLE_KEY is missing or empty in .env.',
        '',
        'This backfill must read and update public.bandit_event and public.event. The anon key is blocked by RLS.',
        'Use the Supabase service_role secret (Dashboard → Project Settings → API → service_role).',
        '',
        'Add to .env (do not commit):',
        '  SUPABASE_SERVICE_ROLE_KEY=<your service_role JWT>',
        '',
        'Then rerun:',
        '  set BACKFILL_FILTER=all',
        '  npm run backfill:recommendation-places',
      ].join('\n'),
    );
  }

  const supabaseKey = serviceRole;
  console.log(JSON.stringify({ authMode: 'service_role' }, null, 2));
  if (!mapsKey) {
    throw new Error('Missing Google Maps key: set EXPO_PUBLIC_GOOGLE_MAPS_KEY or configure app.json native keys');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const maxRows = process.env.BACKFILL_MAX ? Number(process.env.BACKFILL_MAX) : Infinity;
  const filterMode = String(process.env.BACKFILL_FILTER ?? 'pending').toLowerCase() === 'all' ? 'all' : 'pending';
  const pageSize = 200;

  const { count: banditLinkCount, error: cntErr } = await supabase
    .from('bandit_event')
    .select('*', { count: 'exact', head: true });
  if (cntErr) console.warn('[backfill] bandit_event count:', cntErr.message);
  else console.log(JSON.stringify({ bandit_event_row_count: banditLinkCount ?? 0 }, null, 2));

  const eventIdSet = new Set();
  let bFrom = 0;
  for (;;) {
    const { data: linkRows, error: lErr } = await supabase
      .from('bandit_event')
      .select('event_id')
      .order('event_id', { ascending: true })
      .range(bFrom, bFrom + pageSize - 1);
    if (lErr) {
      console.warn('[backfill] bandit_event event_id read failed:', lErr.message);
      break;
    }
    const chunk = Array.isArray(linkRows) ? linkRows : [];
    if (chunk.length === 0) break;
    for (const row of chunk) {
      const id = row?.event_id;
      if (id) eventIdSet.add(id);
    }
    bFrom += pageSize;
    if (chunk.length < pageSize) break;
  }

  let allLinkedEvents = [];
  const ids = [...eventIdSet];
  for (let i = 0; i < ids.length; i += 120) {
    const slice = ids.slice(i, i + 120);
    const { data: evRows, error: eErr } = await supabase
      .from('event')
      .select(
        'id,name,address,city,neighborhood,google_place_id,image_url,image_gallery,location_lat,location_lng',
      )
      .in('id', slice);
    if (eErr) {
      console.warn('[backfill] event fetch failed:', eErr.message);
      break;
    }
    for (const ev of evRows ?? []) {
      if (ev?.id && String(ev.name ?? '').trim()) allLinkedEvents.push(ev);
    }
  }

  if (allLinkedEvents.length === 0) {
    console.warn(
      '[backfill] No events resolved from bandit_event (empty links, RLS, or event fetch failed). Trying full `event` scan fallback.',
    );
    let eFrom = 0;
    const evSeen = new Map();
    for (;;) {
      const { data: evBatch, error: evErr } = await supabase
        .from('event')
        .select(
          'id,name,address,city,neighborhood,google_place_id,image_url,image_gallery,location_lat,location_lng',
        )
        .order('id', { ascending: true })
        .range(eFrom, eFrom + pageSize - 1);
      if (evErr) {
        console.warn('[backfill] event table full scan failed', evErr.message);
        break;
      }
      const rows = Array.isArray(evBatch) ? evBatch : [];
      if (rows.length === 0) break;
      for (const ev of rows) {
        if (!ev?.id || !String(ev.name ?? '').trim()) continue;
        const hasNameOnly = Boolean(String(ev.name ?? '').trim());
        const hasNeighborhood = Boolean(String(ev.neighborhood ?? '').trim());
        const hasCtx =
          Boolean(String(ev.city ?? '').trim()) ||
          Boolean(String(ev.address ?? '').trim()) ||
          Boolean(String(ev.google_place_id ?? '').trim()) ||
          hasNeighborhood ||
          hasNameOnly;
        if (!hasCtx) continue;
        evSeen.set(ev.id, ev);
        if (evSeen.size >= maxRows) break;
      }
      eFrom += pageSize;
      if (rows.length < pageSize || evSeen.size >= maxRows) break;
    }
    allLinkedEvents = Array.from(evSeen.values());
  }

  let events =
    filterMode === 'all'
      ? allLinkedEvents
      : allLinkedEvents.filter((ev) => eventNeedsGooglePhotoBackfill(ev));

  if (events.length === 0 && filterMode === 'pending' && allLinkedEvents.length > 0) {
    console.warn(
      '[backfill] BACKFILL_FILTER=pending matched 0 rows (heuristic). Retrying with all linked recommendation events. Set BACKFILL_FILTER=all to skip pending filter.',
    );
    events = allLinkedEvents;
  }

  if (maxRows !== Infinity && events.length > maxRows) {
    events = events.slice(0, maxRows);
  }

  const skipTraceFirstN = Math.max(
    0,
    Number.parseInt(String(process.env.BACKFILL_SKIP_TRACE_FIRST_N ?? '5'), 10) || 5,
  );
  let skipTraceDetailedRemaining = skipTraceFirstN;
  let skipTraceChain = Promise.resolve();

  console.log(
    JSON.stringify(
      {
        uniqueEventIdsFromBanditLinks: eventIdSet.size,
        linkedEventsLoaded: allLinkedEvents.length,
        filterMode,
        totalEventsToProcess: events.length,
        mapsKeyConfigured: Boolean(mapsKey),
        skipTraceFirstN: skipTraceFirstN,
      },
      null,
      2,
    ),
  );

  const summary = { updated: 0, skipped_no_match: 0, failed: 0, errors: [], bandit_photo_url_warned: false };
  const concurrency = 6;

  async function workOne(ev) {
    const resolved = await resolvePlacesNewEvent(ev, mapsKey, null);
    if (!resolved) {
      summary.skipped_no_match += 1;
      skipTraceChain = skipTraceChain.then(async () => {
        if (skipTraceDetailedRemaining <= 0) return;
        skipTraceDetailedRemaining -= 1;
        const traceCollector = [];
        const traceNum = skipTraceFirstN - skipTraceDetailedRemaining;
        await resolvePlacesNewEvent(ev, mapsKey, traceCollector);
        console.log(
          `\n========== [backfill] SKIP TRACE ${traceNum}/${skipTraceFirstN} event_id=${ev.id} ==========\n${JSON.stringify(
            {
              outcome: 'skipped_no_match',
              event: {
                id: ev.id,
                name: ev.name,
                address: ev.address ?? null,
                city: ev.city ?? null,
                neighborhood: ev.neighborhood ?? null,
                location_lat: ev.location_lat ?? null,
                location_lng: ev.location_lng ?? null,
                google_place_id: ev.google_place_id ?? null,
              },
              detailedTrace: traceCollector,
            },
            null,
            2,
          )}\n`,
        );
      });
      return;
    }

    const primaryPhoto = resolved.photoUrls[0];
    const payload = {
      google_place_id: resolved.placeId,
      image_url: primaryPhoto,
      image_gallery: JSON.stringify(resolved.photoUrls),
      location_lat: resolved.locationLat,
      location_lng: resolved.locationLng,
      address: ev.address || resolved.formattedAddress || ev.address,
      city: ev.city || resolved.city || ev.city,
    };

    const { error: upErr } = await supabase.from('event').update(payload).eq('id', ev.id);
    if (upErr) {
      summary.failed += 1;
      summary.errors.push({ id: ev.id, name: ev.name, message: upErr.message });
      return;
    }

    const { error: beErr } = await supabase
      .from('bandit_event')
      .update({ recommendation_place_photo_url: primaryPhoto })
      .eq('event_id', ev.id);
    if (beErr && !summary.bandit_photo_url_warned) {
      summary.bandit_photo_url_warned = true;
      console.warn(
        '[backfill] Could not write bandit_event.recommendation_place_photo_url — apply supabase migration 048?',
        beErr.message,
      );
    }

    summary.updated += 1;
  }

  const queue = [...events];
  for (let offset = 0; offset < queue.length; offset += concurrency) {
    const chunk = queue.slice(offset, offset + concurrency);
    await Promise.all(
      chunk.map(async (ev) => {
        try {
          await workOne(ev);
        } catch (e) {
          summary.failed += 1;
          summary.errors.push({ id: ev.id, name: ev.name, message: String(e?.message ?? e) });
        }
      }),
    );
    await new Promise((r) => setTimeout(r, 200));
  }

  await skipTraceChain;

  console.log(JSON.stringify({ summary }, null, 2));
}

main().catch((err) => {
  console.error('[backfill-all-recommendation-places] failed', err);
  process.exit(1);
});
