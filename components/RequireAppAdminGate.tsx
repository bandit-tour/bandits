import { Redirect } from 'expo-router';
import React, { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { canShowOwnerPrivateMenu } from '@/lib/appAdminAccess';
import { resolveSessionUserForPilotDesk } from '@/lib/pilotDeskGate';

type Props = { children: ReactNode };

/**
 * Renders `children` only for the owner private menu account (blonje@gmail.com).
 * Other users (including guests) are redirected to the not-found screen.
 */
export function RequireAppAdminGate({ children }: Props) {
  const [gate, setGate] = useState<'loading' | 'allow' | 'deny'>('loading');

  useEffect(() => {
    void (async () => {
      const { user } = await resolveSessionUserForPilotDesk();
      setGate(canShowOwnerPrivateMenu(user) ? 'allow' : 'deny');
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
