export * from "@/lib/travel-memory/types";
export * from "@/lib/travel-memory/store";
export {
  pickTravelMemoryImages,
  pickTravelMemoryVideo,
  persistTravelMedia,
  deleteTravelMediaFromStorage,
} from "@/lib/travel-memory/media";

/** True when a string looks like an internal UUID / hash — never show raw to guests. */
export function isInternalIdLabel(value: string | null | undefined): boolean {
  const s = String(value || "").trim();
  if (!s) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) {
    return true;
  }
  if (/^(bandit_|mem_|orch_|lexp_)/i.test(s) && s.length > 20) return true;
  return false;
}

export function humanBanditLabel(title: string | null | undefined, fallback = "Local banDit"): string {
  const t = String(title || "").trim();
  if (!t || isInternalIdLabel(t)) return fallback;
  return t;
}

export function pluralCount(n: number, singular: string, plural?: string): string {
  const p = plural || `${singular}s`;
  return n === 1 ? `1 ${singular}` : `${n} ${p}`;
}
