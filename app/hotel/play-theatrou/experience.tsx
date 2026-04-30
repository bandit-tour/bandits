import { PLAY_THEATROU_SLUG } from '@/lib/pilotSession';
import { useAndroidWebBackGuard } from '@/lib/useAndroidWebBackGuard';
import { Redirect } from 'expo-router';
import React from 'react';

/**
 * Canonical PLAY onboarding lives at `/hotel/play-theatrou`.
 * Keep this route as compatibility alias only.
 */
export default function HotelPlayExperienceScreen() {
  useAndroidWebBackGuard(`/hotel/${PLAY_THEATROU_SLUG}/flip`);

  return <Redirect href="/hotel/play-theatrou" />;
}
