const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const { loadExpoPushTokensForUser } = require('./pushTokenStore');

function validUuid(value) {
  const t = String(value ?? '').trim();
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t) ? t : null
  );
}

/** Rough server badge: unread notification rows (client refines on foreground). */
async function loadApproxBadgeCount(admin, userId) {
  const { count, error } = await admin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) return 1;
  return Math.max(0, Math.min(99, count || 0));
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {{
 *   userId: string;
 *   title: string;
 *   body: string;
 *   data?: Record<string, string>;
 *   badge?: number;
 *   channelId?: string;
 * }} args
 */
async function dispatchExpoPushToUser(admin, args) {
  const userId = validUuid(args.userId);
  if (!userId) return { sent: 0, skipped: 'invalid_user' };

  const tokens = await loadExpoPushTokensForUser(admin, userId);
  if (!tokens.length) return { sent: 0, skipped: 'no_tokens' };

  const badge =
    typeof args.badge === 'number' && Number.isFinite(args.badge)
      ? Math.max(0, Math.min(99, Math.floor(args.badge)))
      : await loadApproxBadgeCount(admin, userId);

  const title = String(args.title || 'bandiTour').trim().slice(0, 120) || 'bandiTour';
  const body = String(args.body || '').trim().slice(0, 240) || 'You have a new update';
  const data = args.data && typeof args.data === 'object' ? args.data : {};
  const channelId = String(args.channelId || 'messages').trim() || 'messages';

  const messages = tokens.map((to) => ({
    to,
    sound: 'default',
    title,
    body,
    badge,
    priority: 'high',
    channelId,
    data: {
      ...data,
      userId,
    },
  }));

  const headers = {
    Accept: 'application/json',
    'Accept-encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
  };
  const accessToken = String(process.env.EXPO_ACCESS_TOKEN || '').trim();
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(messages),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn('[expoPush] send failed:', res.status, json);
      return { sent: 0, skipped: 'expo_http_error' };
    }
    const tickets = Array.isArray(json.data) ? json.data : [];
    const ok = tickets.filter((t) => t && t.status === 'ok').length;
    return { sent: ok, total: tokens.length, badge };
  } catch (e) {
    console.warn('[expoPush] network:', e instanceof Error ? e.message : e);
    return { sent: 0, skipped: 'network_error' };
  }
}

/** Push-worthy notification inserts (bottle + unified chat). */
function pushPayloadForNotificationRow(row) {
  const type = String(row.type || '').trim();
  const rt = String(row.reference_type || '').trim();
  const title = String(row.title || '').trim();
  const message = String(row.message || '').trim();
  const refId = String(row.reference_id || '').trim();

  if (type === 'local_friend_bottle' && rt === 'local_friend_ocean_found') {
    return {
      title: 'Someone found your bottle',
      body: message || 'A traveler discovered your message in a bottle.',
      surface: 'inbox',
      kind: 'bottle_found',
      channelId: 'bottle',
      data: {
        surface: 'inbox',
        kind: 'bottle_found',
        referenceType: rt,
        referenceId: refId,
        floatId: refId,
      },
    };
  }

  if (type === 'local_friend_bottle' && rt === 'local_friend_ocean_claim') {
    return {
      title: 'Message in a bottle',
      body: message || 'A note drifted ashore — open Notifications to discover who sent it.',
      surface: 'inbox',
      kind: 'bottle_claim',
      channelId: 'bottle',
      data: {
        surface: 'inbox',
        kind: 'bottle_claim',
        referenceType: rt,
        referenceId: refId,
        floatId: refId,
      },
    };
  }

  if (type === 'bandit_reply' && rt === 'local_friend_ocean_thread') {
    const author = title && title !== 'You' ? title : 'Traveler';
    return {
      title: author,
      body: message || 'New message in your bottle chat',
      surface: 'chat',
      kind: 'chat_message',
      channelId: 'messages',
      data: {
        surface: 'chat',
        kind: 'chat_message',
        referenceType: rt,
        referenceId: refId,
        floatId: refId,
        notificationTitle: title,
      },
    };
  }

  if (type === 'bandit_reply') {
    const author = title && title !== 'You' ? title : 'bandiTour';
    return {
      title: author,
      body: message || 'New message',
      surface: 'chat',
      kind: 'chat_message',
      channelId: 'messages',
      data: {
        surface: 'chat',
        kind: 'chat_message',
        referenceType: rt,
        referenceId: refId,
        notificationTitle: title,
      },
    };
  }

  if (type === 'local_friend' || type === 'bandit_question' || type === 'pilot_thread_echo') {
    return {
      title: title || 'bandiTour',
      body: message || 'New message',
      surface: 'inbox',
      kind: 'inbox_message',
      channelId: 'messages',
      data: {
        surface: 'inbox',
        kind: 'inbox_message',
        referenceType: rt,
        referenceId: refId,
        notificationTitle: title,
      },
    };
  }

  return null;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {string} userId
 * @param {Record<string, unknown>} notificationRow
 */
async function dispatchPushForNotificationInsert(admin, userId, notificationRow) {
  if (notificationRow.is_read === true) return { sent: 0, skipped: 'read_mirror' };
  const payload = pushPayloadForNotificationRow(notificationRow);
  if (!payload) return { sent: 0, skipped: 'not_push_worthy' };
  return dispatchExpoPushToUser(admin, {
    userId,
    title: payload.title,
    body: payload.body,
    channelId: payload.channelId,
    data: payload.data,
  });
}

module.exports = {
  dispatchExpoPushToUser,
  dispatchPushForNotificationInsert,
  pushPayloadForNotificationRow,
  loadApproxBadgeCount,
};
