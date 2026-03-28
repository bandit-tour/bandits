import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { supabase } from '@/lib/supabase';
import { getOperatorUserId } from '@/services/localFriend';

type MenuItem = {
  title: string;
  route: string;
};

const MENU_ITEMS: MenuItem[] = [
  { title: 'Profile', route: '/profile' },
  { title: 'Settings', route: '/settings' },
  { title: 'bandiTeam', route: '/bandiTeam' },
  { title: 'Hotelier', route: '/hotelier' },
];

export default function MenuScreen() {
  const router = useRouter();
  const [isOperator, setIsOperator] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const refreshOperator = React.useCallback(async () => {
    const operatorId = getOperatorUserId();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setIsOperator(!!operatorId && !!user && user.id === operatorId);
  }, []);

  React.useEffect(() => {
    void refreshOperator();
  }, [refreshOperator]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshOperator();
    } finally {
      setRefreshing(false);
    }
  }, [refreshOperator]);

  const items = isOperator
    ? [...MENU_ITEMS, { title: 'Pilot Desk', route: '/operatorDesk' }]
    : MENU_ITEMS;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
    >
      <Stack.Screen options={{ headerShown: true, title: 'Menu' }} />

      <View style={styles.header}>
        <Image source={require('@/assets/icons/logobanditourapp.png')} style={styles.wordmark} resizeMode="contain" />
        <Text style={styles.headerTitle}>Guest Menu</Text>
        <Text style={styles.headerSubtitle}>PLAY Theatrou Athens</Text>
      </View>

      <View style={styles.section}>
        {items.map((item) => (
          <Pressable
            key={item.title}
            style={styles.row}
            onPress={() => router.push(item.route)}
          >
            <Text style={styles.rowText}>{item.title}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={styles.signOut}
        onPress={async () => {
          await supabase.auth.signOut();
          Alert.alert('Signed out', 'You have been signed out successfully.');
          router.replace('/login');
        }}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: '#FFFFFF',
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
  row: {
    paddingVertical: 16,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E6E6E6',
  },
  rowText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0a7ea4',
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

