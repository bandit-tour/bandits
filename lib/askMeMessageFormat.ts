/**
 * Traveler’s inbox copy of an Ask — points at the operator’s thread root (`reference_id` = root notif id).
 * Pilot Desk only loads `user_id = operator`, so these rows never appear on the desk.
 */
export const BANDIT_QUESTION_GUEST_ECHO_REF = 'bandit_question_guest_echo' as const;

/**
 * Ask Me: title holds the human sender; `message` starts with an "About" line
 * for Pilot Desk / history (and trigger uses `ask_target_bandit_id` for persona).
 */

export function buildAskMeNotificationMessage(banditDisplayName: string, question: string): string {
  const about = (banditDisplayName || 'banDit').trim() || 'banDit';
  return `About: ${about}\n\n${(question || '').trim()}`;
}

export function parseAboutBanditFromAskMessage(message: string): string | null {
  const m = String(message || '').match(/^About:\s*(.+?)(?:\r\n|\n)/);
  return m ? m[1].trim() : null;
}

export function bodyAfterAskMeAboutLine(message: string): string {
  return String(message || '')
    .replace(/^About:\s*[^\n]+(?:\r\n|\n)(?:\r\n|\n)?/m, '')
    .trim();
}

export function travelerNameForAskMeTitle(
  fromProfile: string,
  fromMeta: { full_name?: unknown; name?: unknown },
): string {
  const metaName =
    (typeof fromMeta.full_name === 'string' && fromMeta.full_name.trim()) ||
    (typeof fromMeta.name === 'string' && fromMeta.name.trim()) ||
    '';
  const t = (fromProfile || metaName).trim();
  return t || 'Traveler';
}

/** Single source of truth for post-submit copy on the Ask Local banDit modal (guest-facing). */
export function formatAskMeSubmitSuccessMessage(banditDisplayName: string): string {
  void banditDisplayName;
  return 'Your local banDit will reply soon.';
}

export function formatAskMeModalSubtitle(banditDisplayName: string): string {
  const name = (banditDisplayName || '').trim() || 'this host';
  return `Ask anything about the city, spots, or vibes. ${name} gets your question — you’ll see your message in Chat, and replies there too.`;
}
