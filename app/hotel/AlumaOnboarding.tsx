import {
  ALUMA_ONBOARDING_STEPS,
  getAlumaOnboardingComplete,
  setAlumaOnboardingComplete,
} from '@/lib/alumaOnboarding';
import { ALUMA_ATHENS_SLUG } from '@/lib/pilotSession';
import React, { useCallback } from 'react';

import { HotelOnboardingFlow } from './HotelOnboardingFlow';

/**
 * ALUMA hotel: bottle message → gift → app home (tabs). Sender only in Notifications → chat.
 * Implementation is shared with PLAY (`HotelOnboardingFlow`); only slug + completion flags differ.
 */
export default function AlumaOnboarding() {
  const shouldSkipIntro = useCallback(() => getAlumaOnboardingComplete(), []);
  const markOnboardingComplete = useCallback(async () => {
    await setAlumaOnboardingComplete(true);
  }, []);

  return (
    <HotelOnboardingFlow
      hotelSlug={ALUMA_ATHENS_SLUG}
      steps={ALUMA_ONBOARDING_STEPS}
      shouldSkipIntro={shouldSkipIntro}
      markOnboardingComplete={markOnboardingComplete}
      backGuardPath={`/hotel/${ALUMA_ATHENS_SLUG}`}
    />
  );
}
