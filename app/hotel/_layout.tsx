import { Stack } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';

/**
 * `/hotel/*` lives outside `(tabs)`: no bottom nav, no main-app chrome until
 * the guest route explicitly navigates into the app.
 */
export default function HotelGroupLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        // Solid base so a paint never reads as a white flash on PWA.
        contentStyle: styles.hotelContent,
        gestureEnabled: false,
      }}
    />
  );
}

const styles = StyleSheet.create({
  hotelContent: {
    flex: 1,
    backgroundColor: '#0B0F18',
  },
});
