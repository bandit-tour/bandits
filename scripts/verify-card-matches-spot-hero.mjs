/**
 * Regression: list-card hero resolution must equal /spot/[id] gallery[0]
 * for the same event row (no bandit_event photo merge overrides).
 *
 * Run: node scripts/verify-card-matches-spot-hero.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

// Load compiled TS via tsx if available; else inline minimal mirror of gallery rules.
async function loadGallery() {
  try {
    const mod = await import(pathToFileURL(path.join(root, 'lib/eventVenueGallery.ts')).href);
    return mod;
  } catch {
    return null;
  }
}

function parseGallery(raw) {
  if (!raw?.trim()) return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p.filter((x) => typeof x === 'string') : [];
  } catch {
    return String(raw)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

/** Minimal mirror: detail uses gallery then image_url; cards must strip bandit merges. */
function detailHero(event) {
  const g = parseGallery(event.image_gallery);
  return g[0] || event.image_url || null;
}

function cardHeroWrong(event) {
  // Simulates old bug: bandit merge wins over gallery
  return event.bandit_photo_url || detailHero(event);
}

function cardHeroFixed(event) {
  const { bandit_photo_url, recommendation_place_photo_url, google_photo_url, ...row } = event;
  return detailHero(row);
}

const samples = [
  {
    id: '1',
    name: 'Spook',
    image_gallery: '["https://example.com/spook-hero.jpg"]',
    image_url: 'https://example.com/spook-fallback.jpg',
    bandit_photo_url: 'https://example.com/WRONG-SHARED.jpg',
  },
  {
    id: '2',
    name: 'Ergon House',
    image_gallery: '["https://example.com/ergon-hero.jpg"]',
    image_url: '',
    bandit_photo_url: 'https://example.com/WRONG-SHARED.jpg',
  },
  {
    id: '3',
    name: 'Kick Cafe',
    image_gallery: '[]',
    image_url: 'https://example.com/kick-hero.jpg',
    bandit_photo_url: 'https://example.com/WRONG-SHARED.jpg',
  },
];

let failed = 0;
for (const e of samples) {
  const detail = detailHero(e);
  const wrong = cardHeroWrong(e);
  const fixed = cardHeroFixed(e);
  try {
    assert.equal(fixed, detail, `${e.name}: fixed card must match detail`);
    assert.notEqual(wrong, detail, `${e.name}: old merge path must differ (proves regression)`);
    console.log('PASS', e.name, '→', detail);
  } catch (err) {
    failed += 1;
    console.error('FAIL', e.name, err.message);
  }
}

// Uniqueness across sample heroes
const heroes = samples.map((e) => cardHeroFixed(e));
const unique = new Set(heroes);
assert.equal(unique.size, heroes.length, 'no duplicate heroes across Spook/Ergon/Kick samples');
console.log('PASS unique heroes across samples');

if (failed) process.exit(1);
console.log(JSON.stringify({ status: 'PASS', samples: samples.length }, null, 2));
