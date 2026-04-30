import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from '@/lib/database.types';
import { normalizeDisplayName, validateDisplayName } from '@/lib/displayName';
import { assignInitialSignalIfNeeded } from '@/lib/signalRotation';
import { resolveMenuAuthSnapshot } from '@/lib/pilotDeskGate';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const USER_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function logSupabaseError(
  scope: string,
  err: { message?: string; code?: string; details?: string; hint?: string } | null | undefined,
) {
  if (!err) return;
  console.error(
    `[user_profile:${scope}]`,
    JSON.stringify({ message: err.message, code: err.code, details: err.details, hint: err.hint }),
  );
}

function userFacingDbMessage(err: { message?: string; hint?: string }): string {
  const parts = [err.message, err.hint].filter(Boolean);
  return parts.join(parts.length > 1 ? '\n' : '') || 'Could not save display name.';
}

/** True only when the table itself is genuinely missing on the server. */
export function isUserProfileUnavailableError(
  err: { message?: string; code?: string } | null | undefined,
): boolean {
  if (!err) return false;
  if (err.code === '42P01') return true;
  const m = String(err.message || '').toLowerCase();
  if (m.includes('relation') && m.includes('user_profile') && m.includes('does not exist')) return true;
  if (m.includes('user_profile') && m.includes('does not exist')) return true;
  return false;
}

export const displayNameSoftDismissStorageKey = (userId: string) =>
  `@bandits_display_name_soft_dismiss_v1:${userId}`;

/**
 * Build a minimal `auth.updateUser({ data })` payload. GoTrue **shallow-merges** this into server metadata,
 * so we must not spread the whole client `user_metadata` (nested values / oversized payloads break saves).
 * @param _existing reserved for callers; merge is server-side.
 */
export function shallowAuthMetadataForUpdate(
  _existing: Record<string, unknown> | null | undefined,
  patch: Record<string, string | number | boolean | null | undefined>,
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (v === null) {
      out[k] = null;
      continue;
    }
    const t = typeof v;
    if (t === 'string' || t === 'number' || t === 'boolean') {
      out[k] = v as string | number | boolean;
    }
  }
  return out;
}

/**
 * GoTrue can reject `updateUser` if local session user_metadata is stale (common on web).
 * `getUser()` re-validates with the server; we retry once after `refreshSession()`.
 */
async function patchAuthUserMetadata(
  userId: string,
  patch: Record<string, string | number | boolean | null | undefined>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const {
    data: { user: u1 },
    error: e1,
  } = await supabase.auth.getUser();
  if (e1) {
    logSupabaseError('patchAuthUserMetadata_getUser_1', e1);
    return { ok: false, message: e1.message || 'Could not verify your account. Please refresh and try again.' };
  }
  if (!u1?.id || u1.id !== userId) {
    console.error('[patchAuthUserMetadata] user_mismatch', JSON.stringify({ expected: userId, got: u1?.id }));
    return { ok: false, message: 'You are not signed in. Please refresh and try again.' };
  }
  let authUser = u1;
  const run = () =>
    supabase.auth.updateUser({
      data: shallowAuthMetadataForUpdate(authUser.user_metadata as Record<string, unknown>, patch),
    });
  let { error: metaErr } = await run();
  if (metaErr) {
    logSupabaseError('patchAuthUserMetadata_update_1', metaErr);
    await refreshClientAuthSession();
    const {
      data: { user: u2 },
      error: e2,
    } = await supabase.auth.getUser();
    if (e2) {
      logSupabaseError('patchAuthUserMetadata_getUser_2', e2);
    }
    if (!u2?.id || u2.id !== userId) {
      return { ok: false, message: 'Session sync failed. Your profile row may be saved. Pull to refresh, then try Save again.' };
    }
    authUser = u2;
    metaErr = (await run()).error;
  }
  if (metaErr) {
    logSupabaseError('patchAuthUserMetadata_update_2', metaErr);
    return { ok: false, message: metaErr.message || 'Account sync failed. Try Save again in a moment.' };
  }
  return { ok: true };
}

/**
 * Public helper for profile photo and other call sites that only need metadata sync with retry.
 */
export async function updateAuthUserMetadataFields(
  userId: string,
  fields: Record<string, string | number | boolean | null | undefined>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isSupabaseConfigured()) return { ok: false, message: 'App is not connected.' };
  return patchAuthUserMetadata(userId, fields);
}

