import { useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';

import { HotelEntryScreen } from './HotelEntryScreen';

/** Dynamic hotel entry: `/hotel/:slug` (e.g. future properties). PLAY Theatrou also has a static route. */
export default function HotelEntryBySlug() {
  const { slug: rawSlug } = useLocalSearchParams<{ slug: string | string[] }>();
  const slugNorm = useMemo(() => {
    const s = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
    return String(s ?? '')
      .trim()
      .toLowerCase();
  }, [rawSlug]);

  return <HotelEntryScreen slug={slugNorm} />;
}
