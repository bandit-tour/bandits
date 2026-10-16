import { useRouter, type Href } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ImpactInboxHeader } from "@/components/ImpactInboxHeader";
import { useAppState } from "@/contexts/AppStateContext";
import { listLifecycleNotices, type LifecycleNotice } from "@/lib/lifecycle/notices";

export function LifecycleInboxHeader() {
  const router = useRouter();
  const { activeIdentity, getCurrentUser } = useAppState();
  const [userId, setUserId] = useState<string | null>(activeIdentity?.userId || null);
  const [rows, setRows] = useState<LifecycleNotice[]>([]);

  useEffect(() => {
    let cancelled = false;
    void getCurrentUser()
      .catch(() => null)
      .then((user) => {
        if (!cancelled) setUserId(user?.id || activeIdentity?.userId || null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeIdentity?.userId, getCurrentUser]);

  useEffect(() => {
    if (!userId) return;
    void listLifecycleNotices(userId).then(setRows);
  }, [userId]);

  return (
    <View>
      <ImpactInboxHeader />
      {rows.length ? (
        <View style={styles.wrap} testID="lifecycle-inbox-notices">
          {rows.slice(0, 3).map((n) => (
            <Pressable
              key={n.id}
              style={styles.card}
              onPress={() => router.push(n.href as Href)}
              testID={`lifecycle-notice-${n.id}`}
            >
              <Text style={styles.title}>{n.title}</Text>
              <Text style={styles.body}>{n.message}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 12 },
  card: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#EEF4F7",
  },
  title: { fontWeight: "800", color: "#1A1510" },
  body: { marginTop: 4, color: "#3A342C", lineHeight: 18 },
});
