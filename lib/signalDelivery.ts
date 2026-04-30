import { supabase } from '@/lib/supabase';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Receiver-only: marks reveal in DB; sender profile becomes readable via RLS for receiver. */
export async function revealSignalDeliveryIfReceiver(deliveryId: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user || !deliveryId) return;
  const { data: row } = await supabase
    .from('signal_delivery')
    .select('receiver_user_id, reveal_status')
    .eq('id', deliveryId)
    .maybeSingle();
  if (!row || row.receiver_user_id !== user.id || row.reveal_status === 'revealed') return;
  const { error } = await supabase.rpc('reveal_signal_delivery', { p_delivery_id: deliveryId });
  if (error) console.warn('[revealSignalDeliveryIfReceiver]', error.message);
}

/** Same line stored on `signal_delivery` → `network_signal` (matches flip / assign RPC). */
export async function fetchSignalLineForDelivery(deliveryId: string): Promise<string | null> {
  const { data: sd, error } = await supabase
    .from('signal_delivery')
    .select('signal_id')
    .eq('id', deliveryId)
    .maybeSingle();
  if (error || !sd?.signal_id) return null;
  const sid = String(sd.signal_id).trim();
  if (!UUID_RE.test(sid)) return null;
  const { data: ns } = await supabase.from('network_signal').select('body').eq('id', sid).maybeSingle();
  const body = String((ns as { body?: string } | null)?.body || '').trim();
  return body || null;
}

export async function fetchSignalDeliveryMeta(deliveryId: string): Promise<{
  sender_user_id: string | null;
  receiver_user_id: string;
  reveal_status: string;
  delivery_status: string;
  thread_notification_id: string | null;
} | null> {
  const { data, error } = await supabase.from('signal_delivery').select('*').eq('id', deliveryId).maybeSingle();
  if (error || !data) return null;
  return {
    sender_user_id: data.sender_user_id,
    receiver_user_id: data.receiver_user_id,
    reveal_status: data.reveal_status,
    delivery_status: data.delivery_status,
    thread_notification_id: data.thread_notification_id ?? null,
  };
}

/** Soft identity after reveal (RLS allows sender profile for receiver when revealed). */
export async function fetchSenderProfilePreview(senderUserId: string): Promise<{
  name: string;
  city: string;
  avatarUrl: string;
} | null> {
  const { data, error } = await supabase
    .from('user_profile')
    .select('name, city, avatar_url')
    .eq('id', senderUserId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    name: data.name?.trim() || 'Traveler',
    city: data.city?.trim() || '',
    avatarUrl: data.avatar_url?.trim() || '',
  };
}

/** Prefer linked bandit identity for inbox / chat header (real banDit name + face). */
export async function fetchSenderBanditIdentity(senderUserId: string): Promise<{
  banditId: string;
  displayName: string;
  avatarUrl: string;
} | null> {
  const { data: ub } = await supabase
    .from('user_bandit')
    .select('bandit_id')
    .eq('user_id', senderUserId)
    .limit(1)
    .maybeSingle();
  const bid = ub?.bandit_id != null ? String(ub.bandit_id).trim() : '';
  if (!UUID_RE.test(bid)) return null;
  const { data: b, error } = await supabase
    .from('bandit')
    .select('id, name, face_image_url, image_url')
    .eq('id', bid)
    .maybeSingle();
  if (error || !b) return null;
  const name = String(b.name || '').trim();
  const face = String(b.face_image_url || '').trim();
  const img = String(b.image_url || '').trim();
  return {
    banditId: String(b.id),
    displayName: name || 'banDit',
    avatarUrl: face || img,
  };
}
