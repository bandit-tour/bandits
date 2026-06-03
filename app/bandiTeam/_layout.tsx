import { Stack } from 'expo-router';

/**
 * bandiTEAM hub + report form — outside `(tabs)` (no bottom nav).
 * Screens set their own headers via `useAppBackScreenOptions` + in-content `AppEscapeNav`.
 */
export default function BandiTeamLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
