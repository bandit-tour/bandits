import { Stack, useRouter, type Href } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";

const LINKS: { title: string; href: Href; sub: string }[] = [
  { title: "Account settings", href: "/settings", sub: "Alerts & preferences" },
  { title: "Premium Membership", href: "/account/membership", sub: "Octopus Concierge · billing" },
  { title: "Payments", href: "/account/payments", sub: "Methods · history · invoices" },
  { title: "Language", href: "/account/language", sub: "English · Greek · Hebrew" },
  { title: "Notifications", href: "/notifications", sub: "Inbox & stay alerts" },
  { title: "Privacy", href: "/account/privacy", sub: "Data & visibility" },
  { title: "Help & FAQ", href: "/account/faq", sub: "Knowledge base" },
  { title: "Technical Support", href: "/account/technical-support", sub: "bandiTour support" },
];

/** Account & Settings hub — not mixed with travel identity. */
export default function AccountIndexScreen() {
  const router = useRouter();
  const screenOptions = useAppBackScreenOptions({
    title: "Account & Settings",
    fallback: "/menu" as Href,
    showBack: true,
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={screenOptions} />
      <Text style={styles.lead}>Membership, payments, language, privacy, and help.</Text>
      {LINKS.map((l) => (
        <Pressable key={l.title} style={styles.row} onPress={() => router.push(l.href)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{l.title}</Text>
            <Text style={styles.sub}>{l.sub}</Text>
          </View>
          <Text style={styles.chev}>→</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F6F4F0" },
  content: { padding: 16, paddingBottom: 48, maxWidth: 560, width: "100%", alignSelf: "center" },
  lead: { fontSize: 14, color: "#666", marginBottom: 16, lineHeight: 20 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
  },
  title: { fontSize: 15, fontWeight: "800", color: "#1A1A1A" },
  sub: { fontSize: 12, color: "#777", marginTop: 3 },
  chev: { fontSize: 16, color: "#0a7ea4", fontWeight: "700" },
});
