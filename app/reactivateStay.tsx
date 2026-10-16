/**
 * Connect My New Stay — booking number + identity → REACTIVATED.
 * Keeps all prior City Memory. New stay is ADDED, not reset.
 * Hotel privileges require a verified booking — proximity alone is not enough.
 */

import { Stack, useRouter, type Href } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { trackEvent } from "@/lib/analytics";
import {
  getGuestLifecycle,
  transitionAddBookingAndReactivate,
  transitionStartStayFromReactivated,
} from "@/lib/guest-lifecycle";
import { color, radius } from "@/lib/guestDesign";
import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import { getHotelEntry } from "@/lib/pilotSession";
import { liveHotelDisplayName } from "@/lib/stay/liveHotelIdentity";

export default function ReactivateStayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const screenOptions = useAppBackScreenOptions({
    title: "Connect My New Stay",
    fallback: "/menu",
    showBack: true,
    escapeShortcuts: true,
  });
  const [booking, setBooking] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const onActivate = async () => {
    setError(null);
    setBusy(true);
    void trackEvent({ eventName: "reactivation_started" });
    try {
      const entry = await getHotelEntry();
      const life = await getGuestLifecycle();
      const hotelSlug =
        life.activeStay?.hotelSlug || life.lifecycle.lastHotelSlug || entry?.slug || undefined;
      const hotelName = liveHotelDisplayName({
        stayName: life.activeStay?.hotelName || life.lifecycle.lastHotelName,
        entry,
        slug: hotelSlug,
      });
      await transitionAddBookingAndReactivate({
        bookingNumber: booking,
        guestName: name.trim() || undefined,
        hotelSlug: hotelSlug || undefined,
        hotelName: hotelName || undefined,
        city: life.activeStay?.city || life.lifecycle.lastCity || undefined,
      });
      await transitionStartStayFromReactivated();
      void trackEvent({ eventName: "reactivation_completed" });
      const memoryKept = (await getGuestLifecycle()).cityMemory.length;
      setDone(
        memoryKept > 0
          ? `Stay connected — your City Memory stays with you (${memoryKept} kept).`
          : "Stay connected — your City Memory stays with you.",
      );
      setTimeout(() => router.replace("/hotelier" as Href), 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t verify this booking. Check the number and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{
        padding: 24,
        paddingBottom: 48 + insets.bottom,
        gap: 14,
        maxWidth: 520,
        width: "100%",
        alignSelf: "center",
      }}
      keyboardShouldPersistTaps="handled"
      testID="reactivate-stay-scroll"
    >
      <Stack.Screen options={screenOptions} />
      <Text style={styles.kicker}>Verified stay</Text>
      <Text style={styles.title}>Connect My New Stay</Text>
      <Text style={styles.lead}>
        Enter your booking details to unlock hotel requests. Your City Memory stays with you.
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Booking number</Text>
        <TextInput
          style={styles.input}
          value={booking}
          onChangeText={setBooking}
          autoCapitalize="characters"
          placeholder="Reservation number"
          placeholderTextColor={color.muted}
          testID="reactivate-booking-input"
        />

        <Text style={[styles.label, { marginTop: 14 }]}>Name on reservation</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="As on booking"
          placeholderTextColor={color.muted}
          testID="reactivate-name-input"
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {done ? <Text style={styles.done}>{done}</Text> : null}

      <Pressable
        style={[styles.cta, (busy || booking.trim().length < 4) && styles.ctaDisabled]}
        disabled={busy || booking.trim().length < 4}
        onPress={() => void onActivate()}
        accessibilityRole="button"
        testID="reactivate-submit"
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.ctaText}>Verify stay</Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => router.replace("/cityMemory" as Href)}
        accessibilityRole="button"
        testID="reactivate-keep-browsing"
      >
        <Text style={styles.back}>Keep browsing City Memory</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surfaceWarm },
  kicker: {
    fontSize: 11,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    color: color.brand,
    fontWeight: "800",
  },
  title: { fontSize: 28, fontWeight: "800", color: color.ink, letterSpacing: -0.4 },
  lead: { fontSize: 15, lineHeight: 22, color: color.muted },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    padding: 16,
    gap: 6,
  },
  label: { fontSize: 12, fontWeight: "800", color: color.inkSoft, letterSpacing: 0.3 },
  input: {
    borderWidth: 1,
    borderColor: color.hairline,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    backgroundColor: color.surfaceWarm,
    color: color.ink,
  },
  cta: {
    marginTop: 4,
    backgroundColor: color.ink,
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: "center",
  },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { color: "#FFF", fontWeight: "800", fontSize: 15 },
  error: { color: "#B00020", fontSize: 14, lineHeight: 20 },
  done: { color: color.statusGreen, fontSize: 14, lineHeight: 20 },
  back: {
    textAlign: "center",
    color: color.ink,
    fontWeight: "700",
    marginTop: 6,
    textDecorationLine: "underline",
  },
});
