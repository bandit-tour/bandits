import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { goToAppHome, goToPlayMenu } from '@/lib/appNavigation';

/**
 * Escape hatch for operator/admin surfaces when stack history is empty or stale.
 */
export default function OperatorQuickNav() {
  const router = useRouter();

  return (
    <View style={styles.row}>
      <Pressable
        style={styles.btn}
        delayPressIn={0}
        accessibilityRole="button"
        accessibilityLabel="Back to Menu"
        onPress={() => goToPlayMenu(router)}
      >
        <Text style={styles.btnText}>Back to Menu</Text>
      </Pressable>
      <Pressable
        style={styles.btn}
        delayPressIn={0}
        accessibilityRole="button"
        accessibilityLabel="Go Home"
        onPress={() => goToAppHome(router)}
      >
        <Text style={styles.btnText}>Go Home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#E8F1FA',
    alignItems: 'center',
  },
  btnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
  },
});
