import { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

type UserBanditReview = Database['public']['Tables']['user_bandit']['Row'];

export async function getBanditReviews(banditId: string): Promise<UserBanditReview[]> {
  try {
    const { data, error } = await supabase
      .from('user_bandit')
      .select('*')
      .eq('bandit_id', banditId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching bandit reviews:', error);
    throw error;
  }
}

 