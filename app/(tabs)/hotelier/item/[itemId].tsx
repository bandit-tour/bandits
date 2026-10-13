import { Stack, useLocalSearchParams, type Href } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import { HOTELIER_MODULES, type HotelierModuleId } from "@/lib/guest-workspace/hotelierDashboard";

/** Deep Hotelier item (dish / treatment / request) — Back → module. */
export default function HotelierItemScreen() {
  const { itemId, module, title, detail } = useLocalSearchParams<{
    itemId: string;
    module?: string;
    title?: string;
    detail?: string;
  }>();
  const moduleId = String(module || "");
  const fallback = (isModule(moduleId) ? `/hotelier/${moduleId}` : "/hotelier") as Href;
  const displayTitle = String(title || decodeURIComponent(String(itemId || "Details")));
  const displayDetail = String(detail || "");
  const parent = isModule(moduleId) ? HOTELIER_MODULES[moduleId] : null;
  const [done, setDone] = useState(false);

  const screenOptions = useAppBackScreenOptions({
    title: displayTitle,
    fallback,
    showBack: true,
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={screenOptions} />
      {parent ? <Text style={styles.kicker}>{parent.title}</Text> : null}
      <Text style={styles.title}>{displayTitle}</Text>
      <Text style={styles.detail}>{displayDetail || "Guest-facing hotel service detail."}</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>For your stay</Text>
        <Pressable style={styles.cta} onPress={() => setDone(true)}>
          <Text style={styles.ctaText}>{done ? "Requested" : "Request this"}</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => setDone(true)}>
          <Text style={styles.secondaryText}>Add a special note</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => setDone(true)}>
          <Text style={styles.secondaryText}>Message reception</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function isModule(v: string): v is HotelierModuleId {
  return v in HOTELIER_MODULES;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0F0E0C" },
  content: { padding: 20, paddingBottom: 48 },
  kicker: {
    fontSize: 12,
    fontWeight: "800",
    color: "rgba(240,215,160,0.85)",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  title: { fontSize: 26, fontWeight: "800", color: "#F7F2E8" },
  detail: { fontSize: 15, lineHeight: 22, color: "rgba(247,242,232,0.7)", marginTop: 10 },
  card: {
    marginTop: 24,
    backgroundColor: "#1A1814",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(240,215,160,0.1)",
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#F7F2E8", marginBottom: 12 },
  cta: {
    backgroundColor: "#F0D7A0",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  ctaText: { color: "#0A0908", fontWeight: "800" },
  secondary: { paddingVertical: 12, alignItems: "center" },
  secondaryText: { color: "#F0D7A0", fontWeight: "700" },
});
