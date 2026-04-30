import { Stack } from 'expo-router';

/**
 * bandiTEAM hub + dedicated report form (dual-use). Full alerts-only feed stays on `/scam-alerts` and `/alerts`.
 */
export default function BandiTeamLayout() {
  return (
    <Stack screenOptions={{ headerShown: true, headerBackTitle: 'Back' }}>
      <Stack.Screen name="index" options={{ title: 'bandiTEAM' }} />
      <Stack.Screen
        name="report"
        options={{ title: 'Report alert', presentation: 'modal' }}
      />
    </Stack>
  );
}
