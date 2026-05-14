import type { User } from '@supabase/supabase-js';

import { canAccessPilotDesk, canShowPilotDeskMenu, getUserEmailForAdminCheck, isAppAdminUser } from '@/lib/appAdminAccess';
import {
  ensureOperatorUserId,
  fetchDbOperatorUserIdForDiagnostics,
  getEnvOperatorUserIdOnly,
} from '@/lib/operatorConfig';
import { supabase } from '@/lib/supabase';

/** Same check for Pilot Desk visibility, verify/hide, and delete — keep in sync with DELETE/RPC expectations (DB-first operator id). */
export function pilotDeskOperatorAuthorized(
  user: User | { id: string; email?: string | null; app_metadata?: Record<string, unknown> } | null | undefined,
  resolvedOperatorId: string | null,
): boolean {
  return canAccessPilotDesk(user, resolvedOperatorId);
}

/**
 * Same identity PostgREST/RPC uses: JWT from the active session (`auth.uid()`).
 * `getUser()` alone can fail transiently on mobile web/Safari while `getSession()` still holds
 * the operator — that made Pilot Desk + RPC work intermittently but `canUsePilotDesk` false on delete.
 */
/** Combine JWT refresh (`getUser`) + local session so `email` is never dropped when one side omits it. */
function mergePilotDeskAuthUser(validated: User | null, fromSession: User | null): User | null {
  if (!validated && !fromSession) return null;
  if (!validated) return fromSession;
  if (!fromSession) return validated;

  const resolvedEmail =
    getUserEmailForAdminCheck(validated) || getUserEmailForAdminCheck(fromSession) || undefined;

  const user_metadata = {
    ...(fromSession.user_metadata ?? {}),
    ...(validated.user_metadata ?? {}),
  } as Record<string, unknown>;
  if (resolvedEmail && typeof user_metadata.email !== 'string') {
    user_metadata.email = resolvedEmail;
  }

  const identities =
    validated.identities && validated.identities.length > 0
      ? validated.identities
      : fromSession.identities;

  return {
    ...fromSession,
    ...validated,
    email: resolvedEmail ?? validated.email ?? fromSession.email,
    user_metadata,
    identities,
  } as User;
}

/**
 * Merged session + `getUser()` — same identity as PostgREST/JWT. Prefer this for menu and any UI
 * that must not flicker on `getUser()`/`getSession()` disagreeing.
 */
export async function resolveSessionUserForPilotDesk(): Promise<{
  user: User | null;
  authError: Error | null;
}> {
  const {
    data: { session: local },
  } = await supabase.auth.getSession();
  const fromSession = local?.user ?? null;

  /** APK fast path: trust persisted session email — skip flaky `getUser()` round-trip on native. */
  if (fromSession && getUserEmailForAdminCheck(fromSession)) {
    return { user: fromSession, authError: null };
  }

  const {
    data: { user: validated },
    error: getUserErr,
  } = await supabase.auth.getUser();

  const user = mergePilotDeskAuthUser(validated ?? null, fromSession);
  if (user) {
    return { user, authError: null };
  }
  return {
    user: null,
    authError: getUserErr ?? new Error('No signed-in user.'),
  };
}

/**
 * Single async snapshot for Menu and Pilot Desk screen. (`pilotDeleteScamAlert` does not re-run this —
 * it relies on this screen’s gate + Postgres `delete_scam_alert_if_operator`.)
 * `canUsePilotDesk === true` iff `canAccessPilotDesk` (admin email + session user id === operator_user_id).
 */
export async function resolvePilotDeskAccess(): Promise<{
  operatorId: string | null;
  user: User | null;
  canUsePilotDesk: boolean;
  isAppAdmin: boolean;
  showPilotDesk: boolean;
  authError: Error | null;
}> {
  const operatorId = await ensureOperatorUserId();
  const { user, authError } = await resolveSessionUserForPilotDesk();
  const isAppAdmin = isAppAdminUser(user);
  const canUsePilotDesk = canAccessPilotDesk(user, operatorId);
  const showPilotDesk = canShowPilotDeskMenu(user);
  return { operatorId, user, canUsePilotDesk, isAppAdmin, showPilotDesk, authError };
}

