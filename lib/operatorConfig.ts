import Constants from 'expo-constants';

import { supabase } from '@/lib/supabase';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Same resolution order as `lib/supabase.ts` so EAS `extra` mirrors work when
 * `EXPO_PUBLIC_*` is not inlined into the JS bundle for a given profile.
 */
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

function normalizeOperatorId(raw: string | null | undefined): string | null {
  const v = raw?.trim().toLowerCase() ?? '';
  if (!v || !UUID_RE.test(v)) return null;
  return v;
}

/** Extract UUID from a config row; tolerate schema drift in older DBs. */
export function parseOperatorUserIdFromAppPublicConfigRow(
  row: Record<string, unknown> | null | undefined,
): string | null {
  if (!row) return null;
  const raw =
    row.value ??
    row.config_value ??
    row.val ??
    (typeof row.data === 'object' && row.data !== null
      ? (row.data as Record<string, unknown>).operator_user_id
      : undefined);
  if (typeof raw === 'string') return normalizeOperatorId(raw);
  if (raw != null) return normalizeOperatorId(String(raw));
  return null;
}

/**
 * `undefined` = never successfully resolved from DB yet (transient errors must retry).
 * `{ kind: 'uuid', id }` = resolved operator id.
 * `{ kind: 'none' }` = DB responded OK but no valid operator row (do not hammer).
 */
type OperatorResolveCache =
  | undefined
  | { kind: 'uuid'; id: string }
  | { kind: 'none' };

let resolveCache: OperatorResolveCache;

/** Build-time / `extra` operator id only (does not query DB). */
export function getEnvOperatorUserIdOnly(): string | null {
  return normalizeOperatorId(readPublicEnv('EXPO_PUBLIC_OPERATOR_USER_ID'));
}

/**
 * Uncached read of `app_public_config.operator_user_id` — same source Postgres
 * `is_pilot_operator()` uses. For diagnostics / Pilot Desk debug panel only.
 */
export async function fetchDbOperatorUserIdForDiagnostics(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('app_public_config')
      .select('*')
      .eq('key', 'operator_user_id')
      .maybeSingle();
    if (error) return null;
    return parseOperatorUserIdFromAppPublicConfigRow(data as Record<string, unknown> | null);
  } catch {
    return null;
  }
}

/**
 * Synchronous read: env var, then cache filled by `ensureOperatorUserId()`.
 * Before `ensureOperatorUserId()` runs, returns env only (may be null).
 */
export function getOperatorUserId(): string | null {
  const env = getEnvOperatorUserIdOnly();
  if (env) return env;
  if (resolveCache?.kind === 'uuid') return resolveCache.id;
  return null;
}

/**
 * Resolves operator inbox user id for routing and Pilot Desk.
 *
 * **Order (matches Postgres `is_pilot_operator()`):**
 * 1. `public.app_public_config` row `operator_user_id` (same table/column as SQL)
 * 2. Fallback: `EXPO_PUBLIC_OPERATOR_USER_ID`
 *
 * If env were preferred over DB, the app could show Pilot Desk while DELETE/RPC
 * still failed because SQL only reads the DB value.
 */
export async function ensureOperatorUserId(): Promise<string | null> {
  const env = getEnvOperatorUserIdOnly();

  if (resolveCache?.kind === 'uuid') return resolveCache.id;
  if (resolveCache?.kind === 'none') {
    return env ?? null;
  }

  try {
    const { data, error } = await supabase
      .from('app_public_config')
      .select('*')
      .eq('key', 'operator_user_id')
      .maybeSingle();

    if (error) {
      if (__DEV__) console.warn('[operatorConfig] app_public_config:', error.message);
      if (env) {
        resolveCache = { kind: 'uuid', id: env };
        return env;
      }
      return null;
    }

    const dbId = parseOperatorUserIdFromAppPublicConfigRow(data as Record<string, unknown> | null);
    if (dbId) {
      if (env && env !== dbId && __DEV__) {
        console.warn(
          '[operatorConfig] EXPO_PUBLIC_OPERATOR_USER_ID differs from app_public_config; using DB (matches Postgres).',
        );
      }
      resolveCache = { kind: 'uuid', id: dbId };
      return dbId;
    }

    if (env) {
      resolveCache = { kind: 'uuid', id: env };
      return env;
    }

    resolveCache = { kind: 'none' };
    return null;
  } catch (e) {
    if (__DEV__) console.warn('[operatorConfig]', e);
    if (env) {
      resolveCache = { kind: 'uuid', id: env };
      return env;
    }
    return null;
  }
}
