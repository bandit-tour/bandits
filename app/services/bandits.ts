import {
  BANDIT_QUESTION_GUEST_ECHO_REF,
  buildAskMeNotificationMessage,
  travelerNameForAskMeTitle,
} from '@/lib/askMeMessageFormat';
import { Database } from '@/lib/database.types';
import { trackEvent } from '@/lib/analytics';
import { getPilotApiBaseUrl } from '@/lib/pilotApiBase';
import { ensureAnonymousSession } from '@/lib/pilotSession';
import { isAuthOrMissingError } from '@/lib/postgrestAuth';
import { supabase } from '@/lib/supabase';
import { getOperatorUserId } from '@/services/localFriend';

type Bandit = Database['public']['Tables']['bandit']['Row'];
type BanditInsert = Database['public']['Tables']['bandit']['Insert'];
type BanditUpdate = Database['public']['Tables']['bandit']['Update'];

function isNotificationsPolicyError(error: { message?: string; code?: string }): boolean {
  const code = String(error.code ?? '');
  const msg = String(error.message ?? '').toLowerCase();
  if (code === '42501') return true;
  return /row-level security|rls|policy|permission denied/i.test(msg);
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
  const text = question.trim();
  if (!text) throw new Error('Question is required.');

  await ensureAnonymousSession();

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw new Error(sessionError.message || 'Could not verify your session.');
  const user = session?.user;
  if (!user) throw new Error('Could not start a session. Try again in a moment.');

  const apiBase = getPilotApiBaseUrl();
  if (apiBase && session.access_token) {
    try {
      const res = await fetch(`${apiBase}/api/ask-me`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ banditId, question: text }),
      });
      if (res.ok) {
        void trackEvent({ eventName: 'ask_me_sent', referenceType: 'bandit', referenceId: banditId });
        return;
      }
    } catch {
      /* fall through to direct insert */
    }
  }

  const operatorUserId = getOperatorUserId();
  if (!operatorUserId) {
    throw new Error('Operator routing is not configured. Set EXPO_PUBLIC_OPERATOR_USER_ID.');
  }

  const { data: banditRow } = await supabase
    .from('bandit')
    .select('id, name')
    .eq('id', banditId)
    .maybeSingle();
  const banditName = String((banditRow as { name?: string } | null)?.name || 'banDit').trim() || 'banDit';
  const { data: prof } = await supabase.from('user_profile').select('name').eq('id', user.id).maybeSingle();
  const fromProfile = String((prof as { name?: string } | null)?.name || '').trim();
  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const travelerTitle = travelerNameForAskMeTitle(fromProfile, meta);
  const askMessage = buildAskMeNotificationMessage(banditName, text);

  const withAskTarget = {
    user_id: operatorUserId,
    type: 'bandit_question',
    title: travelerTitle,
    message: askMessage,
    reference_id: user.id,
    reference_type: 'bandit_question_request',
    ask_target_bandit_id: banditId,
  } as never;
  const withoutAskTarget = {
    user_id: operatorUserId,
    type: 'bandit_question',
    title: travelerTitle,
    message: askMessage,
    reference_id: user.id,
    reference_type: 'bandit_question_request',
  } as never;

  let { data: insertedRow, error } = await supabase
    .from('notifications')
    .insert(withAskTarget)
    .select('id')
    .single();
  if (error && isAskTargetBanditIdMissingColumnError(error)) {
    const retry = await supabase.from('notifications').insert(withoutAskTarget).select('id').single();
    insertedRow = retry.data;
    error = retry.error;
  }

  if (error) {
    if (isNotificationsPolicyError(error)) {
      throw new Error('Ask is temporarily unavailable until notifications permissions are updated.');
    }
    throw new Error(error.message || 'Could not send your question.');
  }

  const rootId = String((insertedRow as { id?: string } | null)?.id || '').trim();
  if (rootId) {
    const { error: echoErr } = await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'bandit_question',
      title: banditName,
      message: text,
      reference_id: rootId,
      reference_type: BANDIT_QUESTION_GUEST_ECHO_REF,
    } as never);
    if (echoErr) {
      console.warn('[submitBanditQuestion] guest echo insert:', echoErr.message);
    }
  }

  void trackEvent({
    eventName: 'ask_me_sent',
    referenceType: 'bandit',
    referenceId: banditId,
  });
}

export default function BanditsServiceRoutePlaceholder() {
  return null;
}
