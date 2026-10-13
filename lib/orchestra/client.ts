/**
 * Thin Orchestra OS / Partner HTTP client for Guest App consumption.
 * Never invents commercial truth — returns null / MISSING when unreachable.
 */

import { GUEST_APP_CANON } from "@/lib/orchestra/canon";

function env(key: string): string {
  const g = globalThis as { process?: { env?: Record<string, string | undefined> } };
  return String(g.process?.env?.[key] ?? g.process?.env?.[`EXPO_PUBLIC_${key}`] ?? "").trim();
}

export function orchestraOsOrigin(): string | null {
  const raw =
    env("ORCHESTRA_OS_URL") ||
    env("EXPO_PUBLIC_ORCHESTRA_OS_URL") ||
    "";
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

/** Partner Platform owns hotel tenants / white-label config (not Orchestra OS). */
const DEFAULT_PARTNER_PLATFORM_URL = "https://www.banditours.com";

export function partnerPlatformOrigin(): string | null {
  const raw =
    env("PARTNER_PLATFORM_URL") ||
    env("EXPO_PUBLIC_PARTNER_PLATFORM_URL") ||
    DEFAULT_PARTNER_PLATFORM_URL;
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

export type OrchestraFetchResult<T> =
  | { ok: true; data: T; source: "orchestra_os" | "partner" }
  | { ok: false; status: "MISSING" | "ERROR"; detail: string };

async function getJson<T>(url: string, source: "orchestra_os" | "partner"): Promise<OrchestraFetchResult<T>> {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      return { ok: false, status: "ERROR", detail: `${res.status} ${url}` };
    }
    const data = (await res.json()) as T;
    return { ok: true, data, source };
  } catch (e) {
    return {
      ok: false,
      status: "ERROR",
      detail: e instanceof Error ? e.message : "fetch failed",
    };
  }
}

export async function fetchLiveExperiencePreview(input: {
  assetId?: string;
  propertySlug?: string;
  visitorId?: string;
  destination?: string;
}): Promise<OrchestraFetchResult<unknown>> {
  const origin = orchestraOsOrigin();
  if (!origin) {
    return { ok: false, status: "MISSING", detail: "EXPO_PUBLIC_ORCHESTRA_OS_URL unset" };
  }
  // Prefer snapshot (stable). Optional resolve POST when Orchestra ships it.
  const snap = await getJson<{ ok?: boolean; snapshot?: unknown }>(
    `${origin}/api/live-experience`,
    "orchestra_os",
  );
  if (snap.ok) {
    return {
      ok: true,
      data: {
        snapshot: snap.data.snapshot ?? snap.data,
        context: {
          assetId: input.assetId ?? null,
          propertySlug: input.propertySlug ?? null,
          visitorId: input.visitorId ?? null,
          destination: input.destination ?? "Athens",
          consumer: GUEST_APP_CANON.product,
        },
      },
      source: "orchestra_os",
    };
  }
  return snap;
}

export async function fetchCommerceWallet(userId: string): Promise<OrchestraFetchResult<unknown>> {
  const origin = orchestraOsOrigin();
  if (!origin) {
    return { ok: false, status: "MISSING", detail: "EXPO_PUBLIC_ORCHESTRA_OS_URL unset" };
  }
  return getJson(`${origin}/api/commerce/wallet?user_id=${encodeURIComponent(userId)}`, "orchestra_os");
}

export async function fetchConnectionOsSnapshot(): Promise<OrchestraFetchResult<unknown>> {
  const origin = orchestraOsOrigin();
  if (!origin) {
    return { ok: false, status: "MISSING", detail: "EXPO_PUBLIC_ORCHESTRA_OS_URL unset" };
  }
  return getJson(`${origin}/api/connection-os`, "orchestra_os");
}
