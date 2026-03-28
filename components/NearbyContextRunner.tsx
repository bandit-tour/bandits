import { useEffect, useRef } from 'react';
import { AppState, DeviceEventEmitter } from 'react-native';

import { runNearbyContextScan } from '@/services/nearbyContextScan';

const EMIT = 'nearby_inbox_updated';

/** Slight delay before the first scan so the system location prompt is not the first thing on cold start. */
const FIRST_SCAN_DELAY_MS = 4000;

/**
 * Foreground-only nearby checks (pilot): throttled in the scan service, no push.
 */
export default function NearbyContextRunner() {
  const firstDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        await runNearbyContextScan();
        DeviceEventEmitter.emit(EMIT);
      } catch (e) {
        console.warn('[NearbyContextRunner]', e);
      }
    };

    firstDelayRef.current = setTimeout(() => void run(), FIRST_SCAN_DELAY_MS);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void run();
    });
    const interval = setInterval(() => void run(), 12 * 60 * 1000);
    return () => {
      if (firstDelayRef.current) clearTimeout(firstDelayRef.current);
      sub.remove();
      clearInterval(interval);
    };
  }, []);

  return null;
}
