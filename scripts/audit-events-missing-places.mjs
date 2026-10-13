/**
 * Global audit: which event rows are currently in a state where the City Guide
 * card will fall back to the neutral initials placeholder (no verified Places
 * gallery hero)?
 *
 * The City Guide hero picker (lib/eventVenueGallery.ts) only accepts URLs that
 * match `isGooglePlacesDerivedPhotoUrl` — i.e. Google Places (New) media URLs,
 * Legacy maps photo URLs, googleusercontent / ggpht. Anything else (Pexels,
 * Unsplash, Wikimedia, picsum) is rejected and the card falls back.
 *
 * Categorize each row:
 *   • OK_PLACES   — gallery[0] is Places-derived → real venue photo on card.
 *   • OK_IMAGE_ONLY — image_url is Places-derived but gallery is empty/non-Places.
 *   • FALLBACK    — no Places-derived url anywhere → card will show INITIALS.
 *   • BROKEN_PARTIAL — has google_place_id but no Places-derived gallery (stale data).
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
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
    if (!value) continue;
    if (String(process.env[key] ?? '').trim() === '') process.env[key] = value;
  }
}

function isPlacesDerived(uri) {
  const t = String(uri ?? '').trim().toLowerCase();
  if (!t) return false;
  if (t.includes('maps.googleapis.com/maps/api/place/photo')) return true;
  if (t.includes('places.googleapis.com/') && t.includes('/media')) return true;
  if (t.includes('googleusercontent.com') || t.includes('ggpht.com')) return true;
  return false;
}

function parseGallery(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((s) => String(s ?? '')).filter(Boolean);
  } catch {
    return String(raw).split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), '.env'));
  loadEnvFile(path.resolve(process.cwd(), '.env.local'));
  const url = String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Paginate to avoid the 1000-row default cap.
  const PAGE = 500;
  let from = 0;
  const all = [];
  while (true) {
    const { data, error } = await supabase
      .from('event')
      .select('id, name, address, neighborhood, city, google_place_id, image_url, image_gallery')
      .order('name', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error('Pagination error:', error.message);
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const buckets = {
    OK_PLACES: [],
    OK_IMAGE_ONLY: [],
    FALLBACK: [],
    BROKEN_PARTIAL: [],
  };
  for (const row of all) {
    const gallery = parseGallery(row.image_gallery);
    const galleryPlaces = gallery.find((u) => isPlacesDerived(u)) ?? null;
    const imgPlaces = isPlacesDerived(row.image_url) ? row.image_url : null;
    if (galleryPlaces) buckets.OK_PLACES.push(row);
    else if (imgPlaces) buckets.OK_IMAGE_ONLY.push(row);
    else if (row.google_place_id) buckets.BROKEN_PARTIAL.push(row);
    else buckets.FALLBACK.push(row);
  }

  console.log(`Total events scanned: ${all.length}`);
  console.log(`  OK_PLACES (gallery has Places photo) : ${buckets.OK_PLACES.length}`);
  console.log(`  OK_IMAGE_ONLY (image_url only)       : ${buckets.OK_IMAGE_ONLY.length}`);
  console.log(`  BROKEN_PARTIAL (has place_id, no Places photo) : ${buckets.BROKEN_PARTIAL.length}`);
  console.log(`  FALLBACK (will render initials)      : ${buckets.FALLBACK.length}\n`);

  if (buckets.BROKEN_PARTIAL.length > 0) {
    console.log('--- BROKEN_PARTIAL (consider refresh) ---');
    for (const r of buckets.BROKEN_PARTIAL.slice(0, 50)) {
      console.log(`  • ${r.name} (${r.id}) | place_id=${r.google_place_id}`);
    }
    if (buckets.BROKEN_PARTIAL.length > 50) {
      console.log(`  … and ${buckets.BROKEN_PARTIAL.length - 50} more`);
    }
    console.log('');
  }

  if (buckets.FALLBACK.length > 0) {
    console.log('--- FALLBACK (will show initials placeholder) ---');
    for (const r of buckets.FALLBACK.slice(0, 50)) {
      console.log(`  • ${r.name} (${r.id}) | ${r.address ?? ''} | ${r.neighborhood ?? ''}`);
    }
    if (buckets.FALLBACK.length > 50) {
      console.log(`  … and ${buckets.FALLBACK.length - 50} more`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
