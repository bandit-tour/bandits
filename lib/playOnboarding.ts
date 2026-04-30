import { ALUMA_ONBOARDING_STEPS, type AlumaOnboardingStepDef } from './alumaOnboarding';

/**
 * PLAY Theatrou uses the same approved onboarding **sequence and card copy** as ALUMA.
 * Venue/brand difference is only visual: `getHotelWhiteLabel('play-theatrou')` (logo, hero, etc.).
 * Do not fork step definitions — update `alumaOnboarding` / `ALUMA_ONBOARDING_STEPS` for both brands.
 */
export const PLAY_ONBOARDING_STEPS: readonly AlumaOnboardingStepDef[] = ALUMA_ONBOARDING_STEPS;

export type { AlumaOnboardingStepDef as PlayOnboardingStepDef } from './alumaOnboarding';
