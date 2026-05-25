import * as React from 'react';
import { Stack } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import PerfBootstrap from '@/components/PerfBootstrap';
import PushNotificationBootstrap from '@/components/PushNotificationBootstrap';
import { trackEvent } from '@/lib/analytics';
import { AppStateProvider } from '@/contexts/AppStateContext';
import { CityProvider } from '@/contexts/CityContext';
import { perfMark } from '@/lib/perfTiming';

export default function RootLayout() {
  React.useEffect(() => {
    perfMark('root_layout_mounted', 'launch');
    void trackEvent({ eventName: 'app_opened', onceKey: 'app_opened' });
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <PerfBootstrap />
      <SafeAreaProvider>
        <AppStateProvider>
          <PushNotificationBootstrap />
          <CityProvider>
            <Stack
              initialRouteName="index"
              screenOptions={{
                headerShown: false,
                headerBackTitle: 'Back',
                headerBackTitleVisible: Platform.OS === 'ios',
              }}
            />
          </CityProvider>
        </AppStateProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
