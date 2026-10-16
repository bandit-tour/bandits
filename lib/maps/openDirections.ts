/**
 * Open system maps to a verified lat/lng destination.
 * Kept separate from shopGeo so data modules stay free of React Native Linking.
 */
import { Linking, Platform } from "react-native";

export function pickupDirectionsUrl(lat: number, lng: number): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Platform.OS === "ios") {
    return `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=w`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export async function openPickupDirections(lat: number, lng: number): Promise<boolean> {
  const url = pickupDirectionsUrl(lat, lng);
  if (!url) return false;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
