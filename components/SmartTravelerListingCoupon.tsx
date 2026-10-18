import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { SmartTravelerListingCoupon } from "@/lib/guest-workspace/smartTravelerListingCode";
import { copyToClipboard } from "@/lib/copyToClipboard";
import { color, radius } from "@/lib/guestDesign";

type Props = {
  coupon: SmartTravelerListingCoupon;
  compact?: boolean;
  testID?: string;
};

export default function SmartTravelerListingCouponRow({ coupon, compact, testID }: Props) {
  const [copied, setCopied] = useState(false);

  return (
    <View
      style={[styles.wrap, compact && styles.wrapCompact]}
      testID={testID || "st-listing-coupon"}
    >
      {coupon.disclaimer ? (
        <Text style={styles.disclaimer} testID="st-coupon-preview-label">
          {coupon.disclaimer}
        </Text>
      ) : (
        <Text style={styles.eyebrow}>Coupon code</Text>
      )}
      <View style={styles.row}>
        <Text style={styles.code} selectable testID="st-coupon-code-value">
          {coupon.code}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.copyBtn, pressed && styles.copyPressed]}
          accessibilityRole="button"
          accessibilityLabel="Copy Code"
          testID="st-copy-code"
          onPress={() => {
            void copyToClipboard(coupon.code).then((ok) => {
              if (ok) {
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }
            });
          }}
        >
          <Text style={styles.copyText}>{copied ? "Copied" : "Copy Code"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  wrapCompact: {
    marginTop: 8,
    padding: 8,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: color.muted,
  },
  disclaimer: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: color.muted,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 6,
  },
  code: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: color.ink,
    fontVariant: ["tabular-nums"],
  },
  copyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: color.ink,
  },
  copyPressed: { opacity: 0.88 },
  copyText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
});
