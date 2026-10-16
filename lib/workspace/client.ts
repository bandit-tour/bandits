/**
 * Workspace System HTTP bridge — Guest App consumes operator data from here.
 * Origin: EXPO_PUBLIC_WORKSPACE_URL (banditour workspace system) or ORCHESTRA_OS_URL.
 */

function env(key: string): string {
  const g = globalThis as { process?: { env?: Record<string, string | undefined> } };
  return String(g.process?.env?.[key] ?? g.process?.env?.[`EXPO_PUBLIC_${key}`] ?? "").trim();
}

export function workspaceOrigin(): string | null {
  /**
   * Web localhost: same-origin Metro/Vercel proxy avoids CORS emptying
   * Experiences / public inventories in the browser (Workspace blocks localhost origins).
   */
  try {
    if (typeof window !== "undefined" && window.location?.origin) {
      const host = String(window.location.hostname || "");
      if (host === "localhost" || host === "127.0.0.1") {
        return `${window.location.origin}/__workspace`;
      }
    }
  } catch {
    /* SSR / native */
  }

  const raw =
    env("WORKSPACE_URL") ||
    env("EXPO_PUBLIC_WORKSPACE_URL") ||
    "";
  if (!raw) {
    /** Local default when developing both apps side-by-side. */
    if (__DEV__) return "http://localhost:3000";
    /**
     * Production Guest App must always reach Workspace for Octopus / Premium Insights.
     * Expo web export can omit EXPO_PUBLIC_* if Vercel env is missing — never blank out identity.
     */
    return "https://banditour-workspace.vercel.app";
  }
  return raw.replace(/\/$/, "");
}

/**
 * Commerce payments / entitlements / experience book — Orchestra OS when set,
 * otherwise Workspace (which mirrors commerce routes for Guest bridge).
 * Production must never return null: empty EXPO_PUBLIC_* on Vercel used to gate
 * Stay Pass with "Checkout unavailable" / Failed to fetch.
 */
export function commerceOrigin(): string | null {
  const raw =
    env("ORCHESTRA_OS_URL") ||
    env("EXPO_PUBLIC_ORCHESTRA_OS_URL") ||
    env("WORKSPACE_URL") ||
    env("EXPO_PUBLIC_WORKSPACE_URL") ||
    "";
  if (!raw) {
    /** Same production fallback as workspaceOrigin — commerce is Workspace-hosted. */
    return workspaceOrigin();
  }
  return raw.replace(/\/$/, "");
}

export function guestBridgeHeaders(guestEmail?: string | null): Record<string, string> {
  const email = String(guestEmail || env("GUEST_BRIDGE_EMAIL") || "guest@banditour.demo").trim();
  const secret = env("GUEST_BRIDGE_SECRET") || "banditour-guest-bridge-2026";
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Guest-Email": email,
    "X-Guest-Bridge": secret,
  };
  /** Localhost Guest QA requests TEST_DEMO Octopus surfaces (never LIVE). */
  try {
    if (typeof window !== "undefined") {
      const host = String(window.location.hostname || "");
      if (host === "localhost" || host === "127.0.0.1") headers["X-Guest-QA"] = "1";
    }
  } catch {
    /* native */
  }
  if (env("EXPO_PUBLIC_GUEST_QA_OCTOPUS") === "1") headers["X-Guest-QA"] = "1";
  return headers;
}

export type WorkspaceFetchResult<T> =
  | { ok: true; data: T; origin: string }
  | { ok: false; detail: string };

export async function workspaceGet<T>(
  path: string,
  guestEmail?: string | null,
): Promise<WorkspaceFetchResult<T>> {
  const origin = workspaceOrigin();
  if (!origin) return { ok: false, detail: "WORKSPACE_URL unset" };
  try {
    const res = await fetch(`${origin}${path.startsWith("/") ? path : `/${path}`}`, {
      headers: guestBridgeHeaders(guestEmail),
    });
    if (!res.ok) return { ok: false, detail: `${res.status} ${path}` };
    return { ok: true, data: (await res.json()) as T, origin };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "fetch failed" };
  }
}

