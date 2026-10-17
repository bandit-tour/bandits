import { useRouter, type Href } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ImpactInboxHeader } from "@/components/ImpactInboxHeader";
import { useAppState } from "@/contexts/AppStateContext";
import { listVisibleLifecycleNotices, type LifecycleNotice } from "@/lib/lifecycle/notices";

const CLASS_LABEL = { service: "Service", social: "Social", marketing: "Marketing" } as const;

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

  const reload = useCallback(() => {
    if (!userId) return;
    void listVisibleLifecycleNotices(userId).then(setRows);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return (
    <View>
      <ImpactInboxHeader />
      <Pressable onPress={() => router.push("/settings" as Href)} testID="notice-prefs-link">
        <Text style={styles.prefs}>Notification preferences</Text>
      </Pressable>
      {rows.length ? (
        <View style={styles.wrap} testID="lifecycle-inbox-notices">
          {rows.slice(0, 8).map((n) => (
            <Pressable
              key={n.id}
              style={styles.card}
              onPress={() => router.push(n.href as Href)}
              testID={`lifecycle-notice-${n.id}`}
            >
              <Text style={styles.classLabel} testID={`notice-class-${n.notificationClass}`}>
                {CLASS_LABEL[n.notificationClass]}
              </Text>
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
  prefs: { color: "#1F4E79", fontWeight: "700", marginBottom: 10 },
  wrap: { gap: 8, marginBottom: 12 },
  card: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#EEF4F7",
  },
  classLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4, color: "#5C6B73", textTransform: "uppercase" },
  title: { fontWeight: "800", color: "#1A1510", marginTop: 4 },
  body: { marginTop: 4, color: "#3A342C", lineHeight: 18 },
});
