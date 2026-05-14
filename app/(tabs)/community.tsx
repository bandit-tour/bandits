import { HeaderBackButton } from '@react-navigation/elements';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

/**
 * Community / Chat tab — traveler-to-traveler landing (future MVP).
 * Operator conversations live in Pilot Desk / Notifications, not here.
 */
export default function CommunityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/bandits');
  }, [router]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Chat',
          headerBackTitle: 'Back',
          headerBackTitleVisible: true,
          headerLeft: (props) => (
            <HeaderBackButton
              {...props}
              label="Back"
              labelVisible={Platform.OS === 'ios'}
              onPress={handleBack}
            />
          ),
        }}
      />
      <View
        style={[
          styles.container,
          { backgroundColor: theme.background, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <View style={styles.centerBlock}>
          <View style={styles.heroIconWrap}>
            <View style={styles.heroIconBubble}>
              <IconSymbol name="bubble.left.and.bubble.right.fill" size={36} color="#0A7EA4" />
            </View>
          </View>

          <Text style={[styles.title, { color: theme.text }]}>Community Chat</Text>

          <Text style={[styles.subtitle, { color: theme.text }]}>
            Meet fellow travelers, share discoveries, and plan experiences together.
          </Text>

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Start Chat"
          >
            <Text style={styles.primaryBtnText}>Start Chat</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 32,
  },
  centerBlock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  heroIconWrap: {
    alignItems: 'center',
    marginBottom: 28,
  },
  heroIconBubble: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F1FA',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    opacity: 0.85,
    marginBottom: 40,
  },
  primaryBtn: {
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 220,
    alignItems: 'center',
  },
  primaryBtnPressed: {
    opacity: 0.88,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
