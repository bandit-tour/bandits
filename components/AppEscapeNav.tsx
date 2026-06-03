import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { PLAY_MENU_HREF, goToAppHome, goToPlayMenu, navigateAppBack } from '@/lib/appNavigation';

type Props = {
  /** When stack history is empty, back goes here (default PLAY menu). */
  backFallback?: typeof PLAY_MENU_HREF;
  compact?: boolean;
};

/**
 * Escape hatch for stack screens outside `(tabs)` (no bottom nav).
 * Always provides Back, Menu, and Home — never traps the user.
 */
export default function AppEscapeNav({ backFallback = PLAY_MENU_HREF, compact = false }: Props) {
  const router = useRouter();

  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      <Pressable
        style={styles.btn}
        delayPressIn={0}
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => navigateAppBack(router, backFallback)}
      >
        <Text style={styles.btnText}>← Back</Text>
      </Pressable>
      <Pressable
        style={styles.btn}
        delayPressIn={0}
        accessibilityRole="button"
        accessibilityLabel="Go to Menu"
        onPress={() => goToPlayMenu(router)}
      >
        <Text style={styles.btnText}>Menu</Text>
      </Pressable>
      <Pressable
        style={styles.btn}
        delayPressIn={0}
        accessibilityRole="button"
        accessibilityLabel="Go Home"
        onPress={() => goToAppHome(router)}
      >
        <Text style={styles.btnText}>Home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    ...Platform.select({ web: { maxWidth: 720, alignSelf: 'center', width: '100%' } }),
  },
  rowCompact: {
    marginBottom: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#E8F1FA',
    alignItems: 'center',
  },
  btnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0a7ea4',
  },
});
