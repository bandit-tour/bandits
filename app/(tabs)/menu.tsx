import type { User } from '@supabase/supabase-js';
import { useFocusEffect } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import {
  canAccessHotelier,
  canShowOwnerPrivateMenu,
} from '@/lib/appAdminAccess';
import { usePremiumRefreshControl } from '@/lib/mobilePullToRefresh';
import { getHotelWhiteLabelOrDefault } from '@/lib/hotelWhiteLabel';
import { openStaffEmailLogin } from '@/lib/loginNavigation';
import { getHotelEntry } from '@/lib/pilotSession';
import { resolveMenuAuthSnapshot } from '@/lib/pilotDeskGate';
import { supabase } from '@/lib/supabase';

type MenuItem = {
  title: string;
  route: string;
};

const MENU_ITEMS: MenuItem[] = [
  { title: 'Profile', route: '/profile' },
  { title: 'Following', route: '/following' },
  { title: 'Settings', route: '/settings' },
  { title: 'bandiTeam', route: '/bandiTeam' },
];

const OWNER_PRIVATE_MENU_ITEMS: MenuItem[] = [
  { title: 'Pilot Desk', route: '/operatorDesk' },
  { title: 'CDesk', route: '/admin' },
];

function applyMenuAuthFromUser(
  user: User | null,
  setters: {
    setOwnerPrivateMenuAllowed: (v: boolean) => void;
    setCanStaffSignOut: (v: boolean) => void;
    setAuthHydrated: (v: boolean) => void;
  },
) {
  setters.setOwnerPrivateMenuAllowed(canShowOwnerPrivateMenu(user));
  setters.setCanStaffSignOut(canAccessHotelier(user));
  setters.setAuthHydrated(true);
}

export default function MenuScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 1000;
  const [ownerPrivateMenuAllowed, setOwnerPrivateMenuAllowed] = React.useState(false);
  const [authHydrated, setAuthHydrated] = React.useState(false);
  const [canStaffSignOut, setCanStaffSignOut] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [menuLocationLine, setMenuLocationLine] = React.useState(
    () => getHotelWhiteLabelOrDefault(null).menuLocationLine,
  );

  const authSetters = React.useMemo(
    () => ({
      setOwnerPrivateMenuAllowed,
      setCanStaffSignOut,
      setAuthHydrated,
    }),
    [],
  );

  const refreshMenuAccess = React.useCallback(async () => {
    const { user } = await resolveMenuAuthSnapshot();
    applyMenuAuthFromUser(user, authSetters);
  }, [authSetters]);

  /** Fast local session read before async merge — avoids blank owner menu on cold open. */
  React.useLayoutEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      applyMenuAuthFromUser(session?.user ?? null, authSetters);
    });
  }, [authSetters]);

  React.useEffect(() => {
    void refreshMenuAccess();
  }, [refreshMenuAccess]);

  React.useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applyMenuAuthFromUser(session?.user ?? null, authSetters);
    });
    return () => subscription.unsubscribe();
  }, [authSetters]);

  useFocusEffect(
    React.useCallback(() => {
      void refreshMenuAccess();
    }, [refreshMenuAccess]),
  );

  React.useEffect(() => {
    void getHotelEntry().then((entry) => {
      setMenuLocationLine(getHotelWhiteLabelOrDefault(entry?.slug ?? null).menuLocationLine);
    });
  }, []);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshMenuAccess();
    } finally {
      setRefreshing(false);
    }
  }, [refreshMenuAccess]);

  const menuRefreshControl = usePremiumRefreshControl(refreshing, onRefresh);

  const items: MenuItem[] = React.useMemo(() => {
    const out: MenuItem[] = [...MENU_ITEMS, { title: 'Hotelier', route: '/hotelier' }];
    if (ownerPrivateMenuAllowed) {
      out.push(...OWNER_PRIVATE_MENU_ITEMS);
    }
    return out;
  }, [ownerPrivateMenuAllowed]);

  const signedInEmailUser = canStaffSignOut;
  const showGuestMenuTitle = !signedInEmailUser;
  const headerTitle = showGuestMenuTitle ? 'Guest Menu' : 'Menu';
  const showPilotStaffChrome = authHydrated && ownerPrivateMenuAllowed;
  /** Match web Guest Menu: always offer email sign-in until a real account session exists. */
  const showStaffSignIn = !signedInEmailUser;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={menuRefreshControl}
    >
      <Stack.Screen options={{ headerShown: true, title: headerTitle }} />

      <View style={styles.header}>
        <Image source={require('@/assets/icons/logobanditourapp.png')} style={styles.wordmark} resizeMode="contain" />
        <Text style={styles.headerTitle}>{headerTitle}</Text>
        <Text style={styles.headerSubtitle}>
          {showPilotStaffChrome ? `Staff · ${menuLocationLine}` : menuLocationLine}
        </Text>
      </View>

      <View style={[styles.section, isDesktopWeb && styles.sectionDesktop]}>
        {items.map((item) => (
          <Pressable
            key={item.title}
            style={[styles.row, isDesktopWeb && styles.rowDesktop]}
            onPress={() => router.push(item.route as never)}
          >
            <Text style={styles.rowText}>{item.title}</Text>
          </Pressable>
        ))}
      </View>

      {showStaffSignIn ? (
        <Pressable
          style={styles.staffSignIn}
          onPress={() => openStaffEmailLogin(router, '/menu')}
        >
          <Text style={styles.staffSignInTitle}>Sign in with email</Text>
          <Text style={styles.staffSignInSub}>For hotel partners and verified accounts.</Text>
        </Pressable>
      ) : null}

      {canStaffSignOut ? (
        <Pressable
          style={styles.signOut}
          onPress={async () => {
            await supabase.auth.signOut();
            Alert.alert('Signed out', 'You have been signed out successfully.');
            openStaffEmailLogin(router, '/menu');
          }}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 18,
  },
  wordmark: {
    width: 176,
    height: 56,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6D6D6D',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  section: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E6E6E6',
  },
  sectionDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
  },
  row: {
    paddingVertical: 16,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E6E6E6',
  },
  rowDesktop: {
    width: '50%',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#E6E6E6',
  },
  rowText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0a7ea4',
  },
  staffSignIn: {
    marginTop: 18,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#C8E6EF',
    backgroundColor: '#F5FBFD',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  staffSignInTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0a7ea4',
    marginBottom: 4,
  },
  staffSignInSub: {
    fontSize: 12,
    color: '#5a7a82',
    fontWeight: '600',
  },
  signOut: {
    marginTop: 18,
    backgroundColor: '#111',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  signOutText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
