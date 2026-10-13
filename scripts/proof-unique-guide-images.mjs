import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

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
    if (!(key in process.env)) process.env[key] = value;
  }
}

function normalizeEventImageUri(uri) {
  if (uri == null) return null;
  const t = String(uri).trim();
  if (!t) return null;
  if (/^(https?:|data:|blob:)/i.test(t)) return t;
  const base = String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  if (!base) return t;
  if (t.startsWith('/')) return `${base}${t}`;
  return `${base}/${t.replace(/^\//, '')}`;
}

function isLikelyLogoOrBadPlaceImage(uri) {
  const t = String(uri ?? '').trim().toLowerCase();
  if (!t) return true;
  return (
    t.includes('logobanditourapp') ||
    t.includes('banditour-logo') ||
    t.includes('banditourmainlogo') ||
    t.includes('banditour-main-logo') ||
    t.includes('play-theatrou') ||
    t.includes('play_athens_bg') ||
    t.includes('play-psyri') ||
    t.includes('/logo') ||
    t.includes('icon.png') ||
    t.includes('favicon') ||
    t.includes('adaptive-icon') ||
    t.includes('splash-icon')
  );
}

function getCategoryImagePoolUrls(genre, w = 900, h = 675) {
  const key = String(genre ?? '').trim().toLowerCase();
  const FOOD = [
    `https://images.pexels.com/photos/262978/pexels-photo-262978.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/67468/pexels-photo-67468.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/70497/pexels-photo-70497.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/460537/pexels-photo-460537.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
  ];
  const CULTURE = [
    `https://images.pexels.com/photos/2363/france-landmark-lights-night.jpg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/161154/stained-glass-museum-art-glass-161154.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/256369/pexels-photo-256369.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/2251247/pexels-photo-2251247.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/2089698/pexels-photo-2089698.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/69903/pexels-photo-69903.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
  ];
  const NIGHT = [
    `https://images.pexels.com/photos/274192/pexels-photo-274192.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/167636/pexels-photo-167636.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
  ];
  const SHOP = [
    `https://images.pexels.com/photos/264547/pexels-photo-264547.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/1884584/pexels-photo-1884584.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/994523/pexels-photo-994523.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
  ];
  const COFFEE = [
    `https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/2074130/pexels-photo-2074130.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/312418/pexels-photo-312418.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
  ];
  const GENERIC = [
    `https://images.pexels.com/photos/378570/pexels-photo-378570.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/2901209/pexels-photo-2901209.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
    `https://images.pexels.com/photos/2904944/pexels-photo-2904944.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`,
  ];
  if (key.includes('food')) return FOOD;
  if (key.includes('culture')) return CULTURE;
  if (key.includes('nightlife')) return NIGHT;
  if (key.includes('shopping')) return SHOP;
  if (key.includes('coffee')) return COFFEE;
  return GENERIC;
}

function picsumPlaceImage(seed, w = 900, h = 675) {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
}

function canonicalizeImageIdentity(rawUri) {
  const uri = normalizeEventImageUri(rawUri) ?? rawUri;
  try {
    const u = new URL(uri);
    const host = u.hostname.toLowerCase();
    const p = u.pathname;
    if (host.includes('maps.googleapis.com') && p.includes('/photo')) {
      return `google-photo:${u.searchParams.get('photoreference') ?? ''}`;
    }
    if (host.includes('picsum.photos') && p.includes('/seed/')) {
      const m = p.match(/\/seed\/([^/]+)/i);
      if (m?.[1]) return `picsum-seed:${decodeURIComponent(m[1])}`;
    }
    if (
      host.includes('pexels.com') ||
      host.includes('unsplash.com') ||
      host.includes('supabase.co') ||
      host.includes('googleusercontent.com')
    ) {
      return `${host}${p}`.toLowerCase();
    }
    return `${host}${p}${u.search}`.toLowerCase();
  } catch {
    return String(uri).trim().toLowerCase();
  }
}

