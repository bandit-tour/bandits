import { bootstrapMainAppSession, persistHotelEntry } from '@/lib/pilotSession';
import { persistAttachedStay } from '@/lib/stay/attachStay';
import { isIsolatedPlaySandboxSlug, resolveUnlockHotelBranding } from '@/lib/stay/liveHotelIdentity';
import { isInHouse, suggestPhaseFromDates } from '@/lib/stay/lifecycle';
import {
  resolveUnlockToken,
  stayFromVerify,
  verifyReservationUnlock,
} from '@/lib/stay/verifyReservation';
import {
  transitionAttachPreTrip,
  transitionCheckIn,
} from '@/lib/guest-lifecycle';
import type { HotelWhiteLabelConfig } from '@/lib/hotelWhiteLabel';
import { normalizeHotelSlug } from '@/lib/hotelWhiteLabel';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Hotel → Guest unlock: opaque token from email CTA + reservation number as access key.
 * Live invitation identity only — never PLAY / PLAY-DEMO-001 fallbacks for real guests.
 */
export default function HotelUnlockScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ t?: string; hotel?: string; token?: string }>();
  const accessToken = String(params.t || params.token || '').trim();
  const hotelParam = String(params.hotel || '').trim();

  const [hotelSlug, setHotelSlug] = useState(() => normalizeHotelSlug(hotelParam));
  const [hotelName, setHotelName] = useState('');
  const [hintCode, setHintCode] = useState('');
  const [reservationNumber, setReservationNumber] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [resolving, setResolving] = useState(Boolean(accessToken) || Boolean(hotelParam));
  const [error, setError] = useState<string | null>(null);
  const [donePhase, setDonePhase] = useState<string | null>(null);
  const [branding, setBranding] = useState<HotelWhiteLabelConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let slug = normalizeHotelSlug(hotelParam);
      let name = '';
      if (accessToken) {
        const resolved = await resolveUnlockToken(accessToken);
        if (cancelled) return;
        if (resolved) {
          slug = normalizeHotelSlug(resolved.hotelSlug || slug);
          name = String(resolved.hotelName || '').trim();
          setHotelSlug(slug);
          setHotelName(name);
          setHintCode(resolved.showReservationCode || '');
        }
      }
      const brand = await resolveUnlockHotelBranding({ slug, liveHotelName: name });
      if (cancelled) return;
      setBranding(brand.config);
      if (!name && brand.config?.displayName) {
        setHotelName(brand.config.displayName);
      }
      if (slug && name) {
        await persistHotelEntry(slug, 'hotel_link', { displayName: name });
      }
      setResolving(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, hotelParam]);

  const displayHotel = hotelName || branding?.displayName || '';
  const eyebrow = branding?.homeHeroEyebrow?.trim() || '';
  const showEyebrow =
    Boolean(eyebrow) &&
    eyebrow.toLowerCase() !== displayHotel.toLowerCase() &&
    (isIsolatedPlaySandboxSlug(hotelSlug) || !/PLAY/i.test(eyebrow));

  const onUnlock = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      await bootstrapMainAppSession();
      const result = await verifyReservationUnlock({
        hotelSlug,
        reservationNumber: reservationNumber.trim(),
        accessToken: accessToken || null,
        guestEmail: guestEmail.trim() || null,
      });
      if (!result.ok) {
        setError(result.error || 'Verification failed');
        setBusy(false);
        return;
      }
      const stay = stayFromVerify(result);
      const phaseFromDates = suggestPhaseFromDates(stay.checkInDate, stay.checkOutDate);
      const effectivePhase = isInHouse(stay.lifecyclePhase)
        ? stay.lifecyclePhase
        : isInHouse(phaseFromDates)
          ? phaseFromDates
          : stay.lifecyclePhase;
      await persistAttachedStay({ ...stay, lifecyclePhase: effectivePhase });
      const life = await transitionAttachPreTrip({
        bookingNumber: stay.reservationNumber || reservationNumber.trim(),
        hotelSlug: stay.hotelSlug || hotelSlug,
        hotelName: stay.hotelName || hotelName || displayHotel,
        city: 'Athens',
      });
      if (isInHouse(effectivePhase)) {
        await transitionCheckIn(life.lifecycle.activeStayId ?? undefined);
      }
      setDonePhase(life.lifecycle.state);
      setBusy(false);
      setTimeout(() => {
        router.replace('/home' as Href);
      }, 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unlock failed');
      setBusy(false);
    }
  }, [accessToken, displayHotel, guestEmail, hotelName, hotelSlug, reservationNumber, router]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <Stack.Screen options={{ headerShown: false, title: 'Unlock bandiTour' }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {branding?.logoSource ? (
          <Image source={branding.logoSource} style={styles.logo} resizeMode="contain" />
        ) : null}
        <Text style={styles.eyebrow}>Your hotel unlocked something special</Text>
        <Text style={styles.title}>
          {displayHotel ? `Welcome to ${displayHotel}` : 'Welcome to your stay'}
        </Text>
        <Text style={styles.sub}>
          {showEyebrow ? `${eyebrow} — ` : ''}
          Enter your hotel reservation number to unlock bandiTour before check-in (PRE_TRIP).
        </Text>

        {resolving ? (
          <ActivityIndicator style={{ marginTop: 24 }} color="#1a1a1a" />
        ) : (
          <>
            {hintCode ? (
              <View style={styles.hintBox}>
                <Text style={styles.hintLabel}>Your reservation code</Text>
                <Text style={styles.hintCode}>{hintCode}</Text>
                <Text style={styles.hintNote}>Confirm it below — not shared in the link.</Text>
              </View>
            ) : null}

            <Text style={styles.label}>Hotel reservation number</Text>
            <TextInput
              value={reservationNumber}
              onChangeText={setReservationNumber}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="Reservation number"
              placeholderTextColor="#8a9a90"
              style={styles.input}
            />

            <Text style={styles.label}>Email (optional — match account)</Text>
            <TextInput
              value={guestEmail}
              onChangeText={setGuestEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@email.com"
              placeholderTextColor="#8a9a90"
              style={styles.input}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {donePhase ? (
              <Text style={styles.success}>Stay attached · {donePhase} activated</Text>
            ) : null}

            <Pressable
              onPress={() => void onUnlock()}
              disabled={busy || !reservationNumber.trim()}
              style={[styles.cta, (!reservationNumber.trim() || busy) && styles.ctaDisabled]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaText}>UNLOCK MY BANDITOUR</Text>
              )}
            </Pressable>

            <Text style={styles.footer}>
              {displayHotel
                ? `Co-branded with ${displayHotel} · bandiTour — not a third-party ad.`
                : 'bandiTour — unlocked by your hotel. Not a third-party ad.'}
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f6f5' },
  scroll: { paddingHorizontal: 24, paddingBottom: 40 },
  logo: { width: 120, height: 48, marginBottom: 20 },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#6b7f74',
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
  },
  title: {
    marginTop: 8,
    fontSize: 28,
    lineHeight: 34,
    color: '#14201a',
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
  },
  sub: { marginTop: 10, fontSize: 15, lineHeight: 22, color: '#3d5248' },
  hintBox: {
    marginTop: 20,
    padding: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d7e5dd',
  },
  hintLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#6b7f74' },
  hintCode: {
    marginTop: 6,
    fontSize: 22,
    letterSpacing: 2,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    color: '#14201a',
  },
  hintNote: { marginTop: 6, fontSize: 12, color: '#6b7f74' },
  label: { marginTop: 18, fontSize: 12, fontWeight: '600', color: '#3d5248' },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#c5d4cb',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 12 : 10,
    fontSize: 16,
    color: '#14201a',
  },
  error: { marginTop: 12, color: '#b42318', fontSize: 13 },
  success: { marginTop: 12, color: '#1f6f54', fontSize: 14, fontWeight: '600' },
  cta: {
    marginTop: 24,
    backgroundColor: '#1a1a1a',
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  footer: { marginTop: 20, fontSize: 11, color: '#8a9a90', textAlign: 'center' },
});
