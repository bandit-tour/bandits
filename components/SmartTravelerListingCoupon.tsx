import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { SmartTravelerListingCoupon } from "@/lib/guest-workspace/smartTravelerListingCode";
import { copyToClipboard } from "@/lib/copyToClipboard";
import { color, radius } from "@/lib/guestDesign";

type Props = {
  coupon: SmartTravelerListingCoupon;
  compact?: boolean;
  testID?: string;
  /** Detail profile — show offer copy and redemption status. */
  profile?: boolean;
  showClaimCta?: boolean;
  claimBusy?: boolean;
  onClaim?: () => void;
};

export default function SmartTravelerListingCouponRow({
  coupon,
  compact,
  testID,
  profile,
  showClaimCta,
  claimBusy,
  onClaim,
}: Props) {
  const [copied, setCopied] = useState(false);
  const showOffer = profile || !compact;

  return (
    <View
      style={[styles.wrap, compact && !profile && styles.wrapCompact, profile && styles.wrapProfile]}
      testID={testID || "st-listing-coupon"}
    >
      {profile ? (
        <Text style={styles.sectionTitle} testID="st-profile-coupon-section">
          Coupon
        </Text>
      ) : null}

      {coupon.disclaimer ? (
        <Text style={styles.disclaimer} testID="st-coupon-preview-label">
          {coupon.disclaimer}
        </Text>
      ) : (
        <Text style={styles.eyebrow}>Coupon code</Text>
      )}

      {showOffer && coupon.offerTitle ? (
        <Text style={styles.offerTitle} testID="st-coupon-offer-title">
          {coupon.offerTitle}
        </Text>
      ) : null}
      {showOffer && coupon.offerDetail ? (
        <Text style={styles.offerDetail} testID="st-coupon-offer-detail">
          {coupon.offerDetail}
        </Text>
      ) : null}

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

      {showOffer ? (
        <Text style={styles.status} testID="st-coupon-redemption-status">
          {coupon.redemptionLabel}
        </Text>
      ) : null}

      {profile && showClaimCta && onClaim ? (
        <Pressable
          style={[styles.claimBtn, claimBusy && styles.claimDisabled]}
          disabled={claimBusy}
          onPress={onClaim}
          testID="local-find-claim-cta"
        >
          <Text style={styles.claimText}>{claimBusy ? "Claiming…" : "Claim discount code"}</Text>
        </Pressable>
      ) : null}

      {profile && coupon.redemptionPhase === "redeemed" ? (
        <Text style={styles.redeemedBanner} testID="st-coupon-redeemed">
          This offer was redeemed — no further claim needed.
        </Text>
      ) : null}
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
  wrapProfile: {
    marginTop: 22,
    padding: 16,
    borderRadius: radius.lg,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: color.ink,
    marginBottom: 10,
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
  offerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: color.ink,
    marginTop: 8,
    lineHeight: 22,
  },
  offerDetail: {
    fontSize: 14,
    color: color.inkSoft,
    marginTop: 6,
    lineHeight: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 10,
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
  status: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "600",
    color: color.muted,
    lineHeight: 17,
  },
  claimBtn: {
    marginTop: 14,
    alignSelf: "flex-start",
    backgroundColor: color.brand,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  claimDisabled: { opacity: 0.6 },
  claimText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  redeemedBanner: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: "700",
    color: color.statusGreen,
  },
});
