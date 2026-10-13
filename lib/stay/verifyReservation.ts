import { partnerPlatformOrigin } from '@/lib/orchestra/client';
import { workspaceOrigin } from '@/lib/workspace/client';
import type { AttachedStay, StayLifecyclePhase } from '@/lib/stay/lifecycle';

export type VerifyUnlockResponse =
  | {
      ok: true;
      invitationId: string;
      hotelSlug: string;
      hotelName: string;
      hotelId: string;
      reservationNumber: string;
      guestEmail: string;
      guestFirstName: string;
      checkInDate: string;
      checkOutDate: string;
      lifecyclePhase: StayLifecyclePhase;
      accessToken: string;
      alreadyActivated: boolean;
      stay?: { attached: boolean; lifecyclePhase: StayLifecyclePhase };
    }
  | { ok: false; code?: string; error: string };

export type UnlockTokenResolve = {
  ok: true;
  hotelSlug: string;
  hotelName: string;
  guestFirstName: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  lifecyclePhase: StayLifecyclePhase;
  showReservationCode: string;
  instruction: string;
};

/** Prefer Partner Platform; fall back to Workspace Hotelier invitation engine. */
function unlockBases(): string[] {
  const bases: string[] = [];
  const partner = partnerPlatformOrigin()?.replace(/\/$/, '');
  const workspace = workspaceOrigin()?.replace(/\/$/, '');
  if (partner) bases.push(partner);
  if (workspace && workspace !== partner) bases.push(workspace);
  if (!bases.length && __DEV__) bases.push('http://localhost:3000');
  return bases;
}

export async function resolveUnlockToken(token: string): Promise<UnlockTokenResolve | null> {
  for (const base of unlockBases()) {
    try {
      const res = await fetch(`${base}/api/guest/unlock/${encodeURIComponent(token)}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const json = (await res.json()) as UnlockTokenResolve & { ok?: boolean; error?: string };
      if (res.ok && json.ok !== false && json.hotelSlug) return json as UnlockTokenResolve;
    } catch {
      /* try next origin */
    }
  }
  return null;
}

export async function verifyReservationUnlock(input: {
  hotelSlug: string;
  reservationNumber: string;
  accessToken?: string | null;
  guestEmail?: string | null;
}): Promise<VerifyUnlockResponse> {
  const bases = unlockBases();
  if (!bases.length) {
    return {
      ok: false,
      code: 'missing_config',
      error: 'Set EXPO_PUBLIC_PARTNER_PLATFORM_URL or EXPO_PUBLIC_WORKSPACE_URL',
    };
  }

  let lastError = 'Unlock verify failed';
  for (const base of bases) {
    try {
      const res = await fetch(`${base}/api/guest/unlock/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          hotelSlug: input.hotelSlug,
          reservationNumber: input.reservationNumber,
          accessToken: input.accessToken || undefined,
          guestEmail: input.guestEmail || undefined,
        }),
      });
      const json = (await res.json()) as VerifyUnlockResponse;
      if (json.ok) return json;
      lastError = (json as { error?: string }).error || `${res.status} ${base}`;
      // Try next origin if booking not found on this host
      if ((json as { code?: string }).code === 'invalid_booking') continue;
      if (!res.ok) continue;
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'Unlock verify failed';
    }
  }

  return { ok: false, error: lastError };
}

export function stayFromVerify(result: Extract<VerifyUnlockResponse, { ok: true }>): AttachedStay {
  return {
    hotelSlug: result.hotelSlug,
    hotelId: result.hotelId,
    hotelName: result.hotelName,
    reservationNumber: result.reservationNumber,
    invitationId: result.invitationId,
    accessToken: result.accessToken,
    guestEmail: result.guestEmail,
    guestFirstName: result.guestFirstName,
    checkInDate: result.checkInDate,
    checkOutDate: result.checkOutDate,
    lifecyclePhase: result.lifecyclePhase || 'PRE_TRIP',
    attachedAt: new Date().toISOString(),
  };
}
