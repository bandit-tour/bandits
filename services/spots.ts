import { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

type Spot = Database['public']['Tables']['spots']['Row'];

export async function getSpotsByBanditId(banditId: string): Promise<Spot[]> {
  const { data, error } = await supabase
    .from('spots')
    .select('*')
    .eq('bandit_id', banditId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching spots:', error);
    throw error;
  }

  return data || [];
}
