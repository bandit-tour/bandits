/** Heuristic: anonymous / cold-start fetches that should not break entire screens. */
export function isAuthOrMissingError(error: { message?: string; code?: string }): boolean {
  const code = String(error.code ?? '');
  const msg = String(error.message ?? '').toLowerCase();
  if (code === '401' || code === '403' || code === '404') return true;
  return /auth|jwt|permission denied|row-level security|rls|failed to fetch|not found/i.test(msg);
}
