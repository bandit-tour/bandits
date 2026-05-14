import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef } from 'react';
import { DeviceEventEmitter } from 'react-native';

import { BANDITS_NOTIFICATIONS_REFRESH } from '@/lib/notificationEvents';
import { supabase } from '@/lib/supabase';

export const BANDITS_SCAM_ALERTS_REFRESH = 'bandits_scam_alerts_refresh_v1';

/** Call after Pilot Desk deletes/hides a report or when feeds must reload. */
export function requestScamAlertsRefresh(): void {
  try {
    DeviceEventEmitter.emit(BANDITS_SCAM_ALERTS_REFRESH);
    DeviceEventEmitter.emit(BANDITS_NOTIFICATIONS_REFRESH);
  } catch {
    /* ignore */
  }
}

export type ScamAlertsReloadOpts = {
  /** Focus / realtime refresh — avoid full-screen loading spinners. */
  silent?: boolean;
};

/**
 * Refetch bandiTEAM feeds when:
 * - the screen gains focus (cross-device sync after Pilot Desk delete in browser)
 * - a local delete/moderation emits `requestScamAlertsRefresh`
 * - `scam_alerts` changes in Postgres (while app is open)
 */
export function useScamAlertsFeedRefresh(
  reload: (opts?: ScamAlertsReloadOpts) => void | Promise<void>,
): void {
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useFocusEffect(
    useCallback(() => {
      void reloadRef.current({ silent: true });
    }, []),
  );

  useEffect(() => {
    const onRefresh = () => void reloadRef.current({ silent: true });
    const subs = [
      DeviceEventEmitter.addListener(BANDITS_SCAM_ALERTS_REFRESH, onRefresh),
      DeviceEventEmitter.addListener(BANDITS_NOTIFICATIONS_REFRESH, onRefresh),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('banditeam_scam_alerts_feed_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scam_alerts' }, () => {
        void reloadRef.current({ silent: true });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);
}
