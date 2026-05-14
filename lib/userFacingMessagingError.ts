export const ASK_ME_SUCCESS_MESSAGE = 'Your question was sent successfully.';
export const LOCAL_FRIEND_SUCCESS_MESSAGE = 'Your message is now floating through the city.';

const DEFAULT_DELIVERY_ERROR =
  'Could not deliver your message right now. Please try again in a moment.';

const SENSITIVE_PATTERNS =
  /row-level security|violates .* policy|permission denied|42501|postgrest|supabase|jwt|pgrst|policy for table|sql state/i;

/** Never surface raw database / RLS errors to travelers. */
export function userFacingMessagingError(
  err: unknown,
  fallback: string = DEFAULT_DELIVERY_ERROR,
): Error {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const trimmed = raw.trim();
  if (!trimmed || SENSITIVE_PATTERNS.test(trimmed)) {
    return new Error(fallback);
  }
  if (trimmed === 'messaging_api_missing' || trimmed === 'Session required.') {
    return new Error(fallback);
  }
  return new Error(trimmed.slice(0, 220));
}

export function mapOperatorApiHttpError(status: number, bodyError?: string): string {
  if (status === 503) {
    return 'Messaging is temporarily unavailable. Please try again in a moment.';
  }
  if (status === 401) {
    return 'Your session expired. Close and reopen the app, then try again.';
  }
  const msg = String(bodyError ?? '').trim();
  if (msg && !SENSITIVE_PATTERNS.test(msg)) {
    return msg.slice(0, 220);
  }
  return DEFAULT_DELIVERY_ERROR;
}
