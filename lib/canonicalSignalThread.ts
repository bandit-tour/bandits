import { supabase } from '@/lib/supabase';
import {
  fetchSenderBanditIdentity,
  fetchSenderProfilePreview,
  revealSignalDeliveryIfReceiver,
} from '@/lib/signalDelivery';

export type CanonicalSignalThread = {
  id: string;
  sender_name: string;
  sender_avatar: string;
  signal_text: string;
  sender_type: 'local_bandit';
  created_at: string;
  unread: boolean;
  thread_id: string;
  notification_id: string | null;
  bandit_profile_id: string | null;
};

async function fetchSmaragdaBandit() {
  const { data } = await supabase
    .from('bandit')
    .select('id, name, face_image_url, image_url')
    .ilike('name', '%smaragda%')
    .limit(1)
    .maybeSingle();
  return data as { id?: string; name?: string; face_image_url?: string; image_url?: string } | null;
}

export async function resolveCanonicalSignalThreadByDelivery(
  deliveryId: string,
  userId?: string | null,
): Promise<CanonicalSignalThread | null> {
  const did = String(deliveryId || '').trim();
  if (!did) return null;

  const { data: delivery } = await supabase
    .from('signal_delivery')
    .select(
      'id, signal_id, sender_user_id, receiver_user_id, reveal_status, created_at, thread_notification_id',
    )
    .eq('id', did)
    .maybeSingle();
  if (!delivery) return null;

  const viewer = String(userId || '').trim();
  const receiverId = String((delivery as any).receiver_user_id || '').trim();
  const senderIdRaw = (delivery as any).sender_user_id;
  const senderId = senderIdRaw != null && String(senderIdRaw).trim() ? String(senderIdRaw).trim() : '';

  // Receiver must be revealed before sender profile is readable (RLS).
  if (viewer && receiverId && viewer === receiverId) {
    await revealSignalDeliveryIfReceiver(did);
  }

  const signalId = String((delivery as any).signal_id || '').trim();
  const { data: signal } = signalId
    ? await supabase.from('network_signal').select('body').eq('id', signalId).maybeSingle()
    : { data: null as any };
  const signalText = String((signal as any)?.body || '').trim();

  /** Who the inbox/chat header should represent (the other participant). */
  let counterpartyUserId: string | null = null;
  if (viewer && receiverId && senderId) {
    if (viewer === receiverId) counterpartyUserId = senderId;
    else if (viewer === senderId) counterpartyUserId = receiverId;
    else counterpartyUserId = senderId;
  } else if (viewer && receiverId && viewer === receiverId) {
    counterpartyUserId = senderId || null;
  } else if (viewer && senderId && viewer === senderId) {
    counterpartyUserId = receiverId || null;
  } else {
    counterpartyUserId = senderId || null;
  }

  let sender_name = '';
  let sender_avatar = '';
  let bandit_profile_id: string | null = null;

  if (counterpartyUserId) {
    const bandit = await fetchSenderBanditIdentity(counterpartyUserId);
    if (bandit) {
      sender_name = bandit.displayName;
      sender_avatar = bandit.avatarUrl;
      bandit_profile_id = bandit.banditId;
    } else {
      const prof = await fetchSenderProfilePreview(counterpartyUserId);
      if (prof) {
        sender_name = prof.name;
        sender_avatar = prof.avatarUrl;
      }
    }
  }

  // Network fallback delivery (no peer): keep Smaragda-style host identity.
  if (!senderId) {
    const smaragda = await fetchSmaragdaBandit();
    sender_name = String(smaragda?.name || 'Smaragda').trim() || 'Smaragda';
    sender_avatar = String(smaragda?.face_image_url || smaragda?.image_url || '').trim();
    bandit_profile_id = String(smaragda?.id || '').trim() || null;
  } else if (!sender_name) {
    // e.g. sender viewing receiver before RLS allows profile read — still show usable label.
    sender_name = viewer === senderId ? 'Guest' : 'Traveler';
  }

  let unread = false;
  let notificationId = String((delivery as any).thread_notification_id || '').trim() || null;
  if (notificationId) {
    let q = supabase.from('notifications').select('is_read').eq('id', notificationId);
    if (userId) q = q.eq('user_id', userId);
    q = q.limit(1);
    const { data: n } = await q.maybeSingle();
    unread = !(n as any)?.is_read;
  } else if (userId) {
    const { data: n } = await supabase
      .from('notifications')
      .select('id, is_read')
      .eq('user_id', userId)
      .eq('type', 'signal_peer_delivery')
      .in('reference_type', ['signal_delivery', 'signal_delivery_peer'])
      .eq('reference_id', did)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    notificationId = String((n as any)?.id || '').trim() || null;
    unread = !!n && !(n as any).is_read;
  }

  return {
    id: did,
    sender_name,
    sender_avatar,
    signal_text: signalText,
    sender_type: 'local_bandit',
    created_at: String((delivery as any).created_at || new Date().toISOString()),
    unread,
    thread_id: did,
    notification_id: notificationId,
    bandit_profile_id,
  };
}
