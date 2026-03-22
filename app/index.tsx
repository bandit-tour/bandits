import * as React from 'react';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const go = async () => {
      if (!isSupabaseConfigured()) {
        if (!cancelled) router.replace('/login');
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.user) {
        router.replace('/(tabs)/bandits');
      } else {
        router.replace('/login');
      }
    };
    void go();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <View style={styles.root}>
      <ActivityIndicator size="large" color="#ff0000" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
});
