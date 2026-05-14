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

/** Pilot hotel PWA link (QR, Hotelier, emails). Must match the Vercel project you deploy `npm run build` to. */
/** bandit-tours host is a different Next.js project (404 on /hotel/*). Expo PWA is deployed on bandits-two. */
const DEFAULT_PLAY_GUEST_ENTRY_URL = 'https://bandits-two.vercel.app/hotel/play-theatrou';
function resolvePlayGuestEntryUrl(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw || !/^https:\/\//i.test(raw)) return DEFAULT_PLAY_GUEST_ENTRY_URL;
  try {
    return new URL(raw).toString().replace(/\/$/, '');
  } catch {
    return DEFAULT_PLAY_GUEST_ENTRY_URL;
  }
}

const resolvedPlayGuestEntryUrl = resolvePlayGuestEntryUrl(process.env.EXPO_PUBLIC_PLAY_GUEST_ENTRY_URL);
const DEFAULT_APP_ADMIN_EMAILS = 'blonje@gmail.com';
/** Avishay Ben Eli — pilot operator inbox (Ask Me, Local Friend, Notifications). */
const DEFAULT_OPERATOR_USER_ID = 'e6d8cb02-6f1a-40c0-96c4-b96961878407';
const resolvedAppAdminEmails =
  String(process.env.EXPO_PUBLIC_APP_ADMIN_EMAILS ?? '').trim() || DEFAULT_APP_ADMIN_EMAILS;

function resolveOperatorUserId(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (raw && /^[0-9a-f-]{36}$/i.test(raw)) return raw;
  return DEFAULT_OPERATOR_USER_ID;
}

const resolvedOperatorUserId = resolveOperatorUserId(process.env.EXPO_PUBLIC_OPERATOR_USER_ID);
const resolvedGoogleMapsKey = String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '').trim();

process.env.EXPO_PUBLIC_SUPABASE_URL = resolvedUrl;
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = resolvedAnon;
process.env.EXPO_PUBLIC_PLAY_GUEST_ENTRY_URL = resolvedPlayGuestEntryUrl;
process.env.EXPO_PUBLIC_APP_ADMIN_EMAILS = resolvedAppAdminEmails;
process.env.EXPO_PUBLIC_OPERATOR_USER_ID = resolvedOperatorUserId;

/** Ad Hoc preview profile predates Associated Domains; keep production/TestFlight entitlements intact. */
const buildProfile = process.env.EAS_BUILD_PROFILE;
const iosConfig = { ...(appJson.expo.ios || {}) };
if (buildProfile === 'preview') {
  delete iosConfig.associatedDomains;
}

module.exports = {
  expo: {
    ...appJson.expo,
    ios: iosConfig,
    extra: {
      ...(appJson.expo.extra || {}),
      EXPO_PUBLIC_SUPABASE_URL: resolvedUrl,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: resolvedAnon,
      EXPO_PUBLIC_PLAY_GUEST_ENTRY_URL: resolvedPlayGuestEntryUrl,
      /** Pilot: client-only simulated inbox / Local Friend replies — set EXPO_PUBLIC_DEMO_MODE=true */
      EXPO_PUBLIC_DEMO_MODE: String(process.env.EXPO_PUBLIC_DEMO_MODE ?? '').trim() || 'false',
      /** Operator inbox routing — Avishay (blonje@gmail.com); baked in for EAS when .env is absent. */
      EXPO_PUBLIC_OPERATOR_USER_ID: resolvedOperatorUserId,
      /** Comma-separated admin emails: Admin, Pilot Desk operator allowlist (with operator UUID). Not used for Hotelier. */
      EXPO_PUBLIC_APP_ADMIN_EMAILS: resolvedAppAdminEmails,
      EXPO_PUBLIC_GOOGLE_MAPS_KEY: resolvedGoogleMapsKey,
      googleMapsApiKey: resolvedGoogleMapsKey,
    },
  },
};
