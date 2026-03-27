import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

function initialsFromEmail(email: string | null | undefined): string {
  if (!email) return '?';
  const part = email.split('@')[0] || email;
  return part.slice(0, 2).toUpperCase();
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setEmail('');
      setDisplayName('Guest');
      setAvatarUrl(null);
      return;
    }
    setEmail(user.email ?? '');
    const meta = user.user_metadata as Record<string, unknown> | undefined;
    const name =
      (typeof meta?.full_name === 'string' && meta.full_name) ||
      (typeof meta?.name === 'string' && meta.name) ||
      (user.email ? user.email.split('@')[0] : 'Traveler');
    setDisplayName(name);
    const url = typeof meta?.avatar_url === 'string' ? meta.avatar_url : null;
    setAvatarUrl(url?.trim() || null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Profile' }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
      >
        <View style={styles.hero}>
          <View style={styles.avatarWrap}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{initialsFromEmail(email)}</Text>
              </View>
            )}
          </View>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.email}>{email || 'Sign in to sync your account'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Text style={styles.sectionBody}>
            Your bandiTour profile ties together saved spots, inbox replies, and Local Friend notes.
          </Text>
        </View>

        <Pressable style={styles.row} onPress={() => router.push('/settings')}>
          <Text style={styles.rowLabel}>Settings</Text>
          <Text style={styles.rowChevron}>›</Text>
        </Pressable>

        <Text style={styles.footerHint}>Account actions are available in Settings.</Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingHorizontal: 20, paddingTop: 8 },
  hero: { alignItems: 'center', marginBottom: 28 },
  avatarWrap: {
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#EEE',
  },
  avatarFallback: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '800',
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111',
    marginBottom: 6,
  },
  email: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
    padding: 14,
    backgroundColor: '#F8F9FB',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E8E8',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  sectionBody: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEE',
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0a7ea4',
  },
  rowChevron: {
    fontSize: 22,
    color: '#999',
    fontWeight: '300',
  },
  footerHint: {
    marginTop: 24,
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
});
