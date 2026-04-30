/**
 * Message-in-a-bottle (signal) threads: `notifications.title` holds the *sender name*,
 * `message` holds the *bottle line only*. Do not join title + message in the first bubble.
 */

export function isSignalBottleInboxType(type: string | null | undefined): boolean {
  return String(type || '').trim() === 'signal_peer_delivery';
}

/** First bubble for signal = message field only. */
export function firstBubbleBodyForType(
  notifType: string | null | undefined,
  message: string,
  _title: string,
): string {
  if (isSignalBottleInboxType(notifType)) {
    return String(message || '').trim();
  }
  // Default: the payload text is the message; title is separate (name / subject).
  return String(message || '').trim();
}

/** Inbox / list preview line: always the bottle or reply body, not the sender name. */
export function inboxPreviewForType(notifType: string | null | undefined, message: string, title: string): string {
  if (isSignalBottleInboxType(notifType)) {
    return String(message || '').trim() || String(title || '').trim() || 'New message';
  }
  return String(message || '').trim() || String(title || '').trim() || 'New update';
}
