/**
 * Hotelier module gate — FULL_STAY only for hotel services.
 * AFTER_TRIP guests are redirected to City Memory / reactivation.
 */

import { useRouter, type Href } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

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

  useEffect(() => {
    if (loading) return;
    if (!isFullStay || !can(capability)) {
      router.replace("/hotelier" as Href);
    }
  }, [loading, isFullStay, can, capability, router]);

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
      <View style={styles.center}>
        <Text style={styles.hint}>Hotel services unlock with an active stay.</Text>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 24 },
  hint: { color: "#666", fontSize: 14, textAlign: "center" },
});
