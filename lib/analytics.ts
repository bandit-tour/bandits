import { supabase } from '@/lib/supabase';

export type AnalyticsEventName =
  | 'app_opened'
  | 'bandit_profile_opened'
  | 'city_guide_opened'
  | 'trail_opened'
  | 'spot_opened'
  | 'ask_me_sent'
  | 'bandit_reply_received'
  | 'local_friend_message_sent'
  | 'local_friend_reply_received'
  | 'chat_opened'
  | 'notification_opened'
  | 'nearby_inbox_opened'
  | 'bandiTEAM_report_created';

const sessionOnceKeys = new Set<string>();

export async function trackEvent(args: {
  eventName: AnalyticsEventName;
  referenceType?: string | null;
  referenceId?: string | null;
  onceKey?: string | null;
}): Promise<void> {
  const onceKey = String(args.onceKey ?? '').trim();
  if (onceKey && sessionOnceKeys.has(onceKey)) return;
  if (onceKey) sessionOnceKeys.add(onceKey);

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload = {
      user_id: user?.id ?? null,
      event_name: args.eventName,
      reference_type: args.referenceType ?? null,
      reference_id: args.referenceId ?? null,
    };

    await supabase.from('analytics_events').insert(payload);
  } catch {
    // Analytics should never block product flows.
  }
}

