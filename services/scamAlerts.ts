import { supabase } from '@/lib/supabase';
import { trackEvent } from '@/lib/analytics';

export type SubmitScamAlertInput = {
  city: string;
  location: string;
  title: string;
  description: string;
  /** Local file URI from ImagePicker — uploaded to storage, URL stored on row */
  imageUri?: string | null;
};

async function uploadReportImage(userId: string, localUri: string): Promise<string | null> {
  const path = `scam_reports/${userId}/${Date.now()}.jpg`;
  try {
    const res = await fetch(localUri);
    const blob = await res.blob();
    const { data, error } = await supabase.storage.from('banditsassets4').upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: false,
    });
    if (error) {
      throw new Error(error.message || 'Image upload failed.');
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from('banditsassets4').getPublicUrl(data.path);
    return publicUrl;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    throw new Error(msg || 'Image upload failed.');
  }
}

/**
 * Persists a bandiTEAM scam alert to `public.scam_alerts`.
 * Requires an authenticated Supabase session (RLS).
 */
export async function submitScamAlert(input: SubmitScamAlertInput): Promise<void> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw new Error(authError.message || 'Could not verify your session.');
  if (!user) throw new Error('Sign in to submit a report.');

  let imageUrl: string | null = null;
  if (input.imageUri?.trim()) {
    imageUrl = await uploadReportImage(user.id, input.imageUri.trim());
  }

  const row = {
    city: input.city.trim(),
    location: input.location.trim(),
    title: input.title.trim(),
    description: input.description.trim(),
    reported_by: user.id,
    ...(imageUrl ? { image_url: imageUrl } : {}),
  };

  const { error } = await supabase.from('scam_alerts').insert(row);

  if (error) {
    throw new Error(error.message || 'Could not save report.');
  }

  void trackEvent({
    eventName: 'bandiTEAM_report_created',
    referenceType: 'report',
    referenceId: String(row.title),
  });
}
