import { Platform } from 'react-native';
import * as Location from 'expo-location';

/**
 * Best-effort foreground location for pilot "Around You".
 * Web: browser geolocation. Native: expo-location after permission.
 * Returns null if unavailable or denied — callers must degrade gracefully.
 */
export async function getPilotCurrentLocation(): Promise<{ lat: number; lng: number } | null> {
  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 },
      );
    });
  }

  const existing = await Location.getForegroundPermissionsAsync();
  if (existing.status !== Location.PermissionStatus.GRANTED) {
    const req = await Location.requestForegroundPermissionsAsync();
    if (req.status !== Location.PermissionStatus.GRANTED) {
      return null;
    }
  }

  try {
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}
