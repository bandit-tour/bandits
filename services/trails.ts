import { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type TrailWithStops = Database['public']['Tables']['trails']['Row'] & {
  trail_stops: (Database['public']['Tables']['trail_stops']['Row'] & {
    spot?: Database['public']['Tables']['spots']['Row'] | null;
  })[];
};

export async function getTrailsByBanditId(banditId: string): Promise<TrailWithStops[]> {
  const { data, error } = await supabase
    .from('trails')
    .select(
      `
      *,
      trail_stops (
        *,
        spot:spots (*)
      )
    `
    )
    .eq('bandit_id', banditId)
    .order('title');

  if (error) {
    console.error('Error fetching trails:', error);
    throw error;
  }

  const rows = (data || []) as TrailWithStops[];
  rows.forEach((t) => {
    t.trail_stops = (t.trail_stops || []).sort((a, b) => a.position - b.position);
  });
  return rows;
}

export async function getTrailById(trailId: string): Promise<TrailWithStops | null> {
  const { data, error } = await supabase
    .from('trails')
    .select(
      `
      *,
      trail_stops (
        *,
        spot:spots (*)
      )
    `
    )
    .eq('id', trailId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching trail:', error);
    throw error;
  }

  const trail = data as TrailWithStops;
  if (trail?.trail_stops) {
    trail.trail_stops = trail.trail_stops.sort((a, b) => a.position - b.position);
  }
  return trail;
}

