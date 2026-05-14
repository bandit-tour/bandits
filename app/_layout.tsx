import * as React from 'react';
import { Stack } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { trackEvent } from '@/lib/analytics';
import { AppStateProvider } from '@/contexts/AppStateContext';
import { CityProvider } from '@/contexts/CityContext';
import { bootstrapMainAppSession } from '@/lib/pilotSession';
import { bootstrapExploreEventsCache } from '@/lib/exploreEventsCache';

export default function RootLayout() {
  React.useEffect(() => {
    void trackEvent({ eventName: 'app_opened', onceKey: 'app_opened' });
  }, []);

  /** Run before/at same time as hotel / tabs — avoids anon replacing a slow‑hydrating operator session on web. */
  React.useEffect(() => {
    void bootstrapMainAppSession();
    void bootstrapExploreEventsCache();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AppStateProvider>
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
