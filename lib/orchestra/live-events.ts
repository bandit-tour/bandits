/**
 * Guest Live Events — GUEST-INT-1.0 Alive Law
 *
 * Workspaces publish. The Guest App subscribes.
 * The product must feel alive — not refreshed.
 */

/** Guest App surfaces that react to live Workspace events (existing routes only). */
export type GuestLiveSurface =
  | "hotelier"
  | "bandits"
  | "experiences"
  | "journey"
  | "alerts"
  | "impact"
  | "notifications"
  | "chat";

/** Workspace that owns the business event. */
export type WorkspacePublisher =
  | "hotelier"
  | "bandit"
  | "experience"
  | "commerce"
  | "admin"
  | "impact"
  | "connection"
  | "creative"
  | "intelligence"
  | "identity";

export type GuestLiveEventType =
  | "hotelier.rooftop_event.published"
  | "hotelier.campaign.published"
  | "hotelier.message.published"
  | "hotelier.upsell.published"
  | "bandit.premium_insight.published"
  | "bandit.profile.updated"
  | "bandit.story.published"
  | "bandit.guide.published"
  | "experience.listed"
  | "experience.availability.changed"
  | "experience.booked"
  | "commerce.booking.confirmed"
  | "commerce.payment.confirmed"
  | "admin.destination_alert.published"
  | "impact.action.completed"
  | "creative.campaign.published"
  | "connection.campaign.live"
  | "intelligence.nba.ready"
  /** Guest Trip OS lifecycle */
  | "guest.checked_in"
  | "guest.checked_out"
  | "guest.entered_after_trip_mode"
  | "guest.saved_place"
  | "guest.followed_bandit"
  | "guest.started_trip_planning"
  | "guest.added_new_booking"
  | "guest.reactivated"
  | "guest.started_new_stay";

export type GuestLiveEvent = {
  id: string;
  type: GuestLiveEventType;
  workspace: WorkspacePublisher;
  /** Guest surface(s) that must update instantly */
  surfaces: GuestLiveSurface[];
  title: string;
  detail?: string;
  entityId?: string;
  propertySlug?: string;
  destination?: string;
  publishedAt: string;
  /** Origin table / bus when known */
  sourceRef?: string;
};

/** Canonical routing: Workspace publish → Guest surface(s). */
export const GUEST_LIVE_ROUTING: Record<
  GuestLiveEventType,
  { workspace: WorkspacePublisher; surfaces: GuestLiveSurface[]; guestLabel: string }
