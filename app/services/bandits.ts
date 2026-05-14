import {
  BANDIT_QUESTION_GUEST_ECHO_REF,
  buildAskMeNotificationMessage,
  travelerNameForAskMeTitle,
} from '@/lib/askMeMessageFormat';
import { Database } from '@/lib/database.types';
import { trackEvent } from '@/lib/analytics';
import { ensureOperatorUserId } from '@/lib/operatorConfig';
import { ensureAnonymousSession } from '@/lib/pilotSession';
import { insertGuestEchoViaApi } from '@/lib/guestNotificationEchoApi';
import {
  deliverOperatorMessage,
  shouldRequireOperatorMessageApi,
} from '@/lib/operatorMessageDelivery';
import { requestNotificationsRefresh } from '@/lib/notificationEvents';
import { userFacingMessagingError } from '@/lib/userFacingMessagingError';
import { isPersistenceBlocked } from '@/services/localFriend';
import { isAuthOrMissingError } from '@/lib/postgrestAuth';
import { supabase } from '@/lib/supabase';

type Bandit = Database['public']['Tables']['bandit']['Row'];
type BanditInsert = Database['public']['Tables']['bandit']['Insert'];
type BanditUpdate = Database['public']['Tables']['bandit']['Update'];

function createClientUuid(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (c?.randomUUID) return c.randomUUID();
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${s4()}${s4()}-${s4()}-4${s4().slice(0, 3)}-${((8 + Math.floor(Math.random() * 4)).toString(16) + s4().slice(0, 3))}-${s4()}${s4()}${s4()}`;
}

function isAskTargetBanditIdMissingColumnError(error: { message?: string }): boolean {
  const msg = String(error.message ?? '').toLowerCase();
  return msg.includes('ask_target_bandit_id') && (msg.includes('schema cache') || msg.includes('column'));
}

export async function getBandits(): Promise<Bandit[]> {
  const { data, error } = await supabase
    .from('bandit')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching bandits:', error);
    throw error;
  }

  return data || [];
}

/** Liked bandits for a known user id — no `auth.getUser()` (avoids token-lock races with AppState). */
export async function getUserLikedBanditIdsForUser(userId: string): Promise<Set<string>> {
  const uid = String(userId || '').trim();
  if (!uid) return new Set();
  const { data, error } = await supabase.from('bandit_user_likes').select('bandit_id').eq('user_id', uid);
  if (error) {
    if (isAuthOrMissingError(error)) {
      return new Set();
    }
    console.error('Error fetching user liked bandit IDs:', error);
    throw error;
  }
  return new Set(data?.map((item: any) => item.bandit_id) || []);
}

// additional function included to deal with the tags connection with the bandits fetch as well, i didnt remove the previous method, just in case.
export async function getBanditsWithTags(opts?: { userId?: string | null }) {
  const uid = opts?.userId != null ? String(opts.userId).trim() : '';
  const likedIds = uid ? await getUserLikedBanditIdsForUser(uid) : await getUserLikedBanditIds();
  const { data, error } = await supabase
    .from('bandit')
    .select(`
      *,
      bandit_tags (
        tags (
          id,
          name
        )
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching bandits:', error);
    throw error;
  }

  return ((data || []) as any[]).map((row) => ({
    ...row,
    is_liked: likedIds.has(row.id),
  }));
}

/** Bandits the current user follows (same rows as `bandit_user_likes` + `toggleBanditLike`), with tags. */
export async function getFollowedBanditsWithTags(opts?: { userId?: string | null }) {
  const uid = opts?.userId != null ? String(opts.userId).trim() : '';
  const likedIds = uid ? await getUserLikedBanditIdsForUser(uid) : await getUserLikedBanditIds();
  if (likedIds.size === 0) return [];

  const ids = Array.from(likedIds);
  const { data, error } = await supabase
    .from('bandit')
    .select(`
      *,
      bandit_tags (
        tags (
          id,
          name
        )
      )
    `)
    .in('id', ids)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching followed bandits:', error);
    throw error;
  }

  return ((data || []) as any[]).map((row) => ({
    ...row,
    is_liked: true,
  }));
}

