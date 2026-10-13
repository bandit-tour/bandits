import { Stack, useRouter, type Href } from "expo-router";
import React from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import { GUEST_STAY } from "@/lib/guest-workspace/hotelierDashboard";
import { useGuestLifecycle } from "@/lib/guest-lifecycle/useGuestLifecycle";
import { isIsolatedPlaySandboxSlug, liveHotelDisplayName } from "@/lib/stay/liveHotelIdentity";

/** Emergency / urgent help — hotel first, then local emergency. */
export default function EmergencyScreen() {
  const router = useRouter();
  const { activeStay } = useGuestLifecycle();
  const hotelName = liveHotelDisplayName({
    stayName: activeStay?.hotelName,
    slug: activeStay?.hotelSlug,
  });
  const playSandbox = isIsolatedPlaySandboxSlug(activeStay?.hotelSlug);
  const phone = playSandbox ? GUEST_STAY.receptionPhone : null;
  const screenOptions = useAppBackScreenOptions({
    title: "Emergency",
    fallback: "/menu" as Href,
    showBack: true,
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={screenOptions} />
      <View style={styles.alert}>
        <Text style={styles.alertTitle}>Urgent help</Text>
        <Text style={styles.alertLead}>
          If you are in immediate danger, call local emergency services first.
        </Text>
      </View>

      <Pressable style={styles.danger} onPress={() => void Linking.openURL("tel:112")}>
        <Text style={styles.dangerText}>Call 112 · EU Emergency</Text>
      </Pressable>

      {phone ? (
        <Pressable
          style={styles.primary}
          onPress={() => void Linking.openURL(`tel:${phone.replace(/\s/g, "")}`)}
        >
          <Text style={styles.primaryText}>Call hotel reception · {phone}</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.primary} onPress={() => router.push("/hotelier/askHotel" as Href)}>
          <Text style={styles.primaryText}>
            {hotelName ? `Message ${hotelName} reception` : "Message hotel reception"}
          </Text>
        </Pressable>
      )}

      <Pressable style={styles.secondary} onPress={() => router.push("/hotelier" as Href)}>
        <Text style={styles.secondaryText}>Open hotel stay →</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F6F4F0" },
  content: { padding: 16, paddingBottom: 48, maxWidth: 560, width: "100%", alignSelf: "center" },
  alert: {
    backgroundColor: "#FEF2F2",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  alertTitle: { fontSize: 18, fontWeight: "800", color: "#991B1B" },
  alertLead: { fontSize: 14, color: "#7F1D1D", marginTop: 8, lineHeight: 20 },
  danger: {
    backgroundColor: "#B91C1C",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  dangerText: { color: "#FFF", fontWeight: "800", fontSize: 15 },
  primary: {
    backgroundColor: "#1C1814",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryText: { color: "#F0D7A0", fontWeight: "800", fontSize: 15 },
  secondary: { paddingVertical: 16, alignItems: "center" },
  secondaryText: { color: "#0a7ea4", fontWeight: "700", fontSize: 14 },
});
