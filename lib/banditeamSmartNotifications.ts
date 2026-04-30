/**
 * **Smart push notifications** (nearby scam, nightlife warnings, taxi hotspots, clusters)
 * require a **server** (scheduled jobs + FCM/APNs + user location consent + policy).
 *
 * This module documents the intended rules and exposes **client-side hooks** so:
 * - analytics can record notification opens when wired from deep links / inbox
 * - a future Edge Function can call the same categorization logic
 */

import { trackEvent } from '@/lib/analytics';

export function trackBanditeamNotificationOpened(referenceId: string, referenceType = 'push'): void {
  void trackEvent({
    eventName: 'banditeam_notification_opened',
    referenceType,
    referenceId,
  });
}

export type BanditeamDigestReason =
  | 'nearby_new_scam'
  | 'nightlife_cluster_tonight'
  | 'taxi_hotspot_cluster'
  | 'multi_report_same_block';

export type BanditeamDigestPayload = {
  reason: BanditeamDigestReason;
  alertId?: string;
  city?: string;
  title?: string;
};

/** Placeholder for server-driven scheduling — no local spam in production builds. */
export function describeSmartNotificationRules(): string {
  return [
    'Push only when: (1) new scam alert in user’s watched city within 24h,',
    '(2) ≥2 nightlife-category reports same evening,',
    '(3) ≥3 taxi/transport reports same neighborhood in 72h,',
    '(4) duplicate reports clustered by geohash.',
    'Implement via Supabase Edge + expo push tokens; do not fake pushes client-side.',
  ].join(' ');
}

export function scoreDigestEligibility(_payload: BanditeamDigestPayload): { eligible: boolean; score: number } {
  return { eligible: false, score: 0 };
}
