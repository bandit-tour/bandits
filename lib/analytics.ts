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
  | 'banditeam_session_day_active'
  /** Guest Trip OS — return-with-intent (not DAU scrolling) */
  | 'lifecycle_checkout'
  | 'lifecycle_after_trip'
  | 'lifecycle_trip_planning'
  | 'lifecycle_reactivated'
  | 'lifecycle_new_booking'
  | 'lifecycle_checked_in'
  | 'lifecycle_new_stay'
  | 'lifecycle_saved_place'
  | 'lifecycle_followed_bandit'
  | 'city_memory_opened'
  | 'reactivation_started'
  | 'reactivation_completed'
  | 'bottle_planning_opened';

const sessionOnceKeys = new Set<string>();
let analyticsInsertBlocked = false;

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

    if (analyticsInsertBlocked) return;

    // `analytics_events` accepts inserts only from signed-in (incl. anonymous-auth) sessions (RLS `to authenticated`).
    // With no session yet the request would run as the anon role and be rejected (42501). Wait for the session
    // instead of sending a request that cannot succeed; no database policy change is needed.
    if (!user?.id) {
      queuePendingEvent(payload);
      return;
    }

    await insertAnalyticsEvent(payload);
  } catch {
    // Analytics should never block product flows.
  }
}

type AnalyticsPayload = {
  user_id: string | null;
  event_name: AnalyticsEventName;
  reference_type: string | null;
  reference_id: string | null;
};

const MAX_PENDING_EVENTS = 40;
const pendingEvents: AnalyticsPayload[] = [];
let sessionWaiterRegistered = false;

async function insertAnalyticsEvent(payload: AnalyticsPayload): Promise<void> {
  if (analyticsInsertBlocked) return;
  const { error } = await supabase.from('analytics_events').insert(payload);
  if (error && (error.code === '42501' || /row-level security/i.test(error.message || ''))) {
    // RLS rejects even a signed-in session's inserts. Stop retrying every event (one rejected request per session,
    // not one per tap) and surface it once. Events are NOT being recorded until the policy/session is fixed.
    analyticsInsertBlocked = true;
    pendingEvents.length = 0;
    console.warn('[analytics] insert rejected by RLS; analytics disabled for this session', error.code);
  }
}

function queuePendingEvent(payload: AnalyticsPayload): void {
  if (pendingEvents.length >= MAX_PENDING_EVENTS) pendingEvents.shift();
  pendingEvents.push(payload);
  if (sessionWaiterRegistered) return;
  sessionWaiterRegistered = true;
  // One long-lived listener: flush the queue the first time a session with a user exists.
  supabase.auth.onAuthStateChange((_event, session) => {
    const uid = authUserIdForAnalytics(session?.user?.id);
    if (!uid || pendingEvents.length === 0) return;
    const batch = pendingEvents.splice(0, pendingEvents.length);
    setTimeout(() => void (async () => {
      for (const ev of batch) {
        if (analyticsInsertBlocked) return;
        try {
          await insertAnalyticsEvent({ ...ev, user_id: uid });
        } catch {
          // Analytics should never block product flows.
        }
      }
    })(), 0);
  });
}

