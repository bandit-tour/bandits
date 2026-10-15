/**
 * Guest Hotel module gate — FULL_STAY only for hotel services.
 * Without an active stay: Connect My New Stay (not Hotelier OS, not silent fail).
 */

import { useRouter, type Href } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useGuestLifecycle } from "@/lib/guest-lifecycle/useGuestLifecycle";
import type { GuestCapability } from "@/lib/guest-lifecycle/types";

type Props = {
  capability?: GuestCapability;
  children: React.ReactNode;
};

export function HotelierAccessGate({ capability = "hotel_services", children }: Props) {
  const router = useRouter();
  const { loading, isFullStay, can, refresh } = useGuestLifecycle();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.hint}>Checking stay access…</Text>
      </View>
    );
  }

  if (!isFullStay || !can(capability)) {
    return (
      <View style={styles.center} testID="hotel-stay-gate">
        <Text style={styles.title}>Hotel services need a verified stay</Text>
        <Text style={styles.hint}>
          Connect My New Stay to unlock room, breakfast and hotel requests. Your City Memory stays
          available anytime.
        </Text>
        <Pressable
          style={styles.cta}
          onPress={() => router.push("/reactivateStay" as Href)}
          accessibilityRole="button"
        >
          <Text style={styles.ctaText}>Connect My New Stay</Text>
        </Pressable>
        <Pressable
          style={styles.link}
          onPress={() => router.push("/cityMemory" as Href)}
          accessibilityRole="button"
        >
          <Text style={styles.linkText}>Open City Memory</Text>
        </Pressable>
        <Pressable style={styles.link} onPress={() => router.replace("/home" as Href)}>
          <Text style={styles.linkText}>← Home</Text>
        </Pressable>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 28,
    backgroundColor: "#F7F4EE",
  },
  title: { fontSize: 20, fontWeight: "800", color: "#121212", textAlign: "center" },
  hint: { color: "#555", fontSize: 14, lineHeight: 20, textAlign: "center" },
  cta: {
    marginTop: 8,
    backgroundColor: "#121212",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  ctaText: { color: "#FFF", fontWeight: "800" },
  link: { paddingVertical: 8 },
  linkText: { color: "#121212", fontWeight: "700" },
});
