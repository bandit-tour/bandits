import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { Image as ExpoImage } from "expo-image";

import { getBanditById } from "@/app/services/bandits";
import LocalBanditOctopusIcon from "@/components/LocalBanditOctopusIcon";
import { color, radius } from "@/lib/guestDesign";
import { OCTOPUS_CONCIERGE_OFFER } from "@/lib/octopus-concierge/principle";
import { ensureAnonymousSession } from "@/lib/pilotSession";

type Props = {
  banditId: string;
  banditName: string;
  portraitUri?: string | null;
  /** Paid Stripe checkout. Pending providers keep this false. */
  checkoutEnabled: boolean;
  verificationPending?: boolean;
  /** AI-operated Local banDit — quiet disclosure, never "human Verification Pending". */
  aiOperated?: boolean;
  /** Inside an existing scroll view (profile). The premium route scrolls itself. */
  embedded?: boolean;
};

/**
 * Provider-driven Octopus Concierge presentation.
 * Copy, requests, and recharge all bind to the bandit id passed in.
 * Checkout and task fulfillment stay closed unless checkoutEnabled is true.
 */
export default function OctopusConciergeExperience({
  banditId,
  banditName,
  portraitUri,
  checkoutEnabled,
  verificationPending = false,
  aiOperated = false,
  embedded = false,
}: Props) {
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, 560);
  const [resolvedName, setResolvedName] = useState(banditName);
  const [resolvedPortrait, setResolvedPortrait] = useState(portraitUri || null);

  useEffect(() => {
    setResolvedName(banditName);
  }, [banditName]);

  useEffect(() => {
    const passed = banditName.trim();
    const needsName = !passed || passed === "Local banDit";
    const needsPhoto = !portraitUri;
    if (!needsName && !needsPhoto) return;
    let cancelled = false;
    (async () => {
      try {
        await ensureAnonymousSession().catch(() => undefined);
        const bandit = await getBanditById(banditId);
        if (cancelled || !bandit) return;
        const name = String(bandit.name || "").trim();
        if (needsName && name) setResolvedName(name);
        if (needsPhoto) {
          for (const u of [bandit.image_url, bandit.face_image_url]) {
            const t = String(u || "").trim();
            if (t.startsWith("http://") || t.startsWith("https://")) {
              setResolvedPortrait(t);
              break;
            }
          }
        }
      } catch {
        /* keep the name the profile already passed */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [banditId, banditName, portraitUri]);

  const displayName = resolvedName.trim() || "Local banDit";
  const first = displayName.split(/\s+/)[0] || "your banDit";
  const portrait =
    resolvedPortrait && (resolvedPortrait.startsWith("http://") || resolvedPortrait.startsWith("https://"))
      ? resolvedPortrait
      : null;
  const isAi = aiOperated === true;
  const pending = !isAi && verificationPending === true && checkoutEnabled !== true;

  const body = (
    <View
      style={[styles.content, { width: contentWidth }, embedded && styles.embedded]}
      testID="octopus-concierge-section"
      accessibilityLabel={`Octopus Concierge for ${displayName}`}
    >
      <View style={styles.brandRow}>
        <LocalBanditOctopusIcon style={styles.brandIcon} />
        <Text style={styles.kicker}>OCTOPUS CONCIERGE</Text>
      </View>

      {portrait ? (
        <ExpoImage
          source={{ uri: portrait }}
          style={styles.portrait}
          contentFit="cover"
          accessibilityLabel={`${displayName} photo`}
        />
      ) : null}

      <Text style={styles.providerName} testID={`octopus-provider-${banditId}`}>
        {displayName}
      </Text>
      <Text style={styles.salesTitle}>Your Local Insider</Text>
      <Text style={styles.salesLead}>Your city. Your insider.</Text>
      <Text style={styles.salesPersuade}>
        {`Go beyond recommendations. ${first} helps make things happen.`}
      </Text>

      {isAi ? (
        <Text style={styles.pendingCopy} testID="ai-operated-disclosure">
          Digital local guide · not a person on call. Bookings need real confirmation.
        </Text>
      ) : null}

      {pending ? (
        <View style={styles.pendingBox} testID="octopus-verification-pending">
          <Text style={styles.pendingLabel}>Verification Pending</Text>
          <Text style={styles.pendingCopy}>
            {`${first} is not Octopus Verified. Stay Pass checkout and request fulfillment stay closed until verification is genuinely approved.`}
          </Text>
        </View>
      ) : null}

      <View style={styles.priceBlock}>
        <Text style={styles.price} testID="local-insider-price">
          {OCTOPUS_CONCIERGE_OFFER.priceLabel}
        </Text>
        <Text style={styles.pricePeriod}>{OCTOPUS_CONCIERGE_OFFER.periodLabel}</Text>
      </View>

      <View style={styles.outcomeList}>
        <Text style={styles.outcomeLine}>{`- Up to ${OCTOPUS_CONCIERGE_OFFER.allowance} requests with ${first} within ${OCTOPUS_CONCIERGE_OFFER.durationDays} days`}</Text>
        <Text style={styles.outcomeLine}>- Tables, tickets and transfers handled for you</Text>
        <Text style={styles.outcomeLine}>- City Guide stays free</Text>
      </View>

      {checkoutEnabled ? null : (
        <View style={styles.gated} testID="local-insider-checkout-disabled">
          <Text style={styles.gatedLabel}>Checkout closed</Text>
          <Text style={styles.gatedCopy}>
            {isAi
              ? "Stay Pass opens when this Local banDit is commercially ready. City Guide stays free."
              : pending
                ? `${OCTOPUS_CONCIERGE_OFFER.priceLabel} checkout is closed while ${first} is Verification Pending.`
                : "Purchases open only for an Octopus Verified Local banDit."}
          </Text>
        </View>
      )}

      <Text style={styles.section} testID="concierge-remaining">
        {isAi && !checkoutEnabled
          ? "Request balance opens with a paid Stay Pass when fulfillment is ready."
          : pending
            ? "0 requests remaining — balance opens after verification and a paid Stay Pass."
            : "Request balance follows this Local banDit's Stay Pass."}
      </Text>

      <View style={styles.askCard} testID="concierge-request-disabled">
        <Text style={styles.askTitle}>{`Ask ${first}`}</Text>
        <Text style={styles.askHint}>
          {isAi && !checkoutEnabled
            ? "Requests stay closed until Stay Pass fulfillment is ready."
            : pending
              ? "Request submission is visible and stays disabled until this Local banDit is verified."
              : "Send a request once Stay Pass is active."}
        </Text>
        <TextInput
          editable={false}
          value=""
          placeholder={`Request for ${first}`}
          placeholderTextColor="#999"
          style={styles.askInput}
        />
        <Pressable disabled accessibilityState={{ disabled: true }} style={styles.disabledCta}>
          <Text style={styles.disabledCtaText}>Send request</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>Your requests</Text>
      <Text style={styles.empty} testID="concierge-history">
        {`No requests yet with ${first}.`}
      </Text>

      {checkoutEnabled ? (
        <Text style={styles.rechargeHint}>Stay Pass recharge stays on the verified checkout.</Text>
      ) : (
        <Text style={styles.rechargeHint} testID="stay-pass-recharge-disabled">
          Recharge stays closed with checkout.
        </Text>
      )}
    </View>
  );

  if (embedded) return body;
  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      testID="octopus-concierge-scroll"
    >
      {body}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    alignItems: "center",
    paddingBottom: 48,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 28,
  },
  embedded: {
    alignSelf: "center",
    marginBottom: 18,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(224,49,49,0.18)",
    backgroundColor: color.surface,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  brandIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
  },
  kicker: {
    color: color.brand,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  portrait: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 12,
  },
  providerName: {
    color: color.ink,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
    fontFamily: "Caros",
  },
  salesTitle: {
    color: color.ink,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.6,
    lineHeight: 36,
    marginBottom: 8,
    fontFamily: "Caros",
  },
  salesLead: {
    color: color.inkSoft,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 8,
    fontWeight: "600",
  },
  salesPersuade: {
    color: color.ink,
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 14,
  },
  pendingBox: {
    backgroundColor: "#FFF5F5",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(224,49,49,0.28)",
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  pendingLabel: {
    color: color.brand,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 4,
  },
  pendingCopy: {
    color: color.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  priceBlock: {
    marginBottom: 12,
  },
  price: {
    color: color.ink,
    fontSize: 36,
    fontWeight: "800",
    fontFamily: "Caros",
  },
  pricePeriod: {
    color: color.inkSoft,
    fontSize: 14,
    marginTop: 2,
  },
  outcomeList: {
    gap: 6,
    marginBottom: 16,
  },
  outcomeLine: {
    color: color.ink,
    fontSize: 15,
    lineHeight: 22,
  },
  gated: {
    backgroundColor: "#FFF5F5",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(224,49,49,0.18)",
    padding: 14,
    marginBottom: 16,
    gap: 8,
  },
  gatedLabel: {
    color: color.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  gatedCopy: {
    color: color.inkSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  disabledCta: {
    backgroundColor: "#E8E8E8",
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  disabledCtaText: {
    color: "#6B6B6B",
    fontSize: 15,
    fontWeight: "700",
  },
  section: {
    color: color.ink,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 4,
  },
  askCard: {
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.08)",
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 16,
    gap: 8,
  },
  askTitle: {
    color: color.ink,
    fontSize: 16,
    fontWeight: "700",
  },
  askHint: {
    color: color.inkSoft,
    fontSize: 13,
    lineHeight: 18,
  },
  askInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#E4E4E4",
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    color: color.ink,
    backgroundColor: "#F7F7F7",
  },
  empty: {
    color: color.inkSoft,
    fontSize: 14,
    marginBottom: 14,
  },
  recharge: {
    alignSelf: "flex-start",
    paddingVertical: 8,
  },
  rechargeText: {
    color: "#8A8A8A",
    fontSize: 14,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  rechargeHint: {
    color: color.inkSoft,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
});
