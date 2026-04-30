/**
 * Coerce any runtime value to a plain string for `<Text>` children.
 * Prevents `[object Object]` when API/JSON returns nested objects.
 */
export function renderSafeText(value: unknown, fallback = ''): string {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return fallback;
    if (s === '[object Object]') return fallback;
    if (s.toLowerCase() === 'object object') return fallback;
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value
      .map((v) => renderSafeText(v, ''))
      .filter(Boolean)
      .join(', ');
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (typeof o.message === 'string') return renderSafeText(o.message, fallback);
    if (typeof o.text === 'string') return renderSafeText(o.text, fallback);
    if (typeof o.label === 'string') return renderSafeText(o.label, fallback);
    if (typeof o.title === 'string') return renderSafeText(o.title, fallback);
    if (typeof o.toString === 'function') {
      try {
        const s = (value as { toString: () => string }).toString();
        if (s && s !== '[object Object]') return s;
      } catch {
        /* ignore */
      }
    }
    return fallback;
  }
  return fallback;
}
