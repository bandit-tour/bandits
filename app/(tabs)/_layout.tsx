import { Stack, usePathname, useRouter } from 'expo-router';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MainBottomNav from '@/components/MainBottomNav';
import NearbyContextRunner from '@/components/NearbyContextRunner';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAppState } from '@/contexts/AppStateContext';
import {
  hasSeenOpeningIntro,
} from '@/lib/openingIntroStorage';
import { bootstrapMainAppSession, syncPilotHotelProfileIfNeeded } from '@/lib/pilotSession';

type LowerTabKey = 'home' | 'localFriend' | 'chat' | 'alerts' | 'inbox' | 'menu';
type UpperTabKey = 'bandits' | 'mySpots' | 'explore';

function getLowerTabFromPath(pathname: string | null): LowerTabKey {
  if (!pathname) return 'home';
  if (pathname.includes('/chat')) return 'chat';
  if (pathname.includes('/alerts') || pathname.includes('/scam-alerts')) return 'alerts';
  if (pathname.includes('/inbox')) return 'inbox';
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
    pathname.includes('/alerts') ||
    pathname.includes('/scam-alerts') ||
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
      | '/chat'
      | '/alerts'
      | '/inbox'
      | '/menu',
  ) => {
    router.push(path);
  };

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
              onPress={() => go('/bandits')}
              color={tabColor}
              inactiveColor={inactiveColor}
            />
            <UpperTabButton
              label="My Spots"
              active={upperTab === 'mySpots'}
              onPress={() => go('/mySpots')}
              color={tabColor}
              inactiveColor={inactiveColor}
            />
            <UpperTabButton
              label="Explore"
              active={upperTab === 'explore'}
              onPress={() => go('/explore')}
              color={tabColor}
              inactiveColor={inactiveColor}
            />
          </View>
        )}

        <View style={styles.content}>
          <Stack screenOptions={{ headerShown: false, headerBackTitleVisible: false }} />
        </View>

        <MainBottomNav
          activeTab={lowerTab}
          onHome={() => go('/bandits')}
          onLocalFriend={() => go('/localFriend')}
          onChat={() => go('/chat')}
          onAlerts={() => go('/alerts')}
          onInbox={() => go('/inbox')}
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
    <Pressable onPress={onPress} style={styles.upperTabButton}>
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
  },
  upperTabButton: {
    alignItems: 'center',
    width: '33%',
    minHeight: 34,
    justifyContent: 'center',
  },
  upperTabUnderline: { height: 3, width: 60, marginTop: 8, borderRadius: 999 },
});
