import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import { HOTELIER_MODULES, type HotelierModuleId } from "@/lib/guest-workspace/hotelierDashboard";
import { claimHotelOffer } from "@/lib/workspace/actions";

/** Deep Hotelier item (dish / treatment / request) — Back → module. */
export default function HotelierItemScreen() {
  const router = useRouter();
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const screenOptions = useAppBackScreenOptions({
    title: displayTitle,
    fallback,
    showBack: true,
  });

  const requestItem = () => {
    if (busy || done) return;
    setBusy(true);
    setError(null);
    void claimHotelOffer({
      offerId: `item:${String(itemId || displayTitle)}`,
      title: displayTitle,
    }).then((r) => {
      setBusy(false);
      if (!r.ok) {
        setError(
          String(r.detail || "") ||
            "This hotel action needs a verified stay. Use Connect My New Stay from More.",
        );
        return;
      }
      setDone(true);
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={screenOptions} />
      {parent ? <Text style={styles.kicker}>{parent.title}</Text> : null}
      <Text style={styles.title}>{displayTitle}</Text>
      <Text style={styles.detail}>{displayDetail || "Guest-facing hotel service detail."}</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>For your stay</Text>
        <Pressable style={styles.cta} onPress={requestItem} disabled={busy || done}>
          <Text style={styles.ctaText}>
            {done ? "Requested" : busy ? "Sending…" : "Request this"}
          </Text>
        </Pressable>
        {error ? (
          <>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              style={styles.secondary}
              onPress={() => router.push("/reactivateStay" as Href)}
              testID="hotel-item-connect-stay"
            >
              <Text style={styles.secondaryText}>Connect My New Stay</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable style={styles.secondary} onPress={requestItem} disabled={busy || done}>
              <Text style={styles.secondaryText}>Add a special note</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={requestItem} disabled={busy || done}>
              <Text style={styles.secondaryText}>Message reception</Text>
            </Pressable>
          </>
        )}
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
  errorText: {
    color: "#F0B0A0",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
    textAlign: "center",
  },
});