function parseGallery(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((v) => typeof v === 'string');
  } catch {}
  return String(raw)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function dbCandidates(event) {
  const out = [];
  const add = (raw) => {
    const n = normalizeEventImageUri(raw);
    if (!n || isLikelyLogoOrBadPlaceImage(n)) return;
    if (!out.includes(n)) out.push(n);
  };
  parseGallery(event.image_gallery).forEach(add);
  add(event.image_url);
  return out;
}

function buildPlan(events) {
  const claimed = new Set();
  const scopedById = new Map();
  for (const e of events) {
    const scoped = [];
    for (const u of dbCandidates(e)) {
      const identity = canonicalizeImageIdentity(u);
      if (claimed.has(identity)) continue;
      claimed.add(identity);
      scoped.push(u);
    }
    scopedById.set(e.id, scoped);
  }
  const used = new Set();
  for (const e of events) {
    for (const u of scopedById.get(e.id) ?? []) used.add(canonicalizeImageIdentity(u));
  }
  const finalById = new Map();
  for (const e of events) {
    let fallback = null;
    for (const p of getCategoryImagePoolUrls(e.genre)) {
      const id = canonicalizeImageIdentity(p);
      if (!used.has(id)) {
        used.add(id);
        fallback = p;
        break;
      }
    }
    if (!fallback) {
      let idx = 0;
      while (!fallback) {
        const candidate = picsumPlaceImage(`guide-${String(e.genre ?? 'city')}-${e.id}-${idx}`);
        const id = canonicalizeImageIdentity(candidate);
        if (!used.has(id)) {
          used.add(id);
          fallback = candidate;
          break;
        }
        idx += 1;
      }
    }
    const db = scopedById.get(e.id)?.[0] ?? null;
    finalById.set(e.id, { uri: db ?? fallback, source: db ? 'db' : 'fallback', genre: e.genre });
  }
  return finalById;
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), '.env'));
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
  }
  const supabase = createClient(url, key);

  const { data: bandits, error: bErr } = await supabase.from('bandit').select('id,name').limit(30);
  if (bErr) throw bErr;
  if (!bandits?.length) throw new Error('No bandits found');

  let chosen = null;
  let chosenEvents = [];
  for (const b of bandits) {
    const { data: evs, error } = await supabase
      .from('event')
      .select('id,genre,image_gallery,image_url,name')
      .eq('bandit_id', b.id)
      .limit(40);
    if (error) continue;
    if ((evs?.length ?? 0) > chosenEvents.length) {
      chosen = b;
      chosenEvents = evs ?? [];
    }
  }
  if (!chosen || chosenEvents.length < 2) throw new Error('No bandit with multiple recommendations found');

  const plan = buildPlan(chosenEvents);
  const assigned = chosenEvents.map((e) => ({ id: e.id, name: e.name, ...plan.get(e.id) }));
  const identities = assigned.map((a) => canonicalizeImageIdentity(a.uri));
  const identitySet = new Set(identities);
  const duplicateCount = identities.length - identitySet.size;
  const fallbackAssigned = assigned.filter((a) => a.source === 'fallback');
  const fallbackIdentitySet = new Set(fallbackAssigned.map((a) => canonicalizeImageIdentity(a.uri)));
  const unavailableCount = assigned.filter((a) => /image unavailable/i.test(String(a.uri))).length;

  const result = {
    status:
      duplicateCount === 0 &&
      unavailableCount === 0 &&
      fallbackIdentitySet.size === fallbackAssigned.length
        ? 'PASS'
        : 'FAIL',
    banditId: chosen.id,
    banditName: chosen.name,
    recommendationCount: assigned.length,
    uniqueImageCount: identitySet.size,
    duplicateCount,
    fallbackCount: fallbackAssigned.length,
    uniqueFallbackCount: fallbackIdentitySet.size,
    unavailableCount,
    sample: assigned.slice(0, 8),
  };
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'PASS') process.exit(1);
}

main().catch((err) => {
  console.error('[proof-unique-guide-images] failed', err);
  process.exit(1);
});
