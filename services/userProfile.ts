import type { Database } from '@/lib/database.types';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

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

  const { error } = await (supabase as any).from('user_profile').upsert([row], { onConflict: 'id' });
  if (error) throw new Error(error.message || 'Could not save profile.');
}

/**
 * After email/OAuth sign-in: go straight to the app (hotel pilot — no mandatory profile form).
 */
export async function navigateAfterAuth(router: unknown): Promise<void> {
  const r = router as { replace: (href: string) => void };
  r.replace('/bandits');
}
