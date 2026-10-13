/**
 * ADD / ACTIVATE NEW STAY — booking number + identity → REACTIVATED.
 * Keeps all prior City Memory. New stay is ADDED, not reset.
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
import { getHotelEntry } from "@/lib/pilotSession";
import { liveHotelDisplayName } from "@/lib/stay/liveHotelIdentity";

export default function ReactivateStayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
      const snap = await transitionAddBookingAndReactivate({
        bookingNumber: booking,
        guestName: name.trim() || undefined,
        hotelSlug: hotelSlug || undefined,
        hotelName: hotelName || undefined,
        city: life.activeStay?.city || life.lifecycle.lastCity || undefined,
      });
      // Begin stay privileges immediately after successful attach
      const active = await transitionStartStayFromReactivated();
      void trackEvent({ eventName: "reactivation_completed" });
      const memoryKept = (await getGuestLifecycle()).cityMemory.length;
      setDone(
        `Reactivated · ${active.lifecycle.state} · ${active.lifecycle.accessLevel}. City Memory kept (${memoryKept} items). Prior stays: ${snap.stays.length}.`,
      );
      setTimeout(() => router.replace("/hotelier" as Href), 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Activation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: 20, paddingBottom: 48 + insets.bottom, gap: 14 }}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "Activate Stay" }} />
      <Text style={styles.kicker}>Same account · new stay</Text>
      <Text style={styles.title}>Add / Activate New Stay</Text>
      <Text style={styles.lead}>
        Enter your booking number. We attach this stay to your existing guest — City Memory, saves, and
        follows stay intact. Hotel privileges restore on activation.
      </Text>

      <Text style={styles.label}>Booking number</Text>
      <TextInput
        style={styles.input}
        value={booking}
        onChangeText={setBooking}
        autoCapitalize="characters"
        placeholder="Reservation number"
        placeholderTextColor="#999"
      />

      <Text style={styles.label}>Name on reservation (verify)</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="As on booking"
        placeholderTextColor="#999"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {done ? <Text style={styles.done}>{done}</Text> : null}

      <Pressable
        style={[styles.cta, busy && styles.ctaDisabled]}
        disabled={busy || booking.trim().length < 4}
        onPress={() => void onActivate()}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Verify & Reactivate</Text>}
      </Pressable>

      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>Keep browsing City Memory</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F4EE" },
  kicker: {
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: "#6B5A3A",
    fontWeight: "700",
  },
  title: { fontSize: 26, fontWeight: "800", color: "#1A1A1A" },
  lead: { fontSize: 15, lineHeight: 22, color: "#4A4A4A" },
  label: { fontSize: 13, fontWeight: "700", color: "#333", marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#D6CFC3",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#FFF",
    color: "#1A1A1A",
  },
  cta: {
    marginTop: 10,
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: "#FFF", fontWeight: "800", fontSize: 15 },
  error: { color: "#B00020", fontSize: 14 },
  done: { color: "#1B5E20", fontSize: 14, lineHeight: 20 },
  back: { textAlign: "center", color: "#6B5A3A", fontWeight: "700", marginTop: 8 },
});
