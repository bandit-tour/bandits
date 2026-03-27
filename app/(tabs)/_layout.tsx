import { Stack, usePathname, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import MainBottomNav from '@/components/MainBottomNav';
import { useColorScheme } from '@/hooks/useColorScheme';
import { CityProvider } from '@/contexts/CityContext';

type LowerTabKey = 'home' | 'localFriend' | 'chat' | 'inbox' | 'menu';
type UpperTabKey = 'bandits' | 'mySpots' | 'explore';

function getLowerTabFromPath(pathname: string | null): LowerTabKey {
  if (!pathname) return 'home';
  if (pathname.includes('/chat')) return 'chat';
  if (pathname.includes('/inbox')) return 'inbox';
  if (pathname.includes('/localFriend')) return 'localFriend';
  if (pathname.includes('/menu')) return 'menu';
  return 'home';
}

function getUpperTabFromPath(pathname: string | null): UpperTabKey | null {
  if (!pathname) return 'bandits';
  if (
    pathname.includes('/chat') ||
    pathname.includes('/inbox') ||
    pathname.includes('/menu') ||
    pathname.includes('/localFriend') ||
    pathname.includes('/profile') ||
    pathname.includes('/settings')
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

  const lowerTab = getLowerTabFromPath(pathname) as LowerTabKey;
  const upperTab = getUpperTabFromPath(pathname);
  const showUpperTabs = upperTab !== null;

  const tabColor = colorScheme === 'dark' ? '#0a7ea4' : '#0a7ea4';
  const inactiveColor = colorScheme === 'dark' ? '#A0A0A0' : '#777';
  const go = (path: '/bandits' | '/mySpots' | '/explore' | '/localFriend' | '/chat' | '/inbox' | '/menu') => {
    router.navigate(path);
  };

  return (
    <CityProvider>
      <View style={styles.container}>
        {showUpperTabs && (
          <View style={styles.upperTabs}>
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
          onInbox={() => go('/inbox')}
          onMenu={() => go('/menu')}
        />
      </View>
    </CityProvider>
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
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flex: 1 },
  upperTabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
    backgroundColor: '#FFFFFF',
  },
  upperTabButton: { alignItems: 'center', width: '33%' },
  upperTabUnderline: { height: 3, width: 60, marginTop: 8, borderRadius: 999 },
});
