/**
 * Sync Guest App Trip OS ↔ Workspace authority.
 * Best-effort: local AsyncStorage remains offline-capable; Workspace is the CRM mirror.
 */

import { workspaceGet, workspacePost } from "@/lib/workspace/client";

import type { GuestLifecycleSnapshot } from "./types";

type WorkspaceLifecycleResponse = GuestLifecycleSnapshot & {
  ok?: boolean;
  error?: string;
};

export async function pullLifecycleFromWorkspace(
  guestEmail?: string | null,
): Promise<GuestLifecycleSnapshot | null> {
  const res = await workspaceGet<WorkspaceLifecycleResponse>("/api/guest/lifecycle", guestEmail);
  if (!res.ok || !res.data?.lifecycle) return null;
  return {
    lifecycle: res.data.lifecycle,
    activeStay: res.data.activeStay ?? null,
    stays: res.data.stays ?? [],
    cityMemory: res.data.cityMemory ?? [],
    recentEvents: res.data.recentEvents ?? [],
  };
}

export async function pushLifecycleAction(
  action: string,
  body: Record<string, unknown> = {},
  guestEmail?: string | null,
): Promise<GuestLifecycleSnapshot | null> {
  const res = await workspacePost<WorkspaceLifecycleResponse>(
    "/api/guest/lifecycle",
    { action, ...body },
    guestEmail,
  );
  if (!res.ok || !res.data?.lifecycle) return null;
  return {
    lifecycle: res.data.lifecycle,
    activeStay: res.data.activeStay ?? null,
    stays: res.data.stays ?? [],
    cityMemory: res.data.cityMemory ?? [],
    recentEvents: res.data.recentEvents ?? [],
  };
}

/** Mirror local transition onto Workspace (never blocks Guest UX). */
export function syncTransitionToWorkspace(
  action: string,
  body: Record<string, unknown> = {},
): void {
  void pushLifecycleAction(action, body).catch(() => {
    /* offline / workspace down */
  });
}
