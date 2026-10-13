import { ALUMA_ONBOARDING_STEPS, type AlumaOnboardingStepDef } from '@/lib/alumaOnboarding';
import { pickRandomBanditMoment, pickSignalBankMoment } from '@/lib/banditMoments';
import { claimLocalFriendOceanFloat, type OceanFloatClaimResult } from '@/lib/localFriendOcean';
import { requestNotificationsRefresh } from '@/lib/notificationEvents';
import { ensureAnonymousSession } from '@/lib/pilotSession';
import { getOrCreateFlipSessionKey, dayBucketUtc } from '@/lib/signals';

export const BOTTLE_QR_LOCAL_FRIEND_SUBLINE = 'Find out who sent it inside bandiTour.' as const;

export const BOTTLE_QR_MOMENT_SUBLINE =
  'A Moment from another traveler — see who sent this inside bandiTour.' as const;

export type BottleQrSource = 'local_friend' | 'bandit_moment';

export type BottleQrHookResult = {
  source: BottleQrSource;
  quote: string;
  hookSubline: string;
  banditId?: string;
  banditName?: string;
  floatId?: string;
  notificationId?: string;
};

export function buildBottleQrSteps(hookSubline: string): readonly AlumaOnboardingStepDef[] {
  return [
    {
      ...ALUMA_ONBOARDING_STEPS[0],
      subline: hookSubline,
    },
    ALUMA_ONBOARDING_STEPS[1],
  ] as const;
}

/** Default steps before async hook resolves (overridden in bottle screen). */
export const BOTTLE_QR_STEPS: readonly AlumaOnboardingStepDef[] = buildBottleQrSteps(
  BOTTLE_QR_LOCAL_FRIEND_SUBLINE,
);

function mapOceanClaim(row: OceanFloatClaimResult): BottleQrHookResult | null {
  const quote = String(row.message || '').trim();
  if (!row.ok || !quote) return null;

  if (row.source === 'bandit_moment') {
    return {
      source: 'bandit_moment',
      quote,
      hookSubline: BOTTLE_QR_MOMENT_SUBLINE,
      banditId: row.banditId || undefined,
      banditName: row.banditName || undefined,
    };
  }

  return {
    source: 'local_friend',
    quote,
    hookSubline: BOTTLE_QR_LOCAL_FRIEND_SUBLINE,
    floatId: row.floatId,
    notificationId: row.notificationId,
  };
}

async function fallbackBanditMoment(seed: string): Promise<BottleQrHookResult> {
  const moment = (await pickRandomBanditMoment(seed)) ?? pickSignalBankMoment(seed);
  return {
    source: 'bandit_moment',
    quote: moment.body,
    hookSubline: BOTTLE_QR_MOMENT_SUBLINE,
    banditId: moment.banditId || undefined,
    banditName: moment.banditName || undefined,
  };
}

/**
 * Priority: floating Local Friend → random banDit Moment → signal bank.
 * The ocean is never empty on the scan hook.
 */
export async function resolveBottleQrHook(): Promise<BottleQrHookResult> {
  await ensureAnonymousSession().catch(() => undefined);
  const seed = `${await getOrCreateFlipSessionKey()}:${dayBucketUtc()}`;

  const claim = await claimLocalFriendOceanFloat();
  if (claim.notificationId) {
    requestNotificationsRefresh();
  }

  const fromOcean = mapOceanClaim(claim);
  if (fromOcean) return fromOcean;

  return fallbackBanditMoment(seed);
}

/** @deprecated Use resolveBottleQrHook — quote only. */
export async function resolveBottleQrSignalLine(): Promise<string> {
  const hook = await resolveBottleQrHook();
  return hook.quote;
}
