const DISPLAY_NAME_MIN = 2;
const DISPLAY_NAME_MAX = 24;
const DISPLAY_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 .'\-_]*[A-Za-z0-9]$|^[A-Za-z0-9]$/;

export function normalizeDisplayName(value: string): string {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export function isSyntheticDisplayName(value: string): boolean {
  const n = normalizeDisplayName(value);
  if (!n) return true;
  if (/^guest(?:\s+[a-z0-9]{2,})?$/i.test(n)) return true;
  if (/^(user|test|demo)[\s_-]*\d+$/i.test(n)) return true;
  if (/@/.test(n)) return true;
  return false;
}

export function validateDisplayName(value: string): string | null {
  const n = normalizeDisplayName(value);
  if (n.length < DISPLAY_NAME_MIN) return 'Display name must be at least 2 characters.';
  if (n.length > DISPLAY_NAME_MAX) return 'Display name must be at most 24 characters.';
  if (!DISPLAY_NAME_RE.test(n)) return 'Use letters/numbers and simple punctuation only.';
  if (/(.)\1\1\1/.test(n)) return 'Please avoid repeated symbol spam.';
  return null;
}

