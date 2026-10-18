/**
 * Localism volunteering — Guest discovers verified nonprofit slots from Workspace.
 * Free. Completions credit personal Impact ledger via recordVerifiedImpact (+6).
 * Editorial IMPACT_VIEW.volunteer rows stay inspiration-only until partners are live.
 */
import { recordVerifiedImpact } from "@/lib/impact/ledger";
import { workspaceGet, workspacePost } from "@/lib/workspace/client";

export type GuestVolunteerOpportunity = {
  id: string;
  title: string;
  description: string;
  requirements: string;
  destination: string;
  city: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  seatsLeft: number;
  status: string;
  demo: boolean;
  organizationId: string;
  organizationName: string;
  organizationStory?: string;
  free: boolean;
  dropsOnCompletion: number;
  joinable: boolean;
};

export type GuestVolunteerRegistration = {
  id: string;
  opportunityId: string;
  organizationId: string;
  guestEmail: string;
  guestName: string;
  status: string;
  registeredAt: string;
  impactEventId: string;
  dropEventId?: string;
  opportunityTitle?: string;
  city?: string;
  destination?: string;
  startsAt?: string;
  endsAt?: string;
  organizationName?: string;
  dropsOnCompletion?: number;
  credited?: boolean;
};

export async function fetchVolunteerOpportunities(
  city = "Athens",
  guestEmail?: string | null,
): Promise<{ ok: boolean; opportunities: GuestVolunteerOpportunity[]; detail?: string }> {
  const res = await workspaceGet<{
    ok?: boolean;
    opportunities?: GuestVolunteerOpportunity[];
    error?: string;
  }>(`/api/public/impact/volunteer?city=${encodeURIComponent(city)}`, guestEmail);
  if (!res.ok) return { ok: false, opportunities: [], detail: res.detail };
  return {
    ok: true,
    opportunities: Array.isArray(res.data.opportunities) ? res.data.opportunities : [],
  };
}

export async function fetchMyVolunteerRegistrations(
  guestEmail: string,
): Promise<{ ok: boolean; registrations: GuestVolunteerRegistration[]; detail?: string }> {
  const res = await workspaceGet<{
    ok?: boolean;
    registrations?: GuestVolunteerRegistration[];
  }>("/api/public/impact/volunteer?mine=1", guestEmail);
  if (!res.ok) return { ok: false, registrations: [], detail: res.detail };
  return {
    ok: true,
    registrations: Array.isArray(res.data.registrations) ? res.data.registrations : [],
  };
}

export async function joinVolunteerOpportunity(
  opportunityId: string,
  guestEmail: string,
): Promise<{ ok: boolean; registration?: GuestVolunteerRegistration; detail?: string }> {
  const res = await workspacePost<{
    ok?: boolean;
    registration?: GuestVolunteerRegistration;
    error?: string;
  }>("/api/public/impact/volunteer", { action: "join", opportunityId }, guestEmail);
  if (!res.ok) return { ok: false, detail: res.detail };
  if (!res.data.ok) return { ok: false, detail: res.data.error || "Join failed" };
  return { ok: true, registration: res.data.registration };
}

export async function cancelVolunteerRegistration(
  registrationId: string,
  guestEmail: string,
): Promise<{ ok: boolean; detail?: string }> {
  const res = await workspacePost<{ ok?: boolean; error?: string }>(
    "/api/public/impact/volunteer",
    { action: "cancel", registrationId },
    guestEmail,
  );
  if (!res.ok) return { ok: false, detail: res.detail };
  if (!res.data.ok) return { ok: false, detail: res.data.error || "Cancel failed" };
  return { ok: true };
}

/**
 * When Workspace has confirmed attendance (status attended), mirror +6 into
 * the Guest personal ledger exactly once (idempotent by impactEventId).
 */
export async function syncVolunteerDropsToLedger(input: {
  userId: string;
  guestEmail: string;
}): Promise<{ synced: number; events: string[] }> {
  const mine = await fetchMyVolunteerRegistrations(input.guestEmail);
  if (!mine.ok) return { synced: 0, events: [] };
  const attended = mine.registrations.filter(
    (r) => r.status === "attended" && Boolean(r.dropEventId) && r.impactEventId,
  );
  let synced = 0;
  const events: string[] = [];
  for (const r of attended) {
    const result = await recordVerifiedImpact({
      userId: input.userId,
      eventId: r.impactEventId,
      kind: "verified_volunteer_completion",
      city: r.city || "Athens",
      title: r.opportunityTitle || "Completed verified volunteering",
      evidence: `Organization confirmed attendance${
        r.organizationName ? ` · ${r.organizationName}` : ""
      }. Free volunteering · +6 Drops.`,
    });
    if (result.created) {
      synced += 1;
      events.push(result.event.id);
    }
  }
  return { synced, events };
}

export function formatVolunteerWhen(startsAt: string, endsAt: string): string {
  try {
    const s = new Date(startsAt);
    const e = new Date(endsAt);
    const day = s.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const t0 = s.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    const t1 = e.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    return `${day} · ${t0}–${t1}`;
  } catch {
    return startsAt;
  }
}