/**
 * After `updateUser` / profile row writes, local session metadata can be stale; refresh so the
 * next `getSession()` and UI reload see avatar/name/city.
 */
export async function refreshClientAuthSession(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase.auth.refreshSession();
  if (error && __DEV__) {
    console.warn('[user_profile:refreshClientAuthSession]', error.message);
  }
}

type UserProfileInsert = Database['public']['Tables']['user_profile']['Insert'];

export const QUICK_PROFILE_INTERESTS = [
  'Wine & Bars',
  'Cafes',
  'Art',
  'Vintage',
  'Street Food',
  'Nightlife',
  'Music',
  'Design',
] as const;

export type QuickProfileInterest = (typeof QUICK_PROFILE_INTERESTS)[number];

export type UserProfileRow = {
  id: string;
  name: string;
  interests: string[];
  city: string;
  location_permission: boolean;
  hotel_id: string | null;
  entry_source: string | null;
  created_at: string;
  updated_at: string;
};

export async function hasCompletedQuickProfile(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { data, error } = await supabase.from('user_profile').select('id').eq('id', userId).maybeSingle();
    if (error) return false;
    return !!data;
  } catch {
    return false;
  }
}

export type UpsertQuickProfileInput = {
  name: string;
  interests: string[];
  city: string;
  locationPermission: boolean;
  hotelId: string | null;
  entrySource: string | null;
};

export async function upsertQuickProfile(input: UpsertQuickProfileInput): Promise<void> {
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr) throw new Error(authErr.message || 'Not signed in.');
  if (!user) throw new Error('Sign in to save your profile.');

  const row: UserProfileInsert = {
    id: user.id,
    name: input.name.trim(),
    interests: input.interests,
    city: input.city.trim(),
    location_permission: input.locationPermission,
    hotel_id: input.hotelId,
    entry_source: input.entrySource,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('user_profile').upsert([row], {
    onConflict: 'id',
    defaultToNull: false,
  } as { onConflict: string; defaultToNull?: boolean });
  if (error) throw new Error(error.message || 'Could not save profile.');
  void assignInitialSignalIfNeeded(user.id);
}

/**
 * Home display-name gate: verify session user id, read row, then update or insert (never a blind partial upsert).
 */
export async function persistUserDisplayName(args: {
  userId: string;
  rawDisplayName: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isSupabaseConfigured()) return { ok: false, message: 'App is not connected.' };
  const userId = String(args.userId || '').trim();
  if (!USER_ID_RE.test(userId)) {
    console.error('[persistUserDisplayName] invalid_user_id', JSON.stringify({ userId }));
    return { ok: false, message: 'Invalid account state. Please refresh the app.' };
  }

  const normalized = normalizeDisplayName(args.rawDisplayName);
  const validation = validateDisplayName(normalized);
  if (validation) return { ok: false, message: validation };

  const {
    data: { user: sessionUser },
    error: getUserErr,
  } = await supabase.auth.getUser();
  if (getUserErr) {
    logSupabaseError('getUser', getUserErr);
    return { ok: false, message: getUserErr.message || 'Could not verify your account.' };
  }
  if (!sessionUser?.id) {
    console.error('[persistUserDisplayName] no_session_user');
    return { ok: false, message: 'You are not signed in. Please refresh and try again.' };
  }
  if (sessionUser.id !== userId) {
    console.error(
      '[persistUserDisplayName] session_user_mismatch',
      JSON.stringify({ pathUserId: userId, sessionUserId: sessionUser.id }),
    );
    return { ok: false, message: 'Session mismatch. Please refresh and try again.' };
  }

  const { data: existing, error: selErr } = await supabase.from('user_profile').select('id').eq('id', userId).maybeSingle();
  if (selErr) {
    logSupabaseError('select_profile', selErr);
    if (isUserProfileUnavailableError(selErr)) {
      const metaOnly = await patchAuthUserMetadata(userId, {
        full_name: normalized,
        name: normalized,
      });
      if (!metaOnly.ok) return metaOnly;
      await refreshClientAuthSession();
      return { ok: true };
    }
    return { ok: false, message: userFacingDbMessage(selErr) };
  }

  const now = new Date().toISOString();

  if (existing?.id) {
    const { error: updErr } = await supabase
      .from('user_profile')
      .update({ name: normalized, updated_at: now })
      .eq('id', userId);
    if (updErr) {
      logSupabaseError('update_name', updErr);
      if (isUserProfileUnavailableError(updErr)) {
        const metaOnly = await patchAuthUserMetadata(userId, {
          full_name: normalized,
          name: normalized,
        });
        if (!metaOnly.ok) return metaOnly;
        await refreshClientAuthSession();
        return { ok: true };
      }
      return { ok: false, message: userFacingDbMessage(updErr) };
    }
  } else {
    const { error: insErr } = await supabase.from('user_profile').insert({
      id: userId,
      name: normalized,
      interests: [],
      city: 'Athens',
      location_permission: false,
      updated_at: now,
    });
    if (insErr) {
      logSupabaseError('insert_profile', insErr);
      if (isUserProfileUnavailableError(insErr)) {
        const metaOnly = await patchAuthUserMetadata(userId, {
          full_name: normalized,
          name: normalized,
        });
        if (!metaOnly.ok) return metaOnly;
        await refreshClientAuthSession();
        return { ok: true };
      }
      if (insErr.code === '23505') {
        const { error: updErr2 } = await supabase
          .from('user_profile')
          .update({ name: normalized, updated_at: now })
          .eq('id', userId);
        if (updErr2) {
          logSupabaseError('update_after_insert_race', updErr2);
          if (isUserProfileUnavailableError(updErr2)) {
            const metaOnly = await patchAuthUserMetadata(userId, {
              full_name: normalized,
              name: normalized,
            });
            if (!metaOnly.ok) return metaOnly;
            await refreshClientAuthSession();
            return { ok: true };
          }
          return { ok: false, message: userFacingDbMessage(updErr2) };
        }
      } else {
        return { ok: false, message: userFacingDbMessage(insErr) };
      }
    }
  }

  const meta = await patchAuthUserMetadata(userId, {
    full_name: normalized,
    name: normalized,
  });
  if (!meta.ok) return meta;

  try {
    await AsyncStorage.removeItem(displayNameSoftDismissStorageKey(userId));
  } catch {
    /* ignore */
  }

  await refreshClientAuthSession();
  return { ok: true };
}

