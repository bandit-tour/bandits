import { Stack } from 'expo-router';

/**
 * bandiTEAM hub + report form — outside `(tabs)` (no bottom nav).
 * Screens set Back / Menu / Home once via `useAppBackScreenOptions` (escapeShortcuts).
 */
export default function BandiTeamLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
