import { Stack, useRouter, type Href } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";

const FAQ = [
  {
    q: "How do I message my hotel?",
    a: "Menu → Support → Contact Hotel, or open Hotelier → Ask the Hotel.",
    href: "/account/contact-hotel" as Href,
  },
  {
    q: "What is Local Friend?",
    a: "Your assigned Local banDit for city tips and chat — separate from hotel reception.",
    href: "/localFriend" as Href,
  },
  {
    q: "Where are my saved places?",
    a: "My Spots holds hearted places. Following is for Local banDits you follow.",
    href: "/mySpots" as Href,
  },
  {
    q: "How do I manage Premium?",
    a: "Account → Premium Membership — never Impact. Upgrade or manage Octopus Concierge there.",
    href: "/account/membership" as Href,
  },
  {
    q: "Where are my receipts?",
    a: "Account → Payments shows methods, bookings, Concierge, Bottle, and invoices.",
    href: "/account/payments" as Href,
  },
  {
    q: "How do I change language?",
    a: "Account → Language — English, Greek, or Hebrew. Saved on this device.",
    href: "/account/language" as Href,
  },
];

/** FAQ — support knowledge base. */
export default function FaqScreen() {
  const router = useRouter();
  const screenOptions = useAppBackScreenOptions({
    title: "FAQ",
    fallback: "/menu" as Href,
    showBack: true,
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={screenOptions} />
      <Text style={styles.lead}>Quick answers for stay, Local Friend, Premium, and the Guest App.</Text>
      {FAQ.map((item) => (
        <Pressable key={item.q} style={styles.card} onPress={() => router.push(item.href)}>
          <Text style={styles.q}>{item.q}</Text>
          <Text style={styles.a}>{item.a}</Text>
          <Text style={styles.link}>Open related screen →</Text>
        </Pressable>
      ))}
      <Pressable style={styles.secondary} onPress={() => router.push("/account/report" as Href)}>
        <Text style={styles.secondaryText}>Still stuck? Report a problem →</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F6F4F0" },
  content: { padding: 16, paddingBottom: 48, maxWidth: 640, width: "100%", alignSelf: "center" },
  lead: { fontSize: 14, color: "#666", lineHeight: 20, marginBottom: 16 },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  q: { fontSize: 15, fontWeight: "800", color: "#1A1A1A" },
  a: { fontSize: 13, color: "#555", marginTop: 8, lineHeight: 19 },
  link: { marginTop: 10, fontSize: 13, fontWeight: "700", color: "#0a7ea4" },
  secondary: { paddingVertical: 16, alignItems: "center" },
  secondaryText: { color: "#0a7ea4", fontWeight: "700" },
});