export type PersistUserProfileIdentityInput = {
  userId: string;
  displayName: string;
  city: string;
  vibeLine: string;
  userMetadata: Record<string, unknown>;
};

/**
 * Profile screen: name + city in `user_profile`, vibe line in auth metadata.
 * One `getUser`, then select → update or insert (no bare partial upsert).
 */
export async function persistUserProfileIdentity(
  input: PersistUserProfileIdentityInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isSupabaseConfigured()) return { ok: false, message: 'App is not connected.' };
  const userId = String(input.userId || '').trim();
  if (!USER_ID_RE.test(userId)) {
    console.error('[persistUserProfileIdentity] invalid_user_id', JSON.stringify({ userId }));
    return { ok: false, message: 'Invalid account state. Please refresh the app.' };
  }

  const normalizedName = normalizeDisplayName(input.displayName);
  const nameValidation = validateDisplayName(normalizedName);
  if (nameValidation) return { ok: false, message: nameValidation };

  const cityValue = String(input.city || '').trim() || 'Athens';
  const vibeValue = String(input.vibeLine || '').trim();

  const {
    data: { user: sessionUser },
    error: getUserErr,
  } = await supabase.auth.getUser();
  if (getUserErr) {
    logSupabaseError('persist_identity_getUser', getUserErr);
    return { ok: false, message: getUserErr.message || 'Could not verify your account.' };
  }
  if (!sessionUser?.id || sessionUser.id !== userId) {
    console.error(
      '[persistUserProfileIdentity] user_mismatch',
      JSON.stringify({ expected: userId, session: sessionUser?.id }),
    );
    return { ok: false, message: 'You are not signed in. Please refresh and try again.' };
  }

  const { data: existing, error: selErr } = await supabase
    .from('user_profile')
    .select('id, interests, location_permission, hotel_id, entry_source, avatar_url')
    .eq('id', userId)
    .maybeSingle();

  if (selErr) {
    logSupabaseError('persist_identity_select', selErr);
    if (isUserProfileUnavailableError(selErr)) {
      const metaOnly = await patchAuthUserMetadata(userId, {
        vibe_line: vibeValue,
        full_name: normalizedName,
        name: normalizedName,
        city: cityValue,
      });
      if (!metaOnly.ok) return metaOnly;
      await refreshClientAuthSession();
      return { ok: true };
    }
    return { ok: false, message: userFacingDbMessage(selErr) };
  }

  const now = new Date().toISOString();
  const interests = Array.isArray((existing as any)?.interests) ? (existing as any).interests : [];
  const location_permission =
    typeof (existing as any)?.location_permission === 'boolean' ? (existing as any).location_permission : false;
  const hotel_id = (existing as any)?.hotel_id ?? null;
  const entry_source = (existing as any)?.entry_source ?? null;
  const avatar_url = (existing as any)?.avatar_url ?? null;

  if (existing?.id) {
    const { error: updErr } = await supabase
      .from('user_profile')
      .update({
        name: normalizedName,
        city: cityValue,
        updated_at: now,
      })
      .eq('id', userId);
    if (updErr) {
      logSupabaseError('persist_identity_update', updErr);
      if (isUserProfileUnavailableError(updErr)) {
        const metaOnly = await patchAuthUserMetadata(userId, {
          vibe_line: vibeValue,
          full_name: normalizedName,
          name: normalizedName,
          city: cityValue,
        });
        if (!metaOnly.ok) return metaOnly;
        await refreshClientAuthSession();
        return { ok: true };
      }
      return { ok: false, message: userFacingDbMessage(updErr) };
    }
  } else {
    const { error: insErr } = await supabase.from('user_profile').insert({
      id: userId,
      name: normalizedName,
      city: cityValue,
      interests,
      location_permission,
      hotel_id,
      entry_source,
      avatar_url,
      updated_at: now,
    });
    if (insErr) {
      logSupabaseError('persist_identity_insert', insErr);
      if (isUserProfileUnavailableError(insErr)) {
        const metaOnly = await patchAuthUserMetadata(userId, {
          vibe_line: vibeValue,
          full_name: normalizedName,
          name: normalizedName,
          city: cityValue,
        });
        if (!metaOnly.ok) return metaOnly;
        await refreshClientAuthSession();
        return { ok: true };
      }
      if (insErr.code === '23505') {
        const { error: updErr2 } = await supabase
          .from('user_profile')
          .update({
            name: normalizedName,
            city: cityValue,
            updated_at: now,
          })
          .eq('id', userId);
        if (updErr2) {
          logSupabaseError('persist_identity_update_after_race', updErr2);
          return { ok: false, message: userFacingDbMessage(updErr2) };
        }
      } else {
        return { ok: false, message: userFacingDbMessage(insErr) };
      }
    }
  }

  const meta = await patchAuthUserMetadata(userId, {
    vibe_line: vibeValue,
    full_name: normalizedName,
    name: normalizedName,
  });
  if (!meta.ok) return meta;

  try {
    await AsyncStorage.removeItem(displayNameSoftDismissStorageKey(userId));
  } catch {
    /* ignore */
  }

  await refreshClientAuthSession();
  return { ok: true };
}

