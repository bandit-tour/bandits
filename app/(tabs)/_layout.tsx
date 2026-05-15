import { Stack, usePathname, useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { InteractionManager, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MainBottomNav from '@/components/MainBottomNav';
import NearbyContextRunner from '@/components/NearbyContextRunner';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAppState } from '@/contexts/AppStateContext';
import { useCity } from '@/contexts/CityContext';
import { preloadExploreEvents, bootstrapExploreEventsCache } from '@/lib/exploreEventsCache';
import {
  hasSeenOpeningIntro,
} from '@/lib/openingIntroStorage';
import { bootstrapMainAppSession, syncPilotHotelProfileIfNeeded } from '@/lib/pilotSession';

type LowerTabKey = 'home' | 'localFriend' | 'chat' | 'alerts' | 'notifications' | 'menu';
type UpperTabKey = 'bandits' | 'mySpots' | 'explore';

function upperTabHref(tab: UpperTabKey): '/bandits' | '/mySpots' | '/explore' {
  if (tab === 'mySpots') return '/mySpots';
  if (tab === 'explore') return '/explore';
  return '/bandits';
}

function getLowerTabFromPath(pathname: string | null): LowerTabKey {
  if (!pathname) return 'home';
  /**
   * Bottom-nav "Chat" = traveler-to-traveler community (the /community surface).
   * /chat is the operator thread-reply route opened from Pilot Desk + Notifications;
   * it must NOT highlight the Chat tab (operators are doing operational work, not socializing).
   */
  if (pathname.includes('/community')) return 'chat';
  if (pathname.includes('/alerts') || pathname.includes('/scam-alerts')) return 'alerts';
  if (pathname.includes('/notifications') || pathname.includes('/inbox')) return 'notifications';
  if (pathname.includes('/localFriend')) return 'localFriend';
  if (pathname.includes('/menu')) return 'menu';
  /** Menu stack: avoid showing Home active while on Profile / Following / Settings (cross-flow confusion). */
  if (pathname.includes('/profile') || pathname.includes('/settings') || pathname.includes('/following')) {
    return 'menu';
  }
  return 'home';
}

function getUpperTabFromPath(pathname: string | null): UpperTabKey | null {
  if (!pathname) return 'bandits';
  if (
    pathname.includes('/chat') ||
    pathname.includes('/community') ||
    pathname.includes('/alerts') ||
    pathname.includes('/scam-alerts') ||
    pathname.includes('/notifications') ||
    pathname.includes('/inbox') ||
    pathname.includes('/menu') ||
    pathname.includes('/localFriend') ||
    pathname.includes('/profile') ||
    pathname.includes('/settings') ||
    pathname.includes('/following')
  ) {
    return null;
  }
  if (pathname.includes('/mySpots')) return 'mySpots';
  if (pathname.includes('/explore')) return 'explore';
  if (pathname.includes('/bandits')) return 'bandits';
  return 'bandits';
}

export default function TabsLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { unreadCount } = useAppState();
  const { selectedCity } = useCity();

  /** Warm Explore cache after transitions idle — keeps upper-tab taps responsive. */
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        void bootstrapExploreEventsCache(selectedCity || undefined);
      });
    });
    return () => task.cancel();
  }, [selectedCity]);

  useEffect(() => {
    if (!selectedCity) return;
    const task = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        preloadExploreEvents(selectedCity);
      });
    });
    return () => task.cancel();
  }, [selectedCity]);

  const lowerTab = getLowerTabFromPath(pathname) as LowerTabKey;
  const upperTab = getUpperTabFromPath(pathname);
  const showUpperTabs = upperTab !== null;
  const tabColor = colorScheme === 'dark' ? '#0a7ea4' : '#0a7ea4';
  const inactiveColor = colorScheme === 'dark' ? '#A0A0A0' : '#777';
  const go = (
    path:
      | '/bandits'
      | '/mySpots'
      | '/explore'
      | '/localFriend'
      | '/community'
      | '/alerts'
      | '/notifications'
      | '/menu',
  ) => {
    router.navigate(path);
  };

  /** Upper tabs: immediate `replace` — stack uses no animation on native for snappy switching. */
  const goUpperTab = useCallback(
    (tab: UpperTabKey) => {
      if (upperTab === tab) return;
      router.replace(upperTabHref(tab) as Href);
    },
    [router, upperTab],
  );

  useEffect(() => {
    void (async () => {
      /** Waits for persisted email sessions to hydrate before anon — avoids wiping operator login on web. */
      await bootstrapMainAppSession();
      await syncPilotHotelProfileIfNeeded();
    })();
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
      <View style={styles.container}>
        {showUpperTabs && (
          <View style={[styles.upperTabs, { paddingTop: Math.max(insets.top, 8) + 6 }]}>
            <UpperTabButton
              label="Local banDits"
              active={upperTab === 'bandits'}
              onPress={() => goUpperTab('bandits')}
              color={tabColor}
              inactiveColor={inactiveColor}
            />
            <UpperTabButton
              label="My Spots"
              active={upperTab === 'mySpots'}
              onPress={() => goUpperTab('mySpots')}
              color={tabColor}
              inactiveColor={inactiveColor}
            />
            <UpperTabButton
              label="Explore"
              active={upperTab === 'explore'}
              onPress={() => goUpperTab('explore')}
              color={tabColor}
              inactiveColor={inactiveColor}
            />
          </View>
        )}

        <View style={styles.content}>
          <Stack
            screenOptions={{
              headerShown: false,
              headerBackTitle: 'Back',
              headerBackTitleVisible: true,
              ...Platform.select({
                web: { animation: 'fade' as const, animationDuration: 120 },
                default: { animation: 'none' as const },
              }),
            }}
          />
        </View>

        <MainBottomNav
          activeTab={lowerTab}
          onHome={() => go('/bandits')}
          onLocalFriend={() => go('/localFriend')}
          onChat={() => go('/community')}
          onAlerts={() => go('/alerts')}
          onNotifications={() => go('/notifications')}
          onMenu={() => go('/menu')}
          inboxBadgeCount={unreadCount}
        />
      </View>
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
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
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
  content: { flex: 1 },
  upperTabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
    backgroundColor: '#FFFFFF',
    zIndex: 20,
    ...Platform.select({ android: { elevation: 8 }, default: {} }),
  },
  upperTabButton: {
    alignItems: 'center',
    width: '33%',
    minHeight: 44,
    justifyContent: 'center',
  },
  upperTabUnderline: { height: 3, width: 60, marginTop: 8, borderRadius: 999 },
});
