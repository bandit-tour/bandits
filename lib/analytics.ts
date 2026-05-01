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
  | 'bandiTEAM_report_created'
  /** bandiTEAM product funnel */
  | 'banditeam_alert_opened'
  | 'banditeam_alert_shared'
  | 'banditeam_alert_saved_toggle'
  | 'banditeam_feed_viewed'
  | 'banditeam_feed_map_opened'
  | 'banditeam_home_card_cta'
  | 'banditeam_report_submit_success'
  | 'banditeam_notification_opened'
  | 'banditeam_session_day_active';

const sessionOnceKeys = new Set<string>();

/** `analytics_events.user_id` is uuid — never send "" (nullish coalescing preserves empty string). */
function authUserIdForAnalytics(id: unknown): string | null {
  if (id == null) return null;
  const s = typeof id === 'string' ? id.trim() : String(id).trim();
  if (!s) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
    ? s
    : null;
}

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
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    const payload = {
      user_id: authUserIdForAnalytics(user?.id),
      event_name: args.eventName,
      reference_type: args.referenceType ?? null,
      reference_id: args.referenceId ?? null,
    };

    await supabase.from('analytics_events').insert(payload);
  } catch {
    // Analytics should never block product flows.
  }
}