export async function toggleBanditLike(
  id: string,
  currentLikeStatus: boolean,
  /** When provided, skips `getUser()` so Home/Profile flows do not race the auth mutex. */
  userId?: string | null,
): Promise<void> {
  let uid = userId != null ? String(userId).trim() : '';
  if (!uid) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) {
      console.error('Error getting current user for bandit like:', userError);
      throw userError;
    }
    if (!user) {
      throw new Error('User not authenticated');
    }
    uid = user.id;
  }

  if (currentLikeStatus) {
    // Remove like for this user/bandit pair
    const { error } = await supabase
      .from('bandit_user_likes')
      .delete()
      .eq('user_id', uid)
      .eq('bandit_id', id);

    if (error) {
      console.error('Error removing bandit like:', error);
      throw error;
    }
  } else {
    // Add like for this user/bandit pair
    const { error } = await supabase.from('bandit_user_likes').insert({
      user_id: uid,
      bandit_id: id,
    });

    if (error) {
      console.error('Error adding bandit like:', error);
      throw error;
    }
  }
}

export async function getUniqueCities(): Promise<string[]> {
  const { data, error } = await supabase
    .from('event')
    .select('city')
    .not('city', 'is', null)
    .not('city', 'eq', '');

  if (error) {
    console.error('Error fetching cities:', error);
    throw error;
  }

  const cities = [...new Set(data?.map(item => item.city) || [])];
  return cities.sort();
}

export async function updateBandit(id: string, updates: BanditUpdate): Promise<Bandit> {
  const { data, error } = await supabase
    .from('bandit')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating bandit:', error);
    throw error;
  }

  return data;
}

export async function createBandit(bandit: BanditInsert): Promise<Bandit> {
  const { data, error } = await supabase
    .from('bandit')
    .insert(bandit)
    .select()
    .single();

  if (error) {
    console.error('Error creating bandit:', error);
    throw error;
  }

  return data;
}

export async function deleteBandit(id: string): Promise<void> {
  const { error } = await supabase
    .from('bandit')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting bandit:', error);
    throw error;
  }
}

export async function getBanditById(id: string, forUserId?: string | null): Promise<Bandit | null> {
  const uid = forUserId != null ? String(forUserId).trim() : '';
  const likedIds = uid ? await getUserLikedBanditIdsForUser(uid) : await getUserLikedBanditIds();
  const { data, error } = await supabase
    .from('bandit')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching bandit:', error);
    throw error;
  }

  if (!data) return null;
  return {
    ...data,
    is_liked: likedIds.has(data.id),
  };
}

export async function getBanditTags(banditId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('bandit_tags')
    .select(`
      tags (
        name
      )
    `)
    .eq('bandit_id', banditId);

  if (error) {
    console.error('Error fetching bandit tags:', error);
    throw error;
  }

  return (
    data
      ?.map((row: any) => row.tags?.name)
      .filter(Boolean) || []
  );
}

// Get all liked bandit IDs for current user (efficient for bulk checking)
export async function getUserLikedBanditIds(): Promise<Set<string>> {
  // Use getSession, not getUser: guest / cold-start can surface AuthSessionMissingError and break Home load.
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.user) {
    return new Set();
  }
  const user = session.user;

  const { data, error } = await supabase
    .from('bandit_user_likes')
    .select('bandit_id')
    .eq('user_id', user.id);

  if (error) {
    if (isAuthOrMissingError(error)) {
      return new Set();
    }
    console.error('Error fetching user liked bandit IDs:', error);
    throw error;
  }

  return new Set(data?.map((item: any) => item.bandit_id) || []);
}