export async function workspacePost<T>(
  path: string,
  body: Record<string, unknown>,
  guestEmail?: string | null,
): Promise<WorkspaceFetchResult<T>> {
  const origin = workspaceOrigin();
  if (!origin) return { ok: false, detail: "WORKSPACE_URL unset" };
  try {
    const res = await fetch(`${origin}${path.startsWith("/") ? path : `/${path}`}`, {
      method: "POST",
      headers: guestBridgeHeaders(guestEmail),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        ok: false,
        detail: (err as { error?: string }).error || `${res.status} ${path}`,
      };
    }
    return { ok: true, data: (await res.json()) as T, origin };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "fetch failed" };
  }
}

/** Guest-facing commerce errors — never leak env var names. */
function guestCommerceDetail(raw: string): string {
  const s = String(raw || "");
  if (/ORCHESTRA|WORKSPACE_URL|EXPO_PUBLIC_|unset/i.test(s)) {
    return "Purchases aren’t available yet. City Guide and Ask Me stay free.";
  }
  return s || "Commerce temporarily unavailable.";
}

/** Commerce GET — Orchestra OS preferred. */
export async function commerceGet<T>(
  path: string,
  guestEmail?: string | null,
): Promise<WorkspaceFetchResult<T>> {
  const origin = commerceOrigin();
  if (!origin) {
    return {
      ok: false,
      detail: "Purchases aren’t available yet. City Guide and Ask Me stay free.",
    };
  }
  try {
    const res = await fetch(`${origin}${path.startsWith("/") ? path : `/${path}`}`, {
      headers: guestBridgeHeaders(guestEmail),
    });
    if (!res.ok) return { ok: false, detail: guestCommerceDetail(`${res.status} ${path}`) };
    return { ok: true, data: (await res.json()) as T, origin };
  } catch (e) {
    return {
      ok: false,
      detail: guestCommerceDetail(e instanceof Error ? e.message : "fetch failed"),
    };
  }
}

/** Commerce POST — Orchestra OS preferred. */
export async function commercePost<T>(
  path: string,
  body: Record<string, unknown>,
  guestEmail?: string | null,
): Promise<WorkspaceFetchResult<T>> {
  const origin = commerceOrigin();
  if (!origin) {
    return {
      ok: false,
      detail: "Purchases aren’t available yet. City Guide and Ask Me stay free.",
    };
  }
  try {
    const res = await fetch(`${origin}${path.startsWith("/") ? path : `/${path}`}`, {
      method: "POST",
      headers: guestBridgeHeaders(guestEmail),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const raw =
        (err as { error?: string; errors?: string[] }).error ||
        (Array.isArray((err as { errors?: string[] }).errors) &&
          (err as { errors: string[] }).errors.join("; ")) ||
        `${res.status} ${path}`;
      return { ok: false, detail: guestCommerceDetail(String(raw)) };
    }
    return { ok: true, data: (await res.json()) as T, origin };
  } catch (e) {
    return {
      ok: false,
      detail: guestCommerceDetail(e instanceof Error ? e.message : "fetch failed"),
    };
  }
}

export type WorkspaceDiscover = {
  ok?: boolean;
  owner?: string;
  experiences?: Array<{ id: string; title: string; status: string }>;
  sessions?: Array<{
    id: string;
    seatsLeft: number;
    startsAt: string;
    experience: { title: string; priceCents: number };
  }>;
  bottleStays?: Array<{
    id: string;
    title: string;
    location: string;
    description: string;
    natureType: string;
    priceCentsPerNight: number;
    status: string;
  }>;
  partners?: unknown;
  bandiShop?: unknown;
  hotelier?: unknown;
  spots?: Array<{ id: string; title: string; neighborhood: string; body: string }>;
};

export async function fetchWorkspaceDiscover(): Promise<WorkspaceFetchResult<WorkspaceDiscover>> {
  return workspaceGet<WorkspaceDiscover>("/api/discover");
}
