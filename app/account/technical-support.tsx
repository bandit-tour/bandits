import { Stack, useRouter, type Href } from "expo-router";
import React from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";

/** Technical Support — bandiTour product support (not hotel / Local Friend). */
export default function TechnicalSupportScreen() {
  const router = useRouter();
  const screenOptions = useAppBackScreenOptions({
    title: "Technical Support",
    fallback: "/menu" as Href,
    showBack: true,
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={screenOptions} />
      <Text style={styles.kicker}>bandiTour</Text>
      <Text style={styles.title}>Technical Support</Text>
      <Text style={styles.lead}>
        App login, notifications, Bottle journeys, SmartTraveler claims, and account issues.
      </Text>
      <Pressable style={styles.row} onPress={() => router.push("/account/report" as Href)}>
        <Text style={styles.rowTitle}>Report a technical problem</Text>
        <Text style={styles.rowCta}>Open →</Text>
      </Pressable>
      <Pressable style={styles.row} onPress={() => router.push("/account/faq" as Href)}>
        <Text style={styles.rowTitle}>FAQ & knowledge base</Text>
        <Text style={styles.rowCta}>Open →</Text>
      </Pressable>
      <Pressable
        style={styles.row}
        onPress={() =>
          void Linking.openURL("mailto:expert@banditours.com?subject=Guest%20App%20support")
        }
      >
        <Text style={styles.rowTitle}>Email expert@banditours.com</Text>
        <Text style={styles.rowCta}>Mail →</Text>
      </Pressable>
      <Pressable style={styles.row} onPress={() => router.push("/bandiTeam" as Href)}>
        <Text style={styles.rowTitle}>bandiTeam desk</Text>
        <Text style={styles.rowCta}>Open →</Text>
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: "#1A1A1A" },
  rowCta: { fontSize: 13, fontWeight: "800", color: "#0a7ea4" },
});
