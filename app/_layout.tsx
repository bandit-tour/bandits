import * as React from 'react';
import { Stack } from 'expo-router';
import { trackEvent } from '@/lib/analytics';
import { AppStateProvider } from '@/contexts/AppStateContext';
import { CityProvider } from '@/contexts/CityContext';
import { bootstrapMainAppSession } from '@/lib/pilotSession';

export default function RootLayout() {
  React.useEffect(() => {
    void trackEvent({ eventName: 'app_opened', onceKey: 'app_opened' });
  }, []);

  /** Run before/at same time as hotel / tabs — avoids anon replacing a slow‑hydrating operator session on web. */
  React.useEffect(() => {
    void bootstrapMainAppSession();
  }, []);

  return (
    <AppStateProvider>
      <CityProvider>
        <Stack
          initialRouteName="index"
          screenOptions={{ headerShown: false }}
        />
      </CityProvider>
    </AppStateProvider>
  );
}
