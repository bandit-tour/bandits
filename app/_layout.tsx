import { Stack } from 'expo-router';

/**
 * Minimal valid root for Expo Router: a navigator must render child routes.
 * A plain View/Text root breaks the navigation tree and can crash before first paint.
 */
export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