export async function submitBanditQuestion(banditId: string, question: string): Promise<void> {
  const targetBanditId = String(banditId || '').trim();
  const text = question.trim();
  if (!targetBanditId) throw new Error('Bandit target is required.');
  if (!text) throw new Error('Question is required.');

  await ensureAnonymousSession();

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw userFacingMessagingError(sessionError);
  const user = session?.user;
  if (!user) throw userFacingMessagingError(new Error('Session required.'));

  /** Must match `notifications_insert_routed` (uses same id as Postgres `app_public_config.operator_user_id`). */
  const operatorUserId = await ensureOperatorUserId();
  if (!operatorUserId) {
    throw new Error('Operator inbox is not configured. Set operator_user_id in app_public_config or EXPO_PUBLIC_OPERATOR_USER_ID.');
  }

  const { data: banditRow } = await supabase
    .from('bandit')
    .select('id, name')
    .eq('id', targetBanditId)
    .maybeSingle();
  const fetchedBanditId = String((banditRow as { id?: string } | null)?.id || '').trim();
  if (!fetchedBanditId || fetchedBanditId !== targetBanditId) {
    throw new Error('Selected bandit is out of date. Please reopen the profile and try again.');
  }
  const banditName = String((banditRow as { name?: string } | null)?.name || 'banDit').trim() || 'banDit';
  const { data: prof } = await supabase.from('user_profile').select('name').eq('id', user.id).maybeSingle();
  const fromProfile = String((prof as { name?: string } | null)?.name || '').trim();
  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const travelerTitle = travelerNameForAskMeTitle(fromProfile, meta);
  const askMessage = buildAskMeNotificationMessage(banditName, text);
  const rootId = createClientUuid();

  const apiPayload = {
    kind: 'ask_me' as const,
    threadRootId: rootId,
    askTargetBanditId: targetBanditId,
    title: travelerTitle,
    message: text,
    operatorMessage: askMessage,
    guestTitle: `Ask Me · ${banditName}`,
  };

  const row = {
    id: rootId,
    user_id: operatorUserId,
    type: 'bandit_question',
    title: travelerTitle,
    message: askMessage,
    reference_id: String(user.id || '').trim(),
    reference_type: 'bandit_question_request',
    ask_target_bandit_id: targetBanditId,
  } as never;
  console.log('ASK TARGET', targetBanditId);

  if (shouldRequireOperatorMessageApi()) {
    await deliverOperatorMessage(apiPayload);
    requestNotificationsRefresh();
    void trackEvent({
      eventName: 'ask_me_sent',
      referenceType: 'bandit',
      referenceId: targetBanditId,
    });
    return;
  }

  try {
    await deliverOperatorMessage(apiPayload);
    requestNotificationsRefresh();
    void trackEvent({
      eventName: 'ask_me_sent',
      referenceType: 'bandit',
      referenceId: targetBanditId,
    });
    return;
  } catch {
    /* local dev: optional direct insert below */
  }

  const { error } = await supabase.from('notifications').insert(row);

  if (error) {
    if (isAskTargetBanditIdMissingColumnError(error)) {
      throw new Error('Ask Me needs a database update. Please try again later.');
    }
    if (isPersistenceBlocked(error)) {
      try {
        await deliverOperatorMessage(apiPayload);
        requestNotificationsRefresh();
        void trackEvent({
          eventName: 'ask_me_sent',
          referenceType: 'bandit',
          referenceId: targetBanditId,
        });
        return;
      } catch (err) {
        throw userFacingMessagingError(err);
      }
    }
    throw userFacingMessagingError(error);
  }

  // Guest-side Notifications mirror row: visible in Notifications tab, independent from Pilot Desk.
  const guestEcho = {
      user_id: String(user.id || '').trim(),
      type: 'bandit_question',
      title: `Ask Me · ${banditName}`,
      message: text,
      reference_id: rootId || null,
      reference_type: BANDIT_QUESTION_GUEST_ECHO_REF,
      ask_target_bandit_id: targetBanditId,
      is_read: false,
    } as never;
    const { error: guestEchoError } = await supabase.from('notifications').insert(guestEcho);
    if (guestEchoError) {
      try {
        await insertGuestEchoViaApi({
          kind: 'ask_me',
          threadRootId: rootId,
          askTargetBanditId: targetBanditId,
          title: String((guestEcho as { title?: string }).title || '').trim() || `Ask Me · ${banditName}`,
          message: text,
        });
      } catch (err) {
        throw userFacingMessagingError(err);
      }
    }
    requestNotificationsRefresh();
    void trackEvent({
      eventName: 'ask_me_sent',
      referenceType: 'bandit',
      referenceId: targetBanditId,
    });
}

export default function BanditsServiceRoutePlaceholder() {
  return null;
}
