import { Stack } from 'expo-router';
import { Redirect } from 'expo-router';
import React from 'react';

/** Legacy route — redirects to Notifications tab (`/(tabs)/notifications`). */
export default function NotificationsLegacyRedirect() {
  return (
    <>
      <Stack.Screen options={{ title: 'Notifications' }} />
      <Redirect href="/notifications" />
    </>
  );
}
