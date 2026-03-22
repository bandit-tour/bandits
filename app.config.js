/**
 * Loads local .env for `expo start` / dev. On EAS Build, set the same keys in
 * Project → Environment variables (or run `npm run eas:sync-env` once).
 * lib/supabase.ts reads process.env first, then expo.extra.
 *
 * If env is missing or still a template (YOUR_*), fall back to the real project
 * values below so release builds are never stuck on placeholders.
 */
require('dotenv').config();

const appJson = require('./app.json');

/** Real Supabase project (public URL + publishable key — same as client bundle). */
const DEFAULT_SUPABASE_URL = 'https://zubcakeamyfqatdmleqx.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'sb_publishable_wOa1OlVmjNdbkcmQt8sPqA_L5civZ2T';

function isPlaceholder(value) {
  if (typeof value !== 'string') return true;
  const t = value.trim();
  if (!t) return true;
  if (/YOUR_PROJECT_REF|YOUR_URL|YOUR_SUPABASE|YOUR_SUPABASE_ANON|placeholder/i.test(t)) {
    return true;
  }
  return false;
}

function resolveSupabaseUrl(value) {
  if (!isPlaceholder(value)) {
    try {
      return new URL(value.trim()).toString().replace(/\/$/, '');
    } catch {
      return DEFAULT_SUPABASE_URL;
    }
  }
  return DEFAULT_SUPABASE_URL;
}

function resolveSupabaseAnon(value) {
  if (!isPlaceholder(value) && typeof value === 'string' && value.trim().length > 20) {
    return value.trim();
  }
  return DEFAULT_SUPABASE_ANON_KEY;
}

const resolvedUrl = resolveSupabaseUrl(process.env.EXPO_PUBLIC_SUPABASE_URL);
const resolvedAnon = resolveSupabaseAnon(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

process.env.EXPO_PUBLIC_SUPABASE_URL = resolvedUrl;
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = resolvedAnon;

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...(appJson.expo.extra || {}),
      EXPO_PUBLIC_SUPABASE_URL: resolvedUrl,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: resolvedAnon,
    },
  },
};
