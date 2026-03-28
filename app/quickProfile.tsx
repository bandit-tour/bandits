import * as Location from 'expo-location';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  QUICK_PROFILE_INTERESTS,
  upsertQuickProfile,
} from '@/services/userProfile';

function paramOne(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? '';
  return v ?? '';
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function QuickProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    hotel_id?: string | string[];
    entry_source?: string | string[];
  }>();

  const hotelIdRaw = useMemo(() => paramOne(params.hotel_id).trim(), [params.hotel_id]);
  const entrySourceRaw = useMemo(() => paramOne(params.entry_source).trim(), [params.entry_source]);

  const hotelId = useMemo(() => (UUID_RE.test(hotelIdRaw) ? hotelIdRaw : null), [hotelIdRaw]);
  const entrySource = useMemo(() => {
    if (entrySourceRaw === 'hotel_qr') return 'hotel_qr';
    if (hotelId) return 'hotel_qr';
    return null;
  }, [entrySourceRaw, hotelId]);

  const isHotelQr = entrySource === 'hotel_qr';

  const [authReady, setAuthReady] = useState(false);
  const [name, setName] = useState('');
  const [city, setCity] = useState('Athens');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [locationPermission, setLocationPermission] = useState(false);
  const [locationTouched, setLocationTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!isSupabaseConfigured()) {
        setAuthReady(true);
        return;
      }
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          if (!cancelled) setAuthReady(true);
          return;
        }
        const { error: anonErr } = await supabase.auth.signInAnonymously();
        if (anonErr && !/anonymous sign-ins are disabled/i.test(anonErr.message ?? '')) {
          setError(anonErr.message || 'Could not start a guest session.');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not start a guest session.');
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleInterest = useCallback((label: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  const onAllowLocation = useCallback(async () => {
    setLocationTouched(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const ok = status === Location.PermissionStatus.GRANTED;
      setLocationPermission(ok);
    } catch {
      setLocationPermission(false);
    }
  }, []);

  const onSkipLocation = useCallback(() => {
    setLocationTouched(true);
    setLocationPermission(false);
  }, []);

  const onContinue = useCallback(async () => {
    if (saving) return;
    setError(null);
    if (!isSupabaseConfigured()) {
      router.replace('/bandits');
      return;
    }
    setSaving(true);
    try {
      await upsertQuickProfile({
        name: name.trim() || 'Guest',
        interests: Array.from(selected),
        city: city.trim() || 'Athens',
        locationPermission,
        hotelId,
        entrySource,
      });
      router.replace('/bandits');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }, [saving, name, city, selected, locationPermission, hotelId, entrySource, router]);

  const onSignIn = useCallback(() => {
    router.push('/login');
  }, [router]);

  if (!authReady) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#111" />
        <Text style={styles.hint}>Preparing your profile…</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Quick setup', headerBackTitle: 'Back' }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 48}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: 12, paddingBottom: insets.bottom + 28 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.lead}>
            Tell us a little about you — then you can explore right away. No password required.
          </Text>

          {isHotelQr ? (
            <View style={styles.hotelBanner}>
              <Text style={styles.hotelLine}>Welcome to Athens.</Text>
              <Text style={styles.hotelSub}>Your hotel bandits are ready.</Text>
            </View>
          ) : null}

          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            placeholder="How should we call you?"
            placeholderTextColor="#888"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          <Text style={styles.label}>City</Text>
          <TextInput
            style={styles.input}
            placeholder="Athens"
            placeholderTextColor="#888"
            value={city}
            onChangeText={setCity}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Interests</Text>
          <Text style={styles.hint}>Pick what feels right — you can choose several.</Text>
          <View style={styles.chips}>
            {QUICK_PROFILE_INTERESTS.map((label) => {
              const on = selected.has(label);
              return (
                <Pressable
                  key={label}
                  onPress={() => toggleInterest(label)}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { marginTop: 8 }]}>Location (optional)</Text>
          <Text style={styles.locCopy}>Allow location so we can show places near you.</Text>
          <View style={styles.locRow}>
            <Pressable
              style={[styles.locBtn, styles.locBtnPrimary]}
              onPress={onAllowLocation}
              disabled={saving}
            >
              <Text style={styles.locBtnPrimaryText}>Allow</Text>
            </Pressable>
            <Pressable style={styles.locBtn} onPress={onSkipLocation} disabled={saving}>
              <Text style={styles.locBtnText}>Skip</Text>
            </Pressable>
          </View>
          {locationTouched ? (
            <Text style={styles.locStatus}>
              {locationPermission ? 'Location enabled for tips while you explore.' : 'No problem — you can enable it later in settings.'}
            </Text>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.cta, saving && styles.ctaDisabled]}
            onPress={onContinue}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaText}>Continue</Text>
            )}
          </Pressable>

          <Pressable style={styles.signInLink} onPress={onSignIn} hitSlop={12}>
            <Text style={styles.signInLinkText}>Already have an account? Sign in</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  scroll: { paddingHorizontal: 20, maxWidth: 520, alignSelf: 'center', width: '100%' },
  lead: {
    fontSize: 15,
    lineHeight: 22,
    color: '#444',
    marginBottom: 20,
  },
  hotelBanner: {
    backgroundColor: '#F4F6F8',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E6EB',
  },
  hotelLine: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  hotelSub: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    color: '#777',
    marginBottom: 10,
    marginTop: -4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D9DEE5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 16,
    color: '#111',
    marginBottom: 18,
    backgroundColor: '#FAFBFC',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    backgroundColor: '#fff',
  },
  chipOn: {
    borderColor: '#111',
    backgroundColor: '#111',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  chipTextOn: { color: '#fff' },
  locCopy: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 12,
  },
  locRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  locBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    backgroundColor: '#fff',
  },
  locBtnPrimary: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  locBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  locBtnPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  locStatus: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
    lineHeight: 17,
  },
  error: {
    color: '#b00020',
    marginBottom: 12,
    fontSize: 14,
  },
  cta: {
    backgroundColor: '#111',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  signInLink: {
    marginTop: 22,
    alignSelf: 'center',
    paddingVertical: 8,
  },
  signInLinkText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
