function validUuid(value) {
  const t = String(value ?? '').trim();
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t) ? t : null
  );
}

function normalizeTokenList(raw) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((t) => String(t || '').trim()).filter(Boolean))];
}

function isMissingPushTableError(err) {
  const msg = String(err?.message || err || '');
  return /user_push_tokens|does not exist|could not find the table/i.test(msg);
}

/** @param {import('@supabase/supabase-js').SupabaseClient} admin */
async function loadTokensFromTable(admin, userId) {
  const { data, error } = await admin.from('user_push_tokens').select('expo_push_token').eq('user_id', userId);
  if (error) {
    if (isMissingPushTableError(error)) return { tokens: [], source: 'table_missing' };
    throw error;
  }
  const tokens = [...new Set((data || []).map((r) => String(r.expo_push_token || '').trim()).filter(Boolean))];
  return { tokens, source: 'table' };
}

/** @param {import('@supabase/supabase-js').SupabaseClient} admin */
async function loadTokensFromAuthMetadata(admin, userId) {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) throw error;
  const meta = (data?.user?.user_metadata || {}) ;
  const tokens = normalizeTokenList(meta.expo_push_tokens);
  return { tokens, source: 'auth_metadata' };
}

/** @param {import('@supabase/supabase-js').SupabaseClient} admin */
async function loadExpoPushTokensForUser(admin, userId) {
  const uid = validUuid(userId);
  if (!uid) return [];

  try {
    const table = await loadTokensFromTable(admin, uid);
    if (table.source !== 'table_missing' && table.tokens.length) return table.tokens;
  } catch (e) {
    console.warn('[pushTokenStore] table read:', e?.message || e);
  }

  try {
    const meta = await loadTokensFromAuthMetadata(admin, uid);
    if (meta.tokens.length) return meta.tokens;
  } catch (e) {
    console.warn('[pushTokenStore] metadata read:', e?.message || e);
  }

  try {
    const table = await loadTokensFromTable(admin, uid);
    return table.tokens;
  } catch {
    return [];
  }
}

/** @param {import('@supabase/supabase-js').SupabaseClient} admin */
async function saveExpoPushToken(admin, userId, expoPushToken, { platform = null, deviceId = null } = {}) {
  const uid = validUuid(userId);
  const token = String(expoPushToken || '').trim();
  if (!uid || !token) return { ok: false, storage: 'invalid' };

  const { error: tableErr } = await admin.from('user_push_tokens').upsert(
    {
      user_id: uid,
      expo_push_token: token,
      platform,
      device_id: deviceId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,expo_push_token' },
  );

  if (!tableErr) return { ok: true, storage: 'table' };
  if (!isMissingPushTableError(tableErr)) {
    console.warn('[pushTokenStore] table upsert:', tableErr.message);
  }

  const { data: userData, error: getErr } = await admin.auth.admin.getUserById(uid);
  if (getErr) return { ok: false, storage: 'auth_metadata_error', error: getErr.message };

  const meta = { ...(userData?.user?.user_metadata || {}) };
  const list = normalizeTokenList(meta.expo_push_tokens);
  if (!list.includes(token)) list.push(token);
  meta.expo_push_tokens = list;
  if (platform) meta.expo_push_platform = platform;
  if (deviceId) meta.expo_push_device_id = deviceId;

  const { error: updErr } = await admin.auth.admin.updateUserById(uid, { user_metadata: meta });
  if (updErr) return { ok: false, storage: 'auth_metadata_error', error: updErr.message };
  return { ok: true, storage: 'auth_metadata' };
}

/** @param {import('@supabase/supabase-js').SupabaseClient} admin */
async function removeExpoPushToken(admin, userId, expoPushToken) {
  const uid = validUuid(userId);
  const token = String(expoPushToken || '').trim();
  if (!uid || !token) return { ok: false };

  const { error: delErr } = await admin.from('user_push_tokens').delete().eq('user_id', uid).eq('expo_push_token', token);
  if (!delErr) return { ok: true, storage: 'table' };
  if (!isMissingPushTableError(delErr)) {
    console.warn('[pushTokenStore] table delete:', delErr.message);
  }

  const { data: userData, error: getErr } = await admin.auth.admin.getUserById(uid);
  if (getErr) return { ok: false, error: getErr.message };
  const meta = { ...(userData?.user?.user_metadata || {}) };
  meta.expo_push_tokens = normalizeTokenList(meta.expo_push_tokens).filter((t) => t !== token);
  const { error: updErr } = await admin.auth.admin.updateUserById(uid, { user_metadata: meta });
  if (updErr) return { ok: false, error: updErr.message };
  return { ok: true, storage: 'auth_metadata' };
}

module.exports = {
  loadExpoPushTokensForUser,
  saveExpoPushToken,
  removeExpoPushToken,
  isMissingPushTableError,
};
