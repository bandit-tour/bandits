import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ headerShown: true, title: 'Menu' }} />

      <View style={styles.header}>
        <Image
          source={require('@/assets/icons/banditLocalpng.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <View style={styles.section}>
        {MENU_ITEMS.map((item) => (
          <Pressable
            key={item.title}
            style={styles.row}
            onPress={() => router.push(item.route)}
          >
            <Text style={styles.rowText}>{item.title}</Text>
          </Pressable>
        ))}
      </View>
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
  logo: {
    width: 110,
    height: 110,
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
});