/**
 * Safe in-app path only (no protocol, no open redirects). Used for ?redirect= after login.
 */
export function normalizePostAuthRedirect(input: string | undefined | null): string | null {
  if (input == null) return null;
  const s = typeof input === 'string' ? input.trim() : '';
  if (!s.startsWith('/')) return null;
  if (s.startsWith('//')) return null;
  if (s.includes('..') || s.includes('\\')) return null;
  const pathOnly = s.split('?')[0]?.split('#')[0] ?? '';
  if (!pathOnly || pathOnly === '/') return null;
  // Never allow operator/admin surfaces through query redirects (those routes enforce their own gates).
  if (pathOnly === '/operatorDesk' || pathOnly === '/admin') return null;
  return pathOnly;
}

/**
 * After email/OAuth sign-in: optional `redirectPath` wins (e.g. `/hotelier`); else app admins → Pilot Desk; else Home.
 */
export async function navigateAfterAuth(router: unknown, redirectPath?: string | null): Promise<void> {
  const r = router as { replace: (href: string) => void };
  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    r.replace('/bandits');
    return;
  }
  if (!data?.session?.user) {
    r.replace('/bandits');
    return;
  }
  const safe = normalizePostAuthRedirect(redirectPath ?? null);
  if (safe) {
    r.replace(safe);
    return;
  }
  const { isAppAdmin } = await resolveMenuAuthSnapshot();
  if (isAppAdmin) {
    r.replace('/operatorDesk');
    return;
  }
  r.replace('/bandits');
}
