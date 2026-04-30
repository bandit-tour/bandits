import { useLocalSearchParams } from 'expo-router';
import React from 'react';

import { HotelEntryScreen } from '../HotelEntryScreen';

export default function HotelSlugFlipPage() {
  const { slug } = useLocalSearchParams<{ slug?: string | string[] }>();
  const slugNorm = Array.isArray(slug) ? slug[0] : slug;
  return <HotelEntryScreen slug={String(slugNorm ?? '')} />;
}
