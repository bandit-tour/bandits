/**
 * Optional hydrate on hotel entry / home — no redesign.
 * When Orchestra is unreachable, existing MVP white-label wins.
 */

import { isFeatureEnabled } from "@/lib/featureFlags";
import {
  buildGuestExperienceProjection,
  type GuestExperienceProjection,
} from "@/lib/orchestra/consume";

let cached: GuestExperienceProjection | null = null;
let cachedAt = 0;
const TTL_MS = 60_000;

export async function hydrateOrchestraGuestProjection(input?: {
  hotelSlug?: string | null;
  visitorId?: string | null;
  force?: boolean;
}): Promise<GuestExperienceProjection | null> {
  if (!isFeatureEnabled("ff_orchestra_guest_integration")) return null;
  const now = Date.now();
  if (!input?.force && cached && now - cachedAt < TTL_MS) return cached;
  try {
    const projection = await buildGuestExperienceProjection({
      hotelSlug: input?.hotelSlug,
      visitorId: input?.visitorId,
    });
    cached = projection;
    cachedAt = now;
    return projection;
  } catch {
    return cached;
  }
}

export function peekOrchestraGuestProjection(): GuestExperienceProjection | null {
  return cached;
}
