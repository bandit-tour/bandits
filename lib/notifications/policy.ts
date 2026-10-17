/**
 * One classification for the existing inbox. Marketing is never treated as service.
 * Unknown types stay marketing so they cannot skip consent.
 */
export type NotificationClass = "service" | "social" | "marketing";

export type DeliveryDecision = {
  allow: boolean;
  notificationClass: NotificationClass;
  reason: string;
};

const SERVICE_TYPES = new Set([
  "signal_peer_delivery",
  "banditeam_report",
  "bandiTEAM_report",
  "scam_alert_guest_echo",
  "commerce.booking.confirmed",
  "experience.booked",
  "stay_check_in",
  "concierge_reply",
]);

const SOCIAL_TYPES = new Set([
  "bandit_reply",
  "guest_moment",
  "guest_moment_connection",
  "local_friend",
  "local_friend_bottle",
  "bandit_question",
]);

const MARKETING_TITLE = /next trip|dream destination|travel in a bottle|where would you love|memories are yours|journey doesn't end|discover |return to |promotional|vietnam|plan your/i;

export function classifyNotification(input: {
  type?: string | null;
  title?: string | null;
  message?: string | null;
  referenceType?: string | null;
  notificationClass?: NotificationClass | null;
}): NotificationClass {
  const explicit = input.notificationClass;
  const title = String(input.title || "");
  const type = String(input.type || "").trim();
  const referenceType = String(input.referenceType || "").trim();
  const blob = `${type} ${title} ${input.message || ""}`;
  if (explicit === "service" && MARKETING_TITLE.test(title)) return "marketing";
  if (explicit === "social" || explicit === "marketing") return explicit;
  if (explicit === "service") return "service";
  if (referenceType === "local_friend_guest_echo" || type === "stay_check_in") return "service";
  if (/scam_alert|banditeam_report|bandiTEAM_report|demo_banditeam/i.test(type)) return "service";
  if (/scam alert|safety alert/i.test(blob) && !MARKETING_TITLE.test(title)) return "service";
  if (MARKETING_TITLE.test(title)) return "marketing";
  if (SERVICE_TYPES.has(type)) return "service";
  if (SOCIAL_TYPES.has(type)) return "social";
  return "marketing";
}

export type NoticePrefs = {
  serviceEnabled: boolean;
  socialEnabled: boolean;
  /** Marketing consent. Default off. */
  marketingEnabled: boolean;
  quietStartHour: number;
  quietEndHour: number;
  /** ISO times marketing notices were actually stored. */
  marketingSentAt: string[];
};

export const NOTICE_PREFS_KEY = "@bandits_notification_prefs_v1";
export const MARKETING_CAP_PER_WEEK = 2;

export const DEFAULT_NOTICE_PREFS: NoticePrefs = {
  serviceEnabled: true,
  socialEnabled: true,
  marketingEnabled: false,
  quietStartHour: 22,
  quietEndHour: 8,
  marketingSentAt: [],
};

export function isQuietHour(now: Date, startHour: number, endHour: number): boolean {
  const h = now.getHours();
  const start = ((startHour % 24) + 24) % 24;
  const end = ((endHour % 24) + 24) % 24;
  if (start === end) return false;
  if (start < end) return h >= start && h < end;
  return h >= start || h < end;
}

export function decideDelivery(input: {
  notificationClass?: NotificationClass | null;
  type?: string | null;
  title?: string | null;
  message?: string | null;
  referenceType?: string | null;
  prefs: NoticePrefs;
  now?: Date;
  /** When false, marketing is irrelevant to this lifecycle moment. */
  lifecycleRelevant?: boolean;
  /** One explicit opt-in, such as the dream-destination checkbox. Does not opt in to other discovery. */
  explicitConsent?: boolean;
  /** Already stored. Consent and quiet hours still apply. The weekly cap does not hide it again. */
  alreadyDelivered?: boolean;
}): DeliveryDecision {
  const notificationClass = classifyNotification(input);
  const now = input.now ?? new Date();
  if (notificationClass === "service") {
    const safety = /scam|banditeam|safety/i.test(`${input.type || ""} ${input.title || ""} ${input.message || ""}`);
    if (!input.prefs.serviceEnabled && !safety) {
      return { allow: false, notificationClass, reason: "service_off" };
    }
    return { allow: true, notificationClass, reason: "service" };
  }
  if (notificationClass === "social") {
    if (!input.prefs.socialEnabled) {
      return { allow: false, notificationClass, reason: "social_off" };
    }
    return { allow: true, notificationClass, reason: "social" };
  }
  if (!input.prefs.marketingEnabled && !input.explicitConsent) {
    return { allow: false, notificationClass, reason: "marketing_consent" };
  }
  if (input.lifecycleRelevant === false) {
    return { allow: false, notificationClass, reason: "lifecycle" };
  }
  if (isQuietHour(now, input.prefs.quietStartHour, input.prefs.quietEndHour)) {
    return { allow: false, notificationClass, reason: "quiet_hours" };
  }
  if (!input.alreadyDelivered) {
    const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const recent = input.prefs.marketingSentAt.filter((iso) => {
      const t = new Date(iso).getTime();
      return Number.isFinite(t) && t >= weekAgo;
    });
    if (recent.length >= MARKETING_CAP_PER_WEEK) {
      return { allow: false, notificationClass, reason: "frequency_cap" };
    }
  }
  return { allow: true, notificationClass, reason: "marketing" };
}
