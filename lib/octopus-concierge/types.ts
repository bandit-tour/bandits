/**
 * Octopus Concierge execution-engine contracts.
 * Every guest request → structured ConciergeTask. Orchestration + integrations + Local banDit fallback.
 */

/** How the task is completed in the real world. */
export type ConciergeExecutionMethod =
  /** AI + connected API completes it end-to-end. */
  | "AUTO"
  /** AI prepares; Local banDit confirms / completes one human action. */
  | "ASSISTED"
  /** Phone, WhatsApp, local relationship, physical action → real operator task. */
  | "HUMAN";

/**
 * Status lifecycle (orchestration path OR banDit-assigned path).
 * Guest UI maps these to human copy — never raw engine labels.
 */
export type ConciergeTaskStatus =
  | "requested"
  | "understanding"
  | "searching"
  | "awaiting_guest"
  | "booking"
  | "assigned_to_bandit"
  | "in_progress"
  | "confirmed"
  | "completed"
  | "cancelled";

export type ConciergeTaskCategory =
  | "restaurant"
  | "tickets"
  | "taxi"
  | "airport_transfer"
  | "delivery_wolt"
  | "delivery_local"
  | "nightlife"
  | "theatre"
  | "special"
  | "other";

export type ConciergeMoney = {
  amountCents: number;
  currency: string;
};

/**
 * Canonical structured task — the paid operating loop unit.
 */
export type ConciergeTask = {
  id: string;
  /** Original guest request text. */
  request: string;
  guestId: string;
  banditId: string;
  banditDisplayName: string;
  category: ConciergeTaskCategory;
  deadline: string | null;
  location: string | null;
  budget: ConciergeMoney | null;
  executionMethod: ConciergeExecutionMethod;
  status: ConciergeTaskStatus;
  confirmation: string | null;
  /** Latest provider message from Workspace view=track (if any). */
  providerReply: string | null;
  cost: ConciergeMoney | null;
  commission: ConciergeMoney | null;
  evidence: string[];
  createdAt: string;
  updatedAt: string;
};

/** Guest-safe status labels (never engine jargon). */
export function guestFacingConciergeStatus(
  status: ConciergeTaskStatus,
  banditFirstName: string,
): string {
  switch (status) {
    case "requested":
    case "understanding":
    case "searching":
    case "assigned_to_bandit":
    case "in_progress":
    case "booking":
      return `${banditFirstName} is handling it`;
    case "awaiting_guest":
      return "Waiting for you";
    case "confirmed":
      return "Confirmed with proof";
    case "completed":
      return "Completed with proof";
    case "cancelled":
      return "Cancelled";
    default:
      return `${banditFirstName} is handling it`;
  }
}

export const CONCIERGE_STATUS_LIFECYCLES = {
  orchestration: [
    "requested",
    "understanding",
    "searching",
    "awaiting_guest",
    "booking",
    "confirmed",
    "completed",
  ] as const satisfies readonly ConciergeTaskStatus[],
  banditAssigned: [
    "requested",
    "assigned_to_bandit",
    "in_progress",
    "confirmed",
    "completed",
  ] as const satisfies readonly ConciergeTaskStatus[],
} as const;
