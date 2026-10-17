import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppBackScreenOptions } from '@/hooks/useAppBackScreenOptions';
import { readNoticePrefs, writeNoticePrefs } from '@/lib/notifications/prefs';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const screenOptions = useAppBackScreenOptions({
    title: 'Settings',
    fallback: '/menu',
  });
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [serviceEnabled, setServiceEnabled] = useState(true);
  const [socialEnabled, setSocialEnabled] = useState(true);
  const [marketingEnabled, setMarketingEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState('22');
  const [quietEnd, setQuietEnd] = useState('8');
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const prefs = await readNoticePrefs();
    setServiceEnabled(prefs.serviceEnabled);
    setSocialEnabled(prefs.socialEnabled);
    setMarketingEnabled(prefs.marketingEnabled);
    setQuietStart(String(prefs.quietStartHour));
    setQuietEnd(String(prefs.quietEndHour));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const savePreferences = async () => {
    setSavingPrefs(true);
    setSaved(false);
    try {
      const prev = await readNoticePrefs();
      const start = Number(quietStart);
      const end = Number(quietEnd);
      await writeNoticePrefs({
        ...prev,
        serviceEnabled,
        socialEnabled,
        marketingEnabled,
        quietStartHour: Number.isFinite(start) ? start : prev.quietStartHour,
        quietEndHour: Number.isFinite(end) ? end : prev.quietEndHour,
      });
      setSaved(true);
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.container, { paddingBottom: 24 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Settings</Text>

        <Text style={styles.blockLabel}>Notification categories</Text>
        <View style={styles.optionRow}>
          <View style={styles.optionCopy}>
            <Text style={styles.optionLabel}>Service alerts</Text>
            <Text style={styles.optionHint}>Check-in, bookings, concierge, and safety. Not limited by discovery caps.</Text>
          </View>
          <Switch testID="notice-pref-service" value={serviceEnabled} onValueChange={setServiceEnabled} />
        </View>
        <View style={styles.optionRow}>
          <View style={styles.optionCopy}>
            <Text style={styles.optionLabel}>Social</Text>
            <Text style={styles.optionHint}>Chat messages, accepted connections, and updates from people you follow.</Text>
          </View>
          <Switch testID="notice-pref-social" value={socialEnabled} onValueChange={setSocialEnabled} />
        </View>
        <View style={styles.optionRow}>
          <View style={styles.optionCopy}>
            <Text style={styles.optionLabel}>Discovery and offers</Text>
            <Text style={styles.optionHint}>Next-trip ideas and promotions. Off until you opt in. Quiet hours and a weekly limit apply.</Text>
          </View>
          <Switch testID="notice-pref-marketing" value={marketingEnabled} onValueChange={setMarketingEnabled} />
        </View>
        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Quiet hours start</Text>
          <TextInput
            testID="notice-quiet-start"
            value={quietStart}
            onChangeText={setQuietStart}
            keyboardType="number-pad"
            style={styles.hourInput}
          />
        </View>
        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Quiet hours end</Text>
          <TextInput
            testID="notice-quiet-end"
            value={quietEnd}
            onChangeText={setQuietEnd}
            keyboardType="number-pad"
            style={styles.hourInput}
          />
        </View>

        <Text style={[styles.blockLabel, styles.blockSpaced]}>Channels</Text>
        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Push notifications</Text>
          <Switch value={pushEnabled} onValueChange={setPushEnabled} />
        </View>
        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Email updates</Text>
          <Switch value={emailEnabled} onValueChange={setEmailEnabled} />
        </View>

        <Text style={[styles.blockLabel, styles.blockSpaced]}>Preferences</Text>
        <Pressable style={styles.primaryBtn} onPress={savePreferences} testID="notice-prefs-save">
          <Text style={styles.primaryBtnText}>{savingPrefs ? 'Saving...' : 'Save preferences'}</Text>
        </Pressable>
        {saved ? <Text testID="notice-prefs-saved" style={styles.saved}>Preferences saved.</Text> : null}
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
  optionCopy: { flex: 1, paddingRight: 12 },
  optionLabel: {
    fontSize: 14,
    color: '#333',
  },
  optionHint: { marginTop: 4, fontSize: 12, color: '#666', lineHeight: 16 },
  hourInput: {
    minWidth: 56,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    textAlign: 'center',
  },
  saved: { marginTop: 10, color: '#1F4E79', fontWeight: '700' },
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
