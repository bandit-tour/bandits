/**
 * Message-in-a-bottle (signal) threads: `notifications.title` holds the *sender name*,
 * `message` holds the *bottle line only*. Do not join title + message in the first bubble.
 */

import {
  isLocalFriendBottleInboxType,
  isLocalFriendOceanClaimRef,
} from '@/lib/localFriendOcean';

export function isSignalBottleInboxType(type: string | null | undefined): boolean {
  return String(type || '').trim() === 'signal_peer_delivery';
}

/** Travel in a Bottle — peer Local Friend float claimed via QR scan. */
export function isLocalFriendOceanBottleType(type: string | null | undefined): boolean {
  return isLocalFriendBottleInboxType(type);
}

export function isAnonymousBottleInboxRow(
  type: string | null | undefined,
  referenceType: string | null | undefined,
  title: string | null | undefined,
): boolean {
  if (isSignalBottleInboxType(type)) return true;
  if (!isLocalFriendOceanBottleType(type)) return false;
  if (!isLocalFriendOceanClaimRef(referenceType)) return false;
  const t = String(title || '').trim().toLowerCase();
  return t === 'message in a bottle' || t === '';
}

/** First bubble for signal = message field only. */
export function firstBubbleBodyForType(
  notifType: string | null | undefined,
  message: string,
  _title: string,
): string {
  if (isSignalBottleInboxType(notifType) || isLocalFriendOceanBottleType(notifType)) {
    return String(message || '').trim();
  }
  // Default: the payload text is the message; title is separate (name / subject).
  return String(message || '').trim();
}

/** Inbox / list preview line: always the bottle or reply body, not the sender name. */
export function inboxPreviewForType(notifType: string | null | undefined, message: string, title: string): string {
  if (isSignalBottleInboxType(notifType) || isLocalFriendOceanBottleType(notifType)) {
    return String(message || '').trim() || String(title || '').trim() || 'New message';
  }
  return String(message || '').trim() || String(title || '').trim() || 'New update';
}
