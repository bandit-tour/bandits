import { DeviceEventEmitter } from 'react-native';

export const BANDITS_NOTIFICATIONS_REFRESH = 'bandits_notifications_refresh_v1';

/** Call after inserts that must update inbox / badge without waiting for the 10s poll. */
export function requestNotificationsRefresh(): void {
  try {
    DeviceEventEmitter.emit(BANDITS_NOTIFICATIONS_REFRESH);
  } catch {
    /* ignore */
  }
}
