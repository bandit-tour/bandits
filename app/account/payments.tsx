import { Stack, useRouter, type Href } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import {
  CATEGORY_LABEL,
  PAYMENT_HISTORY,
  PAYMENT_METHODS,
  type PaymentTxn,
} from "@/lib/guest-workspace/accountPayments";

const FILTERS: Array<"all" | PaymentTxn["category"]> = [
  "all",
  "experience",
  "concierge",
  "bottle",
  "smarttraveler",
  "hotel",
  "membership",
];

/** Payments — NOT bandiShop. Methods, history, invoices. */
export default function PaymentsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const screenOptions = useAppBackScreenOptions({
    title: "Payments",
    fallback: "/menu" as Href,
    showBack: true,
  });

  const rows =
    filter === "all" ? PAYMENT_HISTORY : PAYMENT_HISTORY.filter((t) => t.category === filter);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={screenOptions} />

      <Text style={styles.lead}>
        Payment methods, bookings, Concierge, Bottle, and SmartTraveler — invoices in one place.
      </Text>

      <Text style={styles.section}>Payment methods</Text>
      {PAYMENT_METHODS.map((m) => (
        <View key={m.id} style={styles.method}>
          <View style={{ flex: 1 }}>
            <Text style={styles.methodTitle}>
              {m.brand} ···· {m.last4}
            </Text>
            <Text style={styles.methodSub}>Expires {m.expires}</Text>
          </View>
          {m.isDefault ? (
            <Text style={styles.defaultPill}>Default</Text>
          ) : (
            <Text style={styles.linkMuted}>Set default</Text>
          )}
        </View>
      ))}
      <Pressable style={styles.addBtn} onPress={() => undefined}>
        <Text style={styles.addBtnText}>+ Add payment method</Text>
      </Pressable>

      <Text style={styles.section}>History</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            style={[styles.chip, filter === f && styles.chipOn]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.chipText, filter === f && styles.chipTextOn]}>
              {f === "all" ? "All" : CATEGORY_LABEL[f]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {rows.map((tx) => (
        <Pressable key={tx.id} style={styles.txn} onPress={() => undefined}>
          <View style={{ flex: 1 }}>
            <Text style={styles.txnCat}>{CATEGORY_LABEL[tx.category]}</Text>
            <Text style={styles.txnTitle}>{tx.title}</Text>
            <Text style={styles.txnMeta}>
              {tx.dateLabel} · {tx.receiptId} · {tx.status}
            </Text>
          </View>
          <Text style={styles.txnAmt}>{tx.amountLabel}</Text>
        </Pressable>
      ))}

      <Pressable style={styles.secondary} onPress={() => router.push("/account/membership" as Href)}>
        <Text style={styles.secondaryText}>Premium membership billing →</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F6F4F0" },
  content: { padding: 16, paddingBottom: 48, maxWidth: 640, width: "100%", alignSelf: "center" },
  lead: { fontSize: 14, color: "#666", lineHeight: 20, marginBottom: 18 },
  section: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6B5A3A",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 10,
    marginTop: 8,
  },
  method: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  methodTitle: { fontSize: 15, fontWeight: "800", color: "#1A1A1A" },
  methodSub: { fontSize: 12, color: "#777", marginTop: 3 },
  defaultPill: {
    fontSize: 11,
    fontWeight: "800",
    color: "#3D6B4F",
    backgroundColor: "rgba(61,107,79,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
  },
  linkMuted: { fontSize: 12, fontWeight: "700", color: "#E03131" },
  addBtn: { paddingVertical: 12, marginBottom: 8 },
  addBtnText: { color: "#E03131", fontWeight: "700", fontSize: 14 },
  chips: { gap: 8, paddingBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  chipOn: { backgroundColor: "#1C1814" },
  chipText: { fontSize: 12, fontWeight: "700", color: "#555" },
  chipTextOn: { color: "#F0D7A0" },
  txn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    gap: 10,
  },
  txnCat: { fontSize: 11, fontWeight: "700", color: "#9A7B4F", textTransform: "uppercase" },
  txnTitle: { fontSize: 14, fontWeight: "800", color: "#1A1A1A", marginTop: 2 },
  txnMeta: { fontSize: 12, color: "#888", marginTop: 4 },
  txnAmt: { fontSize: 15, fontWeight: "800", color: "#1A1A1A" },
  secondary: { paddingVertical: 16, alignItems: "center" },
  secondaryText: { color: "#E03131", fontWeight: "700" },
});
