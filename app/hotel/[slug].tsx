import { normalizeHotelSlug } from '@/lib/hotelWhiteLabel';
import { useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';

import { HotelEntryScreen } from './HotelEntryScreen';

/** Dynamic hotel entry: `/hotel/:slug` — aliases (e.g. `nyx-theatrou` → `nyx-athens`) via `normalizeHotelSlug`. */
export default function HotelEntryBySlug() {
  const { slug: rawSlug } = useLocalSearchParams<{ slug: string | string[] }>();
  const slugNorm = useMemo(() => {
    const s = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
    return normalizeHotelSlug(String(s ?? ''));
  }, [rawSlug]);

  return <HotelEntryScreen slug={slugNorm} />;
}
