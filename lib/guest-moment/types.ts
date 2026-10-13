/**
 * Guest Moments — signature bandiTour social mechanic.
 *
 * Moment = ambient discovery / personal status (daily quote).
 * Local Friend = intentional person-to-person communication.
 * Chat = where the conversation continues.
 * Bottle = the bridge between them.
 *
 * NOT a profile settings field. NOT a travel-journal bookmark.
 */

export type MomentSenderKind = "guest" | "local_friend" | "demo";

export type MomentSender = {
  id: string;
  displayName: string;
  city?: string;
  stayHint?: string;
  avatarInitials: string;
  kind: MomentSenderKind;
};

/** The guest's published daily Moment (eligible for bottle discovery). */
export type GuestMoment = {
  id: string;
  text: string;
  dayKey: string;
  updatedAt: string;
  /** When true, eligible to appear on another traveler's bottle scan. */
  bottleEligible: boolean;
  sender: MomentSender;
};

export type MomentInspiration = {
  id: string;
  line: string;
  mood?: string;
};

/** Active bottle-scan session (Mode A Moment or Mode B Local Friend). */
export type BottleScanMode = "moment" | "local_friend";

export type BottleScanSession = {
  id: string;
  mode: BottleScanMode;
  quote: string;
  createdAt: string;
  /** Hidden until reveal. */
  sender: MomentSender;
  revealed: boolean;
  /** Mode A — published moment id. */
  momentId?: string;
  /** When the Moment belongs to a Local banDit (bottle→QR→profile loop). */
  banditId?: string;
  /** Mode B — ocean float + claim notification. */
  floatId?: string;
  notificationId?: string;
  /** Chat thread once reply starts. */
  chatThreadId?: string;
};

/** History of Moments shown to / received by this guest. */
export type MomentHistoryEntry = {
  id: string;
  quote: string;
  mode: BottleScanMode;
  receivedAt: string;
  sender: MomentSender;
  revealed: boolean;
  replied: boolean;
  chatThreadId?: string;
  momentId?: string;
  floatId?: string;
};

export const GUEST_MOMENT_CHAT_TYPE = "guest_moment" as const;
export const GUEST_MOMENT_THREAD_REF = "guest_moment_thread" as const;
