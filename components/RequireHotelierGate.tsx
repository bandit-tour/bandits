import { Redirect } from 'expo-router';
import React, { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { canAccessHotelier } from '@/lib/appAdminAccess';
import { supabase } from '@/lib/supabase';

type Props = { children: ReactNode };

/**
 * Hotelier is a standard signed-in feature (non-anonymous email user).
 * Others are sent to email login with return path — not the admin 404.
 */
export function RequireHotelierGate({ children }: Props) {
  const [gate, setGate] = useState<'loading' | 'allow' | 'deny'>('loading');

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setGate(canAccessHotelier(user) ? 'allow' : 'deny');
    })();
  }, []);

  if (gate === 'loading') {
    return (
      <View style={styles.fillCenter}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (gate === 'deny') {
    return (
      <Redirect
        href={{
          pathname: '/login',
          params: { forceAuth: '1', redirect: '/hotelier' },
        }}
      />
    );
  }
  return children;
}

const styles = StyleSheet.create({
  fillCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAF8' },
});