/**
 * Menu / light UI: merged user + admin email check only. Does **not** call `ensureOperatorUserId()`
 * (avoids extra async + config churn on every menu open).
 */
export async function resolveMenuAuthSnapshot(): Promise<{
  user: User | null;
  isAppAdmin: boolean;
  showPilotDesk: boolean;
  authError: Error | null;
}> {
  const { user, authError } = await resolveSessionUserForPilotDesk();
  return {
    user,
    isAppAdmin: isAppAdminUser(user),
    showPilotDesk: canShowPilotDeskMenu(user),
    authError,
  };
}

function pilotDeskAccessExplanation(
  user: User | null,
  operatorId: string | null,
  isAppAdmin: boolean,
  canUsePilotDesk: boolean,
): string {
  if (!user) return 'No signed-in user.';
  if (!isAppAdmin) return 'Email is not in EXPO_PUBLIC_APP_ADMIN_EMAILS (not app admin).';
  if (!operatorId) return 'operator_user_id missing from DB/env — configure app_public_config or EXPO_PUBLIC_OPERATOR_USER_ID.';
  if (String(user.id).toLowerCase() !== String(operatorId).toLowerCase()) {
    return 'App admin, but this session user id ≠ operator_user_id. Sign in as the pilot operator Auth account, or update operator_user_id to this user id.';
  }
  if (canUsePilotDesk) return 'Pilot operator (admin + session matches operator_user_id).';
  return 'Access denied.';
}

/**
 * Temporary: Pilot Desk + delete authorization debug (remove after prod verification).
 * Fields mirror what we need to prove client gate matches DB-backed DELETE/RPC.
 */
export type PilotDeskAuthDebugSnapshot = {
  email: string | null;
  userId: string | null;
  /** Same id used for `canAccessPilotDesk` / delete gate (`ensureOperatorUserId`, DB-first). */
  resolvedOperatorId: string | null;
  envOperatorId: string | null;
  dbOperatorId: string | null;
  envDbMismatch: boolean;
  isAppAdmin: boolean;
  canAccessPilotDesk: boolean;
  /** Intentionally identical to `canAccessPilotDesk` until a separate rule is required. */
  canDeleteReports: boolean;
  /** Human-readable: admin vs pilot-operator vs id mismatch. */
  accessExplanation: string;
};

/**
 * Single evaluation used by Pilot Desk screen load — includes DB vs env lines for debug.
 */
export async function evaluatePilotDeskOperatorGate(): Promise<{
  user: User | null;
  resolvedOperatorId: string | null;
  snap: PilotDeskAuthDebugSnapshot;
}> {
  const { operatorId: resolvedOperatorId, user, canUsePilotDesk, isAppAdmin } = await resolvePilotDeskAccess();
  const envOperatorId = getEnvOperatorUserIdOnly();
  const dbOperatorId = await fetchDbOperatorUserIdForDiagnostics();
  const envDbMismatch = !!(envOperatorId && dbOperatorId && envOperatorId !== dbOperatorId);
  const accessExplanation = pilotDeskAccessExplanation(user, resolvedOperatorId, isAppAdmin, canUsePilotDesk);

  const snap: PilotDeskAuthDebugSnapshot = {
    email: user?.email ?? null,
    userId: user?.id ?? null,
    resolvedOperatorId,
    envOperatorId,
    dbOperatorId,
    envDbMismatch,
    isAppAdmin,
    canAccessPilotDesk: canUsePilotDesk,
    canDeleteReports: canUsePilotDesk,
    accessExplanation,
  };

  return { user, resolvedOperatorId, snap };
}
