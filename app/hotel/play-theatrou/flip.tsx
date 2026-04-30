import React from 'react';

import { HotelEntryScreen } from '../HotelEntryScreen';

/** Double-sided message — used after `PlayTheatrouHotelIntro` on iOS/web; Android uses `/hotel/play-theatrou` only. */
export default function PlayTheatrouFlipPage() {
  return <HotelEntryScreen slug="play-theatrou" />;
}
