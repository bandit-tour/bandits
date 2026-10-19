/**
 * Strip orchestration / QA stamps from guest-visible SmartTraveler copy.
 * Never append coupon or merchant ids to titles or business names.
 */

const TRAILING_STAMP =
  /\s+(?:orch|debug|qa|merchant|live|banditour)?[-_]?(?:mu[a-z0-9]{5,10}|mt[a-z0-9]{5,10}|muy[a-z0-9]{5,10}|m[a-z][a-z0-9]{5,10})$/i;

const TECHNICAL_ID_IN_COPY = /\bst_st_[a-z0-9_]+\b/gi;

/** True when a trailing token looks like an internal merchant / offer stamp. */
export function isSmartTravelerTechnicalSuffix(token: string): boolean {
  const t = token.trim().toLowerCase();
  if (!t) return false;
  if (/^(?:mu[a-z0-9]{5,10}|mt[a-z0-9]{5,10}|muy[a-z0-9]{5,10}|m[a-z][a-z0-9]{5,10})$/.test(t)) return true;
  if (/^(?:orch|debug|qa|merchant|live|banditour)[-_]?[a-z0-9]{4,12}$/.test(t)) return true;
  return false;
}

export function sanitizeSmartTravelerVisibleText(text: string | null | undefined): string {
  if (text == null) return "";
  let s = String(text).replace(TECHNICAL_ID_IN_COPY, " ").replace(/\s+/g, " ").trim();
  if (!s) return "";
  let prev = "";
  while (prev !== s) {
    prev = s;
    s = s.replace(TRAILING_STAMP, "").trim();
    const parts = s.split(/\s+/);
    if (parts.length > 1 && isSmartTravelerTechnicalSuffix(parts[parts.length - 1]!)) {
      parts.pop();
      s = parts.join(" ").trim();
    }
  }
  return s.replace(/\s{2,}/g, " ").trim();
}

export function sanitizeSmartTravelerBusinessName(name: string | null | undefined): string {
  return sanitizeSmartTravelerVisibleText(name);
}
