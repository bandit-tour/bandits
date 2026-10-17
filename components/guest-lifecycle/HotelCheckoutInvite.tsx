/**
 * Compact dismissible stay notice — shown between trips only.
 * Must not block City Memory browsing.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { color, radius } from "@/lib/guestDesign";

const STORAGE_KEY = "bandits.hotelCheckoutInvite.dismissed.v1";

type Props = {
  /** Only show when lifecycle is actually after / between trips. */
  visible?: boolean;
  onConnectStay?: () => void;
};

export function HotelCheckoutInvite({ visible = true, onConnectStay }: Props) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (!cancelled) setDismissed(v === "1");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onDismiss = useCallback(() => {
    setDismissed(true);
    void AsyncStorage.setItem(STORAGE_KEY, "1");
  }, []);

  if (!visible || dismissed) return null;

  return (
    <View style={styles.wrap} testID="city-memory-stay-notice" accessibilityRole="summary">
      <View style={styles.top}>
        <Text style={styles.title}>Your stay may have ended. Your journey hasn't.</Text>
        <Pressable
          onPress={onDismiss}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={styles.dismissX}
        >
          <Text style={styles.dismissXText}>✕</Text>
        </Pressable>
      </View>
      {onConnectStay ? (
        <Pressable
          style={styles.cta}
          onPress={onConnectStay}
          accessibilityRole="button"
          accessibilityLabel="Connect a New Stay"
          testID="city-memory-connect-stay-notice"
        >
          <Text style={styles.ctaText}>Connect a New Stay</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: color.ink,
    lineHeight: 21,
  },
  dismissX: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.surfaceSoft,
  },
  dismissXText: { fontSize: 13, color: color.muted, fontWeight: "700" },
  cta: {
    alignSelf: "flex-start",
    backgroundColor: color.ink,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  ctaText: { color: color.surface, fontWeight: "800", fontSize: 13 },
});
