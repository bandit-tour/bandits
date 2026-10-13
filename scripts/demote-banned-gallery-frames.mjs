/**
 * Sync the per-photo-reference ban list (`lib/photoBanList.ts`) with the DB:
 * for every event row whose `image_gallery` or `image_url` contains a banned
 * photo reference, drop that frame from the gallery and (if it was the hero)
 * promote the next acceptable frame.
 *
 * This is the data-layer mirror of the runtime guard in
 * `lib/photoBanList.ts`. Running it after editing the ban list ensures cached
 * hero URLs and persisted galleries match what the runtime would render, and
 * removes the offending photo from the venue's detail-page gallery too.
 *
 *   node scripts/demote-banned-gallery-frames.mjs
 *
 * Reads `EXPO_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from `.env`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (v && String(process.env[k] ?? '').trim() === '') process.env[k] = v;
  }
}

loadEnvFile(path.join(ROOT, '.env'));
loadEnvFile(path.join(ROOT, '.env.local'));

/**
 * Source of truth for banned photo references. Keep in sync with
 * `lib/photoBanList.ts` `BANNED_PHOTO_REFS_RAW`. Each entry's `photoRef` is
 * the unique trailing token after `/photos/` in a Places (New) media URL
 * (or the `photoreference` query value for legacy URLs).
 */
const BANNED_PHOTO_REFS = [
  {
    photoRef: 'Ab43m-uCg4Bocdy-A4YaKjsyt02FT2LU6qS8x9RZEtlwX5zofm5GfUehOlPtbEhOq',
    venue: 'The Brunchers',
    reason: 'burger-and-fries close-up flagged as off-brand for a brunch venue',
  },
];

const BANNED_REFS_LOWER = BANNED_PHOTO_REFS.map((b) => b.photoRef.toLowerCase());

function urlContainsBannedRef(uri) {
  const t = String(uri ?? '').trim().toLowerCase();
  if (!t) return false;
  return BANNED_REFS_LOWER.some((ref) => ref && t.includes(ref));
}

function parseGallery(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
  } catch {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
}

async function main() {
  const supabaseUrl = String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
  const serviceRole = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!supabaseUrl || !serviceRole) {
    console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

  // For each banned photoref, query rows whose image_url or image_gallery match.
  let totalEventUpdates = 0;
  let totalBanditEventUpdates = 0;
  let totalSpotUpdates = 0;

  for (const banned of BANNED_PHOTO_REFS) {
    const ref = banned.photoRef;
    const ilikePattern = `%${ref}%`;
    console.log(`\n[ban] processing photoref ${ref.slice(0, 24)}…  (${banned.venue ?? 'unknown'})`);

    // ── public.event ────────────────────────────────────────────────────────
    const { data: events, error: evErr } = await supabase
      .from('event')
      .select('id, name, image_url, image_gallery')
      .or(`image_url.ilike.${ilikePattern},image_gallery.ilike.${ilikePattern}`);
    if (evErr) {
      console.error(`  event select error: ${evErr.message}`);
    } else {
      for (const row of events ?? []) {
        const gallery = parseGallery(row.image_gallery);
        const cleanedGallery = gallery.filter((u) => !urlContainsBannedRef(u));
        const heroIsBanned = urlContainsBannedRef(row.image_url);
        const newHero = heroIsBanned ? cleanedGallery[0] ?? '' : row.image_url ?? '';
        const payload = {
          image_url: newHero,
          image_gallery: cleanedGallery.length > 0 ? JSON.stringify(cleanedGallery) : '[]',
        };
        const { error: upErr } = await supabase.from('event').update(payload).eq('id', row.id);
        if (upErr) {
          console.error(`  event[${row.id}] (${row.name}) update FAILED: ${upErr.message}`);
        } else {
          console.log(
            `  event[${row.id}] (${row.name}) cleaned — gallery ${gallery.length} → ${cleanedGallery.length}; hero ${heroIsBanned ? 'rotated' : 'unchanged'}`,
          );
          totalEventUpdates += 1;
        }
      }
    }

    // ── public.spots ────────────────────────────────────────────────────────
    const { data: spots, error: spErr } = await supabase
      .from('spots')
      .select('id, name, image_url, image_gallery')
      .or(`image_url.ilike.${ilikePattern},image_gallery.ilike.${ilikePattern}`);
    if (spErr) {
      console.warn(`  spots select skipped: ${spErr.message}`);
    } else {
      for (const row of spots ?? []) {
        const gallery = parseGallery(row.image_gallery);
        const cleanedGallery = gallery.filter((u) => !urlContainsBannedRef(u));
        const heroIsBanned = urlContainsBannedRef(row.image_url);
        const newHero = heroIsBanned ? cleanedGallery[0] ?? null : row.image_url ?? null;
        const payload = {
          image_url: newHero,
          image_gallery: cleanedGallery.length > 0 ? JSON.stringify(cleanedGallery) : null,
        };
        const { error: upErr } = await supabase.from('spots').update(payload).eq('id', row.id);
        if (upErr) console.error(`  spot[${row.id}] update FAILED: ${upErr.message}`);
        else {
          console.log(
            `  spot[${row.id}] (${row.name}) cleaned — gallery ${gallery.length} → ${cleanedGallery.length}; hero ${heroIsBanned ? 'rotated' : 'unchanged'}`,
          );
          totalSpotUpdates += 1;
        }
      }
    }

    // ── public.bandit_event.recommendation_place_photo_url ──────────────────
    const { data: links, error: beErr } = await supabase
      .from('bandit_event')
      .select('id, recommendation_place_photo_url')
      .ilike('recommendation_place_photo_url', ilikePattern);
    if (beErr) {
      console.warn(`  bandit_event select skipped: ${beErr.message}`);
    } else {
      for (const row of links ?? []) {
        const { error: upErr } = await supabase
          .from('bandit_event')
          .update({ recommendation_place_photo_url: null })
          .eq('id', row.id);
        if (upErr) console.error(`  bandit_event[${row.id}] update FAILED: ${upErr.message}`);
        else {
          console.log(`  bandit_event[${row.id}] recommendation_place_photo_url cleared`);
          totalBanditEventUpdates += 1;
        }
      }
    }
  }

  console.log(
    `\n[done] event rows updated: ${totalEventUpdates}; bandit_event rows updated: ${totalBanditEventUpdates}; spot rows updated: ${totalSpotUpdates}`,
  );
}

main().catch((err) => {
  console.error('[demote-banned-gallery-frames] failed', err);
  process.exit(1);
});
