import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const load = useCallback(async () => {}, []);

  useEffect(() => {
    void load();
  }, [load]);

  const savePreferences = async () => {
    setSavingPrefs(true);
    setTimeout(() => {
      setSavingPrefs(false);
    }, 500);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Settings' }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.container, { paddingBottom: 24 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Notifications and guest preferences</Text>

        <Text style={styles.blockLabel}>Notifications</Text>
        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Push notifications</Text>
          <Switch value={pushEnabled} onValueChange={setPushEnabled} />
        </View>
        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Email updates</Text>
          <Switch value={emailEnabled} onValueChange={setEmailEnabled} />
        </View>

        <Text style={[styles.blockLabel, styles.blockSpaced]}>Preferences</Text>
        <Text style={styles.fieldHint}>Choose how you want app updates delivered.</Text>
        <Pressable style={styles.primaryBtn} onPress={savePreferences}>
          <Text style={styles.primaryBtnText}>{savingPrefs ? 'Saving...' : 'Save preferences'}</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  blockLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#888',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  blockSpaced: {
    marginTop: 8,
  },
  optionRow: {
    paddingVertical: 12,
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
  fieldHint: {
    fontSize: 13,
    color: '#555',
    marginBottom: 8,
  },
  primaryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#111',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  primaryBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
