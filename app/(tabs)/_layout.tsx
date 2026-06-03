import { Stack, usePathname, useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MainBottomNav from '@/components/MainBottomNav';
import NearbyContextRunner from '@/components/NearbyContextRunner';
import UpperTabScreens from '@/components/UpperTabScreens';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAppState } from '@/contexts/AppStateContext';
import { useCity } from '@/contexts/CityContext';
import { UpperTabHostProvider } from '@/contexts/UpperTabHostContext';
import { preloadExploreEvents, bootstrapExploreEventsCache } from '@/lib/exploreEventsCache';
import {
  hasSeenOpeningIntro,
} from '@/lib/openingIntroStorage';
import {
  getLowerTabFromPath,
  getUpperTabFromPath,
  navigateLowerTab,
  navigateUpperTab,
  type LowerTabKey,
} from '@/lib/appNavigation';
import { bootstrapMainAppSession, syncPilotHotelProfileIfNeeded } from '@/lib/pilotSession';
import { perfMark, perfStart, perfTraceNavigationPress } from '@/lib/perfTiming';
import type { UpperTabKey } from '@/lib/upperTab';

export type { UpperTabKey } from '@/lib/upperTab';

export default function TabsLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { unreadCount, chatUnreadCount } = useAppState();
  const { selectedCity } = useCity();

  /** Warm Explore cache off the critical path — earlier on Android so first Explore tap is warm. */
  useEffect(() => {
    const delay = Platform.OS === 'android' ? 1800 : 1200;
    const timer = setTimeout(() => {
      void bootstrapExploreEventsCache(selectedCity || undefined);
    }, delay);
    return () => clearTimeout(timer);
  }, [selectedCity]);

  useEffect(() => {
    if (!selectedCity) return;
    const delay = Platform.OS === 'android' ? 2800 : 1800;
    const timer = setTimeout(() => {
      preloadExploreEvents(selectedCity);
    }, delay);
    return () => clearTimeout(timer);
  }, [selectedCity]);

  const lowerTab = getLowerTabFromPath(pathname) as LowerTabKey;
  const upperTab = getUpperTabFromPath(pathname);
  const showUpperTabs = upperTab !== null;
  const [optimisticUpperTab, setOptimisticUpperTab] = useState<UpperTabKey | null>(null);
  const displayUpperTab = (optimisticUpperTab ?? upperTab ?? 'bandits') as UpperTabKey;

  useEffect(() => {
    setOptimisticUpperTab(null);
  }, [pathname]);
  const tabColor = colorScheme === 'dark' ? '#0a7ea4' : '#0a7ea4';
  const inactiveColor = colorScheme === 'dark' ? '#A0A0A0' : '#777';
  /** Replace (not push) so the tab stack cannot grow and freeze navigation. */
  const goLowerTab = useCallback(
    (
      path:
        | '/bandits'
        | '/mySpots'
        | '/explore'
        | '/localFriend'
        | '/community'
        | '/alerts'
        | '/notifications'
        | '/menu',
      tab: LowerTabKey,
    ) => {
      perfTraceNavigationPress(`tab_lower:${tab}`, () => {
        if (tab === 'home') {
          setOptimisticUpperTab('bandits');
        }
        navigateLowerTab(router, path, tab, lowerTab);
      });
    },
    [lowerTab, router],
  );

  const goUpperTab = useCallback(
    (tab: UpperTabKey) => {
      perfTraceNavigationPress(`tab_upper:${tab}`, () => {
        setOptimisticUpperTab(tab);
        if (tab === 'explore') {
          preloadExploreEvents(selectedCity || undefined);
        }
        navigateUpperTab(router, tab);
      });
    },
    [router, selectedCity],
  );

  useEffect(() => {
    perfMark('tabs_layout_mounted', 'launch');
    const end = perfStart('bootstrap_main_session', 'launch');
    void (async () => {
      try {
        /** Waits for persisted email sessions to hydrate before anon — avoids wiping operator login on web. */
        await bootstrapMainAppSession();
        await syncPilotHotelProfileIfNeeded();
      } finally {
        end();
      }
    })();
  }, []);

  /** Warm upper-tab modules off the critical path so first tap is instant. */
  useEffect(() => {
    const delay = Platform.OS === 'android' ? 2000 : 2500;
    const timer = setTimeout(() => {
      void import('@/app/(tabs)/explore');
      void import('@/app/(tabs)/mySpots');
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  // Keep tabs routes stable on web; avoid intermediate blank shell during intro redirects.
  const webNeedIntroBounce = false;

  /**
   * Native: deep link to a tab on first install can skip `index` — same bounce to opening intro.
   */
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let a = true;
    void (async () => {
      const seen = await hasSeenOpeningIntro();
      if (!a || seen) return;
      router.replace('/' as Href);
    })();
    return () => {
      a = false;
    };
  }, [router]);

  return (
    <>
      <NearbyContextRunner />
      <UpperTabHostProvider enabled={showUpperTabs} active={displayUpperTab}>
      <View style={styles.container}>
        {showUpperTabs && (
          <View style={[styles.upperTabs, { paddingTop: Math.max(insets.top, 8) + 6 }]}>
            <UpperTabButton
              label="Local banDits"
              active={displayUpperTab === 'bandits'}
              onPress={() => goUpperTab('bandits')}
              color={tabColor}
              inactiveColor={inactiveColor}
            />
            <UpperTabButton
              label="My Spots"
              active={displayUpperTab === 'mySpots'}
              onPress={() => goUpperTab('mySpots')}
              color={tabColor}
              inactiveColor={inactiveColor}
            />
            <UpperTabButton
              label="Explore"
              active={displayUpperTab === 'explore'}
              onPress={() => goUpperTab('explore')}
              color={tabColor}
              inactiveColor={inactiveColor}
            />
          </View>
        )}

        <View style={styles.content} collapsable={false}>
          <Stack
            screenOptions={{
              headerShown: false,
              headerBackTitle: 'Back',
              headerBackTitleVisible: true,
              freezeOnBlur: true,
              contentStyle: { backgroundColor: '#FFFFFF' },
              ...Platform.select({
                web: { animation: 'fade' as const, animationDuration: 120 },
                default: { animation: 'none' as const },
              }),
            }}
          />
          {showUpperTabs ? (
            <View style={styles.upperTabOverlay} pointerEvents="box-none">
              <UpperTabScreens active={displayUpperTab} />
            </View>
          ) : null}
        </View>

        <View style={styles.bottomNavBar} collapsable={false}>
          <MainBottomNav
            activeTab={lowerTab}
            onHome={() => goLowerTab('/bandits', 'home')}
            onLocalFriend={() => goLowerTab('/localFriend', 'localFriend')}
            onChat={() => goLowerTab('/community', 'chat')}
            onAlerts={() => goLowerTab('/alerts', 'alerts')}
            onNotifications={() => goLowerTab('/notifications', 'notifications')}
            onMenu={() => goLowerTab('/menu', 'menu')}
            inboxBadgeCount={unreadCount}
            chatBadgeCount={chatUnreadCount}
          />
        </View>
      </View>
      </UpperTabHostProvider>
    </>
  );
}

function UpperTabButton({
  label,
  active,
  onPress,
  color,
  inactiveColor,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  color: string;
  inactiveColor: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      delayPressIn={0}
      hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
      android_ripple={{ color: 'rgba(10, 126, 164, 0.15)', borderless: false }}
      style={styles.upperTabButton}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Text style={{ color: active ? color : inactiveColor, fontWeight: active ? '700' : '600' }}>
        {label}
      </Text>
      {active ? <View style={[styles.upperTabUnderline, { backgroundColor: color }]} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  introRedirectShell: {
    flex: 1,
    width: '100%',
    backgroundColor: '#0a0a0a',
    ...Platform.select({ web: { minHeight: '100vh' as const }, default: {} }),
  },
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flex: 1, minHeight: 0, overflow: 'hidden' },
  /** Flex sibling (not absolute) — iOS native stack must not cover the tab bar touch target. */
  bottomNavBar: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    zIndex: 100,
    ...Platform.select({ android: { elevation: 24 }, default: {} }),
  },
  upperTabOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    backgroundColor: '#FFFFFF',
  },
  upperTabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
    backgroundColor: '#FFFFFF',
    zIndex: 50,
    ...Platform.select({ android: { elevation: 12 }, default: {} }),
  },
  upperTabButton: {
    alignItems: 'center',
    width: '33%',
    minHeight: 44,
    justifyContent: 'center',
  },
  upperTabUnderline: { height: 3, width: 60, marginTop: 8, borderRadius: 999 },
});
