import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '@/lib/supabase';

export default function SettingsScreen() {
  const router = useRouter();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Settings' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Push notifications</Text>
          <Switch value={pushEnabled} onValueChange={setPushEnabled} />
        </View>

        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Email updates</Text>
          <Switch value={emailEnabled} onValueChange={setEmailEnabled} />
        </View>

        <TouchableOpacity
          style={styles.signOutButton}
          onPress={async () => {
            await supabase.auth.signOut();
            router.replace('/');
          }}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    marginBottom: 12,
  },
  optionRow: {
    marginTop: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  optionLabel: {
    fontSize: 14,
    color: '#333',
  },
  signOutButton: {
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#111',
    alignItems: 'center',
  },
  signOutText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
