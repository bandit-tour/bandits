import type { User } from '@supabase/supabase-js';
import Constants from 'expo-constants';

function readPublicEnv(key: string): string | undefined {
  const fromProcess = process.env[key];
  if (typeof fromProcess === 'string' && fromProcess.trim().length > 0) {
    return fromProcess.trim();
  }
  const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
  const fromExtra = extra?.[key];
  if (typeof fromExtra === 'string' && fromExtra.trim().length > 0) {
    return fromExtra.trim();
  }
  return undefined;
}

let cachedAppAdminSet: Set<string> | null = null;

/** Sole Pilot Desk menu owner — always checked directly (not only via env allowlist). */
export const PILOT_DESK_OWNER_EMAIL = 'blonje@gmail.com';

/**
 * Set at build time via `EXPO_PUBLIC_APP_ADMIN_EMAILS` (comma-separated) or
 * `EXPO_PUBLIC_APP_ADMIN_EMAIL`. Emails are compared case-insensitively.
 * If empty, no user is treated as an app admin (all internal routes stay hidden / 404).
 */
export function getAppAdminEmailSet(): Set<string> {
  /**
   * Only cache a **non-empty** allowlist. On web, the first read can run before `expo.extra` is
   * available, producing an empty Set that was cached forever — admin-only routes never showed.
   */
  if (cachedAppAdminSet && cachedAppAdminSet.size > 0) return cachedAppAdminSet;

  const a = readPublicEnv('EXPO_PUBLIC_APP_ADMIN_EMAILS');
  const b = readPublicEnv('EXPO_PUBLIC_APP_ADMIN_EMAIL');
  const parts: string[] = [];
  if (a) {
    for (const seg of a.split(/[,;\n]+/)) {
      if (seg.trim()) parts.push(seg);
    }
  }
  if (b?.trim()) parts.push(b);
  const set = new Set(
    parts.map((x) => x.trim().toLowerCase()).filter((x) => x.length > 0),
  );
  /** Owner is always allowlisted — native preview builds must not depend on env being inlined first. */
  set.add(PILOT_DESK_OWNER_EMAIL.toLowerCase());
  cachedAppAdminSet = set;
  return set;
}

/**
 * OAuth / refresh edge cases: `user.email` can be empty while `user_metadata.email` (or session copy) still holds it.
 * Pilot Desk + delete must use the same resolution or `isAppAdminUser` flips false mid-session.
 */
export function getUserEmailForAdminCheck(
  user:
    | User
    | {
        email?: string | null;
        user_metadata?: Record<string, unknown>;
        identities?: Array<{ identity_data?: Record<string, unknown> }>;
      }
    | null
    | undefined,
): string | null {
  if (!user) return null;
  const direct = String(user.email ?? '').trim();
  if (direct) return direct;
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const fromMeta = meta?.email;
  if (typeof fromMeta === 'string' && fromMeta.trim()) return fromMeta.trim();
  for (const identity of user.identities ?? []) {
    const fromIdentity = identity?.identity_data?.email;
    if (typeof fromIdentity === 'string' && fromIdentity.trim()) return fromIdentity.trim();
  }
  return null;
}

/** No anonymous session, no user without a real email. */
function isNonGuestEmailUser(user: User | { app_metadata?: Record<string, unknown>; email?: string | null } | null | undefined): boolean {
  if (!user) return false;
  if (!getUserEmailForAdminCheck(user)) return false;
  const a = user.app_metadata;
  if (a?.provider === 'anonymous' || a?.is_anonymous === true) return false;
  return true;
}

/**
 * Email allowlist (`EXPO_PUBLIC_APP_ADMIN_EMAILS`): admin panel and Pilot Desk **authorization**.
 * Not used for Hotelier — see `canAccessHotelier`.
 */
export function isAppAdminUser(user: User | { app_metadata?: Record<string, unknown>; email?: string | null } | null | undefined): boolean {
  if (!isNonGuestEmailUser(user as User)) return false;
  const set = getAppAdminEmailSet();
  if (set.size === 0) return false;
  const n = (getUserEmailForAdminCheck(user as User) ?? '').trim().toLowerCase();
  if (!n) return false;
  return set.has(n);
}

/**
 * Menu + Pilot Desk visibility: **blonje@gmail.com only** when signed in (not anonymous).
 * Hard-coded owner email — never tied to operator UUID or env allowlist timing.
 */
export function canShowPilotDeskMenu(
  user: User | { app_metadata?: Record<string, unknown>; email?: string | null } | null | undefined,
): boolean {
  if (!user) return false;
  const a = user.app_metadata as Record<string, unknown> | undefined;
  if (a?.provider === 'anonymous' || a?.is_anonymous === true) return false;
  const email = (getUserEmailForAdminCheck(user as User) ?? '').trim().toLowerCase();
  return email === PILOT_DESK_OWNER_EMAIL.toLowerCase();
}

/** Owner-only private staff tools in Guest Menu (Pilot Desk, CDesk). Same rule as Pilot Desk. */
export function canShowOwnerPrivateMenu(
  user: User | { app_metadata?: Record<string, unknown>; email?: string | null } | null | undefined,
): boolean {
  return canShowPilotDeskMenu(user);
}

/**
 * Hotelier: any normal signed-in account (real email, not Supabase anonymous).
 * Independent of app-admin allowlist and Pilot Desk operator UUID.
 */
export function canAccessHotelier(user: User | { app_metadata?: Record<string, unknown>; email?: string | null } | null | undefined): boolean {
  return isNonGuestEmailUser(user as User);
}

/**
 * Pilot Desk **operator session** (matches Postgres `is_pilot_operator()` intent):
 * - Email must be in `EXPO_PUBLIC_APP_ADMIN_EMAILS` (**app admin**).
 * - `user.id` must equal configured `operator_user_id` (**this login is the pilot inbox account**).
 *
 * **App admin alone is not enough** — two different ideas: “staff email allowlist” vs “this Auth user
 * UUID is the configured operator.” Menu and desk must use the same check; do not show Pilot Desk
 * for admins whose session user id is not the operator UUID.
 */
export function canAccessPilotDesk(
  user: User | { id: string; app_metadata?: Record<string, unknown>; email?: string | null } | null | undefined,
  operatorUserId: string | null,
): boolean {
  if (!operatorUserId || !user?.id) return false;
  if (String(user.id).toLowerCase() !== String(operatorUserId).toLowerCase()) return false;
  return isAppAdminUser(user as User);
}

/**
 * Supabase anonymous session (typical hotel QR / guest web flow). Offer **Staff sign-in** so operators
 * can reach email login without a dead-end guest shell.
 */
export function isAnonymousSupabaseSession(
  user: User | { app_metadata?: Record<string, unknown>; email?: string | null } | null | undefined,
): boolean {
  if (!user) return false;
  const a = user.app_metadata as Record<string, unknown> | undefined;
  return a?.provider === 'anonymous' || a?.is_anonymous === true;
}
