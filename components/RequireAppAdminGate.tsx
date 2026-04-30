import { Redirect } from 'expo-router';
import React, { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { isAppAdminUser } from '@/lib/appAdminAccess';
import { supabase } from '@/lib/supabase';

type Props = { children: ReactNode };

/**
 * Renders `children` only for sessions whose email is in `EXPO_PUBLIC_APP_ADMIN_EMAILS`.
 * Other users (including guests) are redirected to the not-found screen.
 */
export function RequireAppAdminGate({ children }: Props) {
  const [gate, setGate] = useState<'loading' | 'allow' | 'deny'>('loading');

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setGate(isAppAdminUser(user) ? 'allow' : 'deny');
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
    return <Redirect href="/+not-found" />;
  }
  return children;
}

const styles = StyleSheet.create({
  fillCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAF8' },
});
