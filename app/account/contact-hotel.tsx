import { Stack, useRouter, type Href } from "expo-router";
import React from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import { GUEST_STAY } from "@/lib/guest-workspace/hotelierDashboard";
import { useGuestLifecycle } from "@/lib/guest-lifecycle/useGuestLifecycle";
import { isIsolatedPlaySandboxSlug, liveHotelDisplayName } from "@/lib/stay/liveHotelIdentity";

/** Contact Hotel — reception / hotel chat. NOT Local Friend. */
export default function ContactHotelScreen() {
  const router = useRouter();
  const { activeStay } = useGuestLifecycle();
  const hotelName = liveHotelDisplayName({
    stayName: activeStay?.hotelName,
    slug: activeStay?.hotelSlug,
  });
  const playSandbox = isIsolatedPlaySandboxSlug(activeStay?.hotelSlug);
  const roomLine = activeStay?.roomNumber
    ? `Room ${activeStay.roomNumber}`
    : playSandbox
      ? `Room ${GUEST_STAY.roomNumber}`
      : hotelName || "Your stay";
  const phone = playSandbox ? GUEST_STAY.receptionPhone : null;
  const email = playSandbox ? GUEST_STAY.receptionEmail : null;
  const screenOptions = useAppBackScreenOptions({
    title: "Contact Hotel",
    fallback: "/menu" as Href,
    showBack: true,
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={screenOptions} />
      <Text style={styles.kicker}>
        {hotelName ? `${hotelName} · ${roomLine}` : `Hotel reception · ${roomLine}`}
      </Text>
      <Text style={styles.title}>Contact Hotel</Text>
      <Text style={styles.lead}>
        Front desk for stay questions, keys, and hotel requests — not your Local Friend.
      </Text>
      <Pressable style={styles.primary} onPress={() => router.push("/hotelier/askHotel" as Href)}>
        <Text style={styles.primaryText}>Message hotel reception</Text>
      </Pressable>
      {phone ? (
        <Pressable
          style={styles.row}
          onPress={() => void Linking.openURL(`tel:${phone.replace(/\s/g, "")}`)}
        >
          <Text style={styles.rowTitle}>Call reception</Text>
          <Text style={styles.rowSub}>{phone}</Text>
        </Pressable>
      ) : (
        <View style={styles.row}>
          <Text style={styles.rowTitle}>Call reception</Text>
          <Text style={styles.rowSub}>Ask the front desk for the hotel phone number</Text>
        </View>
      )}
      {email ? (
        <Pressable style={styles.row} onPress={() => void Linking.openURL(`mailto:${email}`)}>
          <Text style={styles.rowTitle}>Email hotel</Text>
          <Text style={styles.rowSub}>{email}</Text>
        </Pressable>
      ) : null}
      <Pressable style={styles.secondary} onPress={() => router.push("/localFriend" as Href)}>
        <Text style={styles.secondaryText}>Looking for Local Friend instead? →</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F6F4F0" },
  content: { padding: 16, paddingBottom: 48, maxWidth: 560, width: "100%", alignSelf: "center" },
  kicker: {
    fontSize: 11,
    fontWeight: "800",
    color: "#9A7B4F",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  title: { fontSize: 26, fontWeight: "800", color: "#1A1A1A", marginTop: 6 },
  lead: { fontSize: 14, color: "#666", lineHeight: 20, marginTop: 10, marginBottom: 20 },
  primary: {
    backgroundColor: "#1C1814",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 14,
  },
  primaryText: { color: "#F0D7A0", fontWeight: "800", fontSize: 15 },
  row: {
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  rowTitle: { fontSize: 15, fontWeight: "800", color: "#1A1A1A" },
  rowSub: { fontSize: 13, color: "#777", marginTop: 4 },
  secondary: { paddingVertical: 16, alignItems: "center" },
  secondaryText: { color: "#0a7ea4", fontWeight: "700", fontSize: 14 },
});
