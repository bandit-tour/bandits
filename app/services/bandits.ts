import { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

type Bandit = Database['public']['Tables']['bandit']['Row'];
type BanditInsert = Database['public']['Tables']['bandit']['Insert'];
type BanditUpdate = Database['public']['Tables']['bandit']['Update'];

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

// additional function included to deal with the tags connection with the bandits fetch as well, i didnt remove the previous method, just in case.
export async function getBanditsWithTags() {
  const likedIds = await getUserLikedBanditIds();
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
  currentLikeStatus: boolean
): Promise<void> {
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

  if (currentLikeStatus) {
    // Remove like for this user/bandit pair
    const { error } = await supabase
      .from('bandit_user_likes')
      .delete()
      .eq('user_id', user.id)
      .eq('bandit_id', id);

    if (error) {
      console.error('Error removing bandit like:', error);
      throw error;
    }
  } else {
    // Add like for this user/bandit pair
    const { error } = await supabase.from('bandit_user_likes').insert({
      user_id: user.id,
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

export async function getBanditById(id: string): Promise<Bandit | null> {
  const likedIds = await getUserLikedBanditIds();
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
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error('Error getting current user for bandit liked IDs:', userError);
    throw userError;
  }

  if (!user) {
    return new Set();
  }

  const { data, error } = await supabase
    .from('bandit_user_likes')
    .select('bandit_id')
    .eq('user_id', user.id);

  if (error) {
    console.error('Error fetching user liked bandit IDs:', error);
    throw error;
  }

  return new Set(data?.map((item: any) => item.bandit_id) || []);
}

export async function submitBanditQuestion(banditId: string, question: string): Promise<void> {
  const text = question.trim();
  if (!text) throw new Error('Question is required.');

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw new Error(userError.message || 'Could not verify your session.');
  if (!user) throw new Error('Sign in to ask a question.');

  const { error } = await supabase.from('notifications').insert({
    user_id: user.id,
    type: 'bandit_question',
    title: 'Question for bandit',
    message: text,
    reference_id: banditId,
    reference_type: 'bandit',
  });

  if (error) {
    throw new Error(error.message || 'Could not send your question.');
  }
}

export default function BanditsServiceRoutePlaceholder() {
  return null;
}
