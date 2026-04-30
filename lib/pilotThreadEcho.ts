import { ensureOperatorUserId } from '@/lib/operatorConfig';
import { supabase } from '@/lib/supabase';

/**
 * Every guest line in a pilot thread is duplicated to the operator inbox so
 * a human can respond. Ignores failures in dev (RLS / missing operator row).
 */
export async function notifyOperatorOfGuestMessage(args: {
  referenceId: string;
  referenceType: 'signal_delivery' | 'presence_thread';
  message: string;
  title?: string;
}): Promise<void> {
  const operator = await ensureOperatorUserId();
  if (!operator) return;
  const t = (args.message ?? '').trim();
  if (!t) return;
  const { error } = await supabase.from('notifications').insert({
    user_id: operator,
    type: 'pilot_thread_echo',
    title: (args.title ?? 'Guest message').trim(),
    message: t,
    reference_id: args.referenceId,
    reference_type: args.referenceType,
  } as never);
  if (error) {
    console.warn('[pilotThreadEcho]', error.message);
  }
}
