import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

/** Alias route: forwards to city map with optional bandit (uses push, not replace). */
export default function MapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ banditId?: string }>();
  const banditId = Array.isArray(params.banditId) ? params.banditId[0] : params.banditId;

  useEffect(() => {
    if (banditId) {
      router.push(`/cityMap?banditId=${encodeURIComponent(banditId)}` as any);
    } else {
      router.push('/cityMap' as any);
    }
  }, [router, banditId]);

  return (
    <View style={styles.center}>
      <ActivityIndicator />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
