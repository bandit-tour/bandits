import { getAlumaOnboardingComplete } from '@/lib/alumaOnboarding';
import { isKnownHotelSlug } from '@/lib/hotelWhiteLabel';
import { useAndroidWebBackGuard } from '@/lib/useAndroidWebBackGuard';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

export default function HotelSlugExperienceScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug?: string | string[] }>();
  const slugNorm = String(Array.isArray(slug) ? slug[0] : slug ?? '')
    .trim()
    .toLowerCase();
  const safeSlug = isKnownHotelSlug(slugNorm) ? slugNorm : 'play-theatrou';

  useAndroidWebBackGuard(`/hotel/${safeSlug}/flip`);

  React.useEffect(() => {
    if (safeSlug !== 'aluma-athens') return;
    let cancelled = false;
    void (async () => {
      const done = await getAlumaOnboardingComplete();
      if (cancelled) return;
      if (done) router.replace('/bandits');
      else router.replace('/hotel/aluma-athens');
    })();
    return () => {
      cancelled = true;
    };
  }, [router, safeSlug]);

  if (safeSlug === 'aluma-athens') {
    return <View style={{ flex: 1, backgroundColor: '#0A0908' }} />;
  }

  return <Redirect href={`/hotel/${safeSlug}` as never} />;
}
