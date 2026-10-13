/**
 * Feature flags — Guest App mirror of @banditour/feature-flags (S0).
 * Expo: set EXPO_PUBLIC_FF_* or map in app.config; defaults all off.
 * ff_ai_auto_send is always false (AI draft/suggest only).
 */

export const FEATURE_FLAG_KEYS = [
  "ff_identity_federation",
  "ff_payments_live",
  "ff_qr_guest_binding",
  "ff_ai_auto_send",
  "ff_bandishop",
  "ff_smart_traveler",
  "ff_bottle_host_os",
  "ff_content_partner_to_guest_sync",
  "ff_orchestra_guest_integration",
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

export const FEATURE_FLAG_DEFAULTS: Record<FeatureFlagKey, boolean> = {
  ff_identity_federation: false,
  /** Workspace Commerce bridge — Guest unlocks via /api/commerce/* */
  ff_payments_live: true,
  ff_qr_guest_binding: false,
  ff_ai_auto_send: false,
  /** Consume Workspace Discover for shop / ST / bottle catalogs */
  ff_bandishop: true,
  ff_smart_traveler: true,
  ff_bottle_host_os: true,
  ff_content_partner_to_guest_sync: true,
  /** Consume Orchestra OS / Partner into existing Guest App screens (GUEST-INT-1.0). */
  ff_orchestra_guest_integration: true,
};

function envMap(): Record<string, string | undefined> {
  // Expo public env + process.env for Node scripts
  const g = globalThis as { process?: { env?: Record<string, string | undefined> } };
  return g.process?.env ?? {};
}

function parseBool(raw: string | undefined): boolean | undefined {
  if (raw === undefined || raw === "") return undefined;
  const v = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(v)) return true;
  if (["0", "false", "no", "off"].includes(v)) return false;
  return undefined;
}

export function isFeatureEnabled(key: FeatureFlagKey): boolean {
  if (key === "ff_ai_auto_send") return false;
  const env = envMap();
  const upper = key.toUpperCase();
  const fromEnv =
    parseBool(env[upper]) ??
    parseBool(env[`EXPO_PUBLIC_${upper}`]);
  if (fromEnv !== undefined) return fromEnv;
  return FEATURE_FLAG_DEFAULTS[key];
}

export function listFeatureFlags(): Array<{ key: FeatureFlagKey; enabled: boolean }> {
  return FEATURE_FLAG_KEYS.map((key) => ({ key, enabled: isFeatureEnabled(key) }));
}
