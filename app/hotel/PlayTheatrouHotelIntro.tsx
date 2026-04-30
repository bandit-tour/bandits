import { PLAY_ONBOARDING_STEPS } from '@/lib/playOnboarding';
import { PLAY_THEATROU_SLUG } from '@/lib/pilotSession';
import { setPwaPlayTheatrouStage, shouldSkipPlayOnboarding } from '@/lib/pwaPlayTheatrouStage';
import React, { useCallback } from 'react';

import { HotelOnboardingFlow } from './HotelOnboardingFlow';

/** PLAY Theatrou — same onboarding system as `AlumaOnboarding`; brand via `HOTEL_WHITE_LABELS['play-theatrou']`. */
export default function PlayTheatrouHotelIntro() {
  const shouldSkipIntro = useCallback(() => shouldSkipPlayOnboarding(), []);
  const markOnboardingComplete = useCallback(async () => {
    setPwaPlayTheatrouStage('done');
  }, []);

  return (
    <HotelOnboardingFlow
      hotelSlug={PLAY_THEATROU_SLUG}
      steps={PLAY_ONBOARDING_STEPS}
      shouldSkipIntro={shouldSkipIntro}
      markOnboardingComplete={markOnboardingComplete}
      backGuardPath="/hotel/play-theatrou"
      testID="play-theatrou-full-intro"
    />
  );
}
