import * as React from 'react';
import { Stack } from 'expo-router';
import { trackEvent } from '@/lib/analytics';

export default function RootLayout() {
  React.useEffect(() => {
    void trackEvent({ eventName: 'app_opened', onceKey: 'app_opened' });
  }, []);

  return (
    <Stack
      initialRouteName="index"
      screenOptions={{ headerShown: false }}
    />
  );
}
