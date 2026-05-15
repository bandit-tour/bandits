import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';

/** Legacy route: open Explore with map visible (same data, no second screen push). */
export default function CityMapScreen() {
  const { banditId: rawBanditId } = useLocalSearchParams<{ banditId?: string }>();
  const banditId = Array.isArray(rawBanditId) ? rawBanditId[0] : rawBanditId;
  const q = new URLSearchParams({ view: 'map' });
  if (banditId) q.set('banditId', banditId);
  return <Redirect href={`/explore?${q.toString()}` as any} />;
}
