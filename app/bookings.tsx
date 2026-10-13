import { Stack, useRouter, type Href } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import { workspaceGet } from "@/lib/workspace/client";
import { formatEuro } from "@/lib/guest-workspace/productWorlds";

type BookingRow = {
  id: string;
  experienceTitle?: string;
  status: string;
  amountCents?: number;
  payment?: { providerRef?: string; stripeTransferId?: string };
};

/** Traveler bookings — canonical Workspace records, not demo tiles. */
export default function GuestBookingsScreen() {
  const router = useRouter();
  const screenOptions = useAppBackScreenOptions({
    title: "Bookings",
    fallback: "/menu" as Href,
    showBack: true,
  });
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void workspaceGet<{ bookings?: BookingRow[] }>("/api/bookings").then((res) => {
      if (!res.ok) {
        setError(res.detail);
        return;
      }
      setRows(res.data.bookings || []);
    });
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={screenOptions} />
      <Text style={styles.lead}>Your confirmed local experiences — the same records the host manages.</Text>
      {error ? <Text style={styles.err}>{error}</Text> : null}
      {rows.length === 0 && !error ? <Text style={styles.lead}>No bookings yet.</Text> : null}
      {rows.map((b) => (
        <Pressable
          key={b.id}
          style={styles.card}
          onPress={() => router.push("/experiences" as Href)}
        >
          <Text style={styles.title}>{b.experienceTitle || "Local experience"}</Text>
          <Text style={styles.meta}>
            {b.status === "paid" || b.status === "completed"
              ? `Confirmed · ${formatEuro(b.amountCents || 0)}`
              : b.status === "requested"
                ? `Requested · ${formatEuro(b.amountCents || 0)}`
                : `${b.status} · ${formatEuro(b.amountCents || 0)}`}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFCF8" },
  content: { padding: 20, paddingBottom: 48, gap: 12 },
  lead: { color: "#6A655C", fontSize: 15, lineHeight: 22, marginBottom: 8 },
  err: { color: "#B85C38", marginBottom: 8 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(26,26,26,0.08)",
  },
  title: { fontSize: 17, fontWeight: "700", color: "#1A1A1A" },
  meta: { marginTop: 6, fontSize: 13, color: "#6A655C" },
});
