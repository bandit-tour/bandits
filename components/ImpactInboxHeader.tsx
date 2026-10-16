import { useRouter, type Href } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppState } from "@/contexts/AppStateContext";
import { listImpactNotices, type ImpactNotice } from "@/lib/impact/ledger";

/** Local Impact notices on the existing inbox. Created only by a verified ledger write. */
export function ImpactInboxHeader() {
  const router = useRouter();
  const { activeIdentity } = useAppState();
  const userId = activeIdentity?.userId || "guest";
  const [rows, setRows] = useState<ImpactNotice[]>([]);

  useEffect(() => {
    void listImpactNotices(userId).then(setRows);
  }, [userId]);

  if (!rows.length) return null;

  return (
    <View style={styles.wrap} testID="impact-inbox-notices">
      {rows.slice(0, 3).map((n) => (
        <Pressable
          key={n.id}
          style={styles.card}
          onPress={() => router.push(`/impact?event=${encodeURIComponent(n.eventId)}` as Href)}
          testID={`impact-notice-${n.eventId}`}
        >
          <Text style={styles.title}>{n.title}</Text>
          <Text style={styles.body}>{n.message}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 12 },
  card: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F3EFE8",
  },
  title: { fontWeight: "800", color: "#1A1510" },
  body: { marginTop: 4, color: "#3A342C", lineHeight: 18 },
});
