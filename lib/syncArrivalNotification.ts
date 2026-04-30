import { fetchSignalLineForDelivery } from '@/lib/signalDelivery';
import { syncPilotThreadOpeningMessage } from '@/lib/pilotThreadIdentity';
import { supabase } from '@/lib/supabase';

/**
 * Keeps the guest's arrival row `message` in sync with `network_signal` via `signal_delivery`
 * so the main app always shows the same line as the bottle / assign flow.
 */
export async function syncLatestArrivalNotificationMessageFromDelivery(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return;

  const { data: n, error: nErr } = await supabase
    .from('notifications')
    .select('id, message, reference_id')
    .eq('user_id', user.id)
    .eq('type', 'signal_peer_delivery')
    .in('reference_type', ['signal_delivery', 'signal_delivery_peer'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (nErr || !n?.reference_id) return;

  const deliveryId = String(n.reference_id).trim();
  const line = await fetchSignalLineForDelivery(deliveryId).catch(() => null);
  const want = (line || '').trim();
  const have = String(n.message || '').trim();
  if (want && want !== have) {
    const { error } = await supabase
      .from('notifications')
      .update({ message: want } as never)
      .eq('id', n.id);
    if (error && __DEV__) console.warn('[syncArrivalNotification]', error.message);
    else if (!error) await syncPilotThreadOpeningMessage(String(n.id), want);
  }
}