> = {
  "hotelier.rooftop_event.published": {
    workspace: "hotelier",
    surfaces: ["hotelier", "experiences", "journey"],
    guestLabel: "Appears in Hotelier · Experiences · Journey",
  },
  "hotelier.campaign.published": {
    workspace: "hotelier",
    surfaces: ["hotelier", "journey"],
    guestLabel: "Appears in Hotelier · Journey",
  },
  "hotelier.message.published": {
    workspace: "hotelier",
    surfaces: ["hotelier", "notifications"],
    guestLabel: "Appears in Hotelier · Notifications",
  },
  "hotelier.upsell.published": {
    workspace: "hotelier",
    surfaces: ["hotelier", "journey"],
    guestLabel: "Appears in Hotelier · Journey",
  },
  "bandit.premium_insight.published": {
    workspace: "bandit",
    surfaces: ["bandits"],
    guestLabel: "Appears in Local banDits",
  },
  "bandit.profile.updated": {
    workspace: "bandit",
    surfaces: ["bandits"],
    guestLabel: "Appears in Local banDits",
  },
  "bandit.story.published": {
    workspace: "bandit",
    surfaces: ["bandits"],
    guestLabel: "Appears in Local banDits",
  },
  "bandit.guide.published": {
    workspace: "bandit",
    surfaces: ["bandits", "experiences"],
    guestLabel: "Appears in Local banDits · Experiences",
  },
  "experience.listed": {
    workspace: "experience",
    surfaces: ["experiences", "journey"],
    guestLabel: "Appears in Local Experiences",
  },
  "experience.availability.changed": {
    workspace: "experience",
    surfaces: ["experiences"],
    guestLabel: "Appears in Local Experiences",
  },
  "experience.booked": {
    workspace: "experience",
    surfaces: ["journey", "experiences"],
    guestLabel: "Appears in My Journey",
  },
  "commerce.booking.confirmed": {
    workspace: "commerce",
    surfaces: ["journey", "notifications"],
    guestLabel: "Appears in My Journey",
  },
  "commerce.payment.confirmed": {
    workspace: "commerce",
    surfaces: ["journey", "notifications"],
    guestLabel: "Appears in My Journey",
  },
  "admin.destination_alert.published": {
    workspace: "admin",
    surfaces: ["alerts", "notifications"],
    guestLabel: "Appears in Alerts",
  },
  "impact.action.completed": {
    workspace: "impact",
    surfaces: ["impact", "journey"],
    guestLabel: "Appears in Impact",
  },
  "creative.campaign.published": {
    workspace: "creative",
    surfaces: ["hotelier", "bandits", "experiences"],
    guestLabel: "Appears across live campaign surfaces",
  },
  "connection.campaign.live": {
    workspace: "connection",
    surfaces: ["hotelier", "notifications"],
    guestLabel: "Appears when Connection verifies live",
  },
  "intelligence.nba.ready": {
    workspace: "intelligence",
    surfaces: ["journey", "bandits"],
    guestLabel: "Appears as next best action in Journey",
  },
  "guest.checked_in": {
    workspace: "hotelier",
    surfaces: ["hotelier", "journey", "notifications"],
    guestLabel: "Stay privileges restored",
  },
  "guest.checked_out": {
    workspace: "hotelier",
    surfaces: ["hotelier", "bandits", "journey", "notifications"],
    guestLabel: "Shifts to After Trip · City Memory",
  },
  "guest.entered_after_trip_mode": {
    workspace: "identity",
    surfaces: ["bandits", "journey", "hotelier"],
    guestLabel: "Between trips home",
  },
  "guest.saved_place": {
    workspace: "identity",
    surfaces: ["bandits", "journey"],
    guestLabel: "City Memory updated",
  },
  "guest.followed_bandit": {
    workspace: "bandit",
    surfaces: ["bandits"],
    guestLabel: "Follow continues after checkout",
  },
  "guest.started_trip_planning": {
    workspace: "identity",
    surfaces: ["journey", "bandits"],
    guestLabel: "Next trip planning mode",
  },
  "guest.added_new_booking": {
    workspace: "hotelier",
    surfaces: ["hotelier", "notifications", "journey"],
    guestLabel: "New stay attached — memory kept",
  },
  "guest.reactivated": {
    workspace: "hotelier",
    surfaces: ["hotelier", "bandits", "journey", "notifications"],
    guestLabel: "Hotel privileges restored",
  },
  "guest.started_new_stay": {
    workspace: "hotelier",
    surfaces: ["hotelier", "journey", "notifications"],
    guestLabel: "Active stay begins",
  },
};

export const GUEST_ALIVE_LAW = {
  id: "GUEST-ALIVE-001",
  headline: "The Guest App must feel alive. Not refreshed. Alive.",
  invariant:
    "Every Workspace publishes business events. The Guest App subscribes. Surfaces update instantly without pull-to-refresh as the primary path.",
  examples: [
    "Hotelier publishes a rooftop event → Hotelier",
    "Local Bandit publishes Premium Insight → Local banDits",
    "Experience Provider publishes experience → Local Experiences",
    "Commerce confirms booking → My Journey",
    "Admin publishes destination alert → Alerts",
    "Impact completes action → Impact",
  ] as const,
} as const;

export function routeLiveEvent(type: GuestLiveEventType): {
  workspace: WorkspacePublisher;
  surfaces: GuestLiveSurface[];
} {
  const r = GUEST_LIVE_ROUTING[type];
  return { workspace: r.workspace, surfaces: [...r.surfaces] };
}
