/**
 * Guest stay lifecycle — invitation unlock attaches PRE_TRIP before arrival.
 * Coordinated with Partner Platform Guest Invitations + after-checkout agent.
 */

export type StayLifecyclePhase =
  | 'NONE'
  | 'PRE_TRIP'
  | 'CHECK_IN_DAY'
  | 'ACTIVE_STAY'
  | 'CHECKOUT'
  | 'AFTER_TRIP';

export type AttachedStay = {
  hotelSlug: string;
  hotelId: string;
  hotelName: string;
  reservationNumber: string;
  invitationId: string;
  accessToken: string;
  guestEmail: string;
  guestFirstName: string;
  checkInDate: string;
  checkOutDate: string;
  lifecyclePhase: StayLifecyclePhase;
  attachedAt: string;
};

export const PRE_TRIP_CAPABILITIES = [
  'discover_destination',
  'follow_bandits',
  'save_places',
  'experiences',
  'bottle_planning',
] as const;

export function suggestPhaseFromDates(
  checkInIso: string,
  checkOutIso: string,
  now = new Date(),
): StayLifecyclePhase {
  const start = new Date(checkInIso);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(checkOutIso);
  end.setUTCHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'PRE_TRIP';
  if (today < start) return 'PRE_TRIP';
  if (today.getTime() === start.getTime()) return 'CHECK_IN_DAY';
  if (today > start && today < end) return 'ACTIVE_STAY';
  if (today.getTime() === end.getTime()) return 'CHECKOUT';
  if (today > end) return 'AFTER_TRIP';
  return 'PRE_TRIP';
}

export function isPreTrip(phase: StayLifecyclePhase): boolean {
  return phase === 'PRE_TRIP';
}

export function isInHouse(phase: StayLifecyclePhase): boolean {
  return phase === 'CHECK_IN_DAY' || phase === 'ACTIVE_STAY';
}
