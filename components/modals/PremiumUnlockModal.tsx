import { useRouter, type Href } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import LocalBanditOctopusIcon from "@/components/LocalBanditOctopusIcon";
import BaseModal from "@/components/modals/BaseModal";
import { color, radius } from "@/lib/guestDesign";
import { OCTOPUS_CONCIERGE_OFFER } from "@/lib/octopus-concierge";

const BENEFIT_CARDS = [
  {
    id: "restaurant",
    emoji: "🍽",
    title: "Restaurant reservations",
    line: "Tables booked for you — not just recommendations.",
  },
  {
    id: "concerts",
    emoji: "🎫",
    title: "Concerts / shows / nightlife",
    line: "Tickets and entry handled end-to-end.",
  },
  {
    id: "taxi",
    emoji: "🚕",
    title: "Taxi & airport transfer",
    line: "Rides and transfers arranged on time.",
  },
  {
    id: "wolt",
    emoji: "🛵",
    title: "Wolt / food delivery",
    line: "Food ordered and tracked for you.",
  },
  {
    id: "delivery",
    emoji: "📦",
    title: "Local deliveries",
    line: "Packages and errands coordinated locally.",
  },
  {
    id: "tickets",
    emoji: "🎟",
    title: "Tickets",
    line: "Events secured without the queue.",
  },
  {
    id: "tables",
    emoji: "✦",
    title: "Hard-to-get tables",
    line: "The places that usually say no.",
  },
  {
    id: "special",
    emoji: "✨",
    title: "Special requests",
    line: "Anything else — asked once, handled.",
  },
] as const;

type Props = {
  visible: boolean;
  onClose: () => void;
  banditId: string;
  banditName: string;
};

/**
 * Sales teaser — never opens Concierge OS.
 * Routes to `/premium/[id]` sales/checkout gate (entitlement-checked).
 * White / red / coral hospitality canvas.
 */
export default function PremiumUnlockModal({
  visible,
  onClose,
  banditId,
  banditName,
}: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const contentW = Math.min(width - 48, 480);
  const isDesktop = width >= 640;
  const gap = 8;
  const cardW = isDesktop ? (contentW - gap) / 2 : contentW;
  const first = banditName.trim().split(/\s+/)[0] || "your banDit";

  const goToSales = () => {
    onClose();
    router.push(`/premium/${encodeURIComponent(banditId)}` as Href);
  };

  return (
    <BaseModal visible={visible} onClose={onClose} height={Platform.OS === "web" ? 680 : undefined}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        testID="premium-unlock-modal"
      >
        <View style={styles.brandRow}>
          <LocalBanditOctopusIcon style={styles.brandIcon} />
          <Text style={styles.kicker}>OCTOPUS CONCIERGE</Text>
        </View>
        <Text style={styles.title}>Let {first} handle it.</Text>
        <Text style={styles.lead}>{OCTOPUS_CONCIERGE_OFFER.valueLine}</Text>
        <Text style={styles.persuade}>{OCTOPUS_CONCIERGE_OFFER.persuasionLine(first)}</Text>
        <Text style={styles.distinction}>
          Free bandiTour is discovery. Octopus Concierge is execution — {first} gets things done.
        </Text>

        <View style={[styles.benefitGrid, { gap }]}>
          {BENEFIT_CARDS.map((b) => (
            <View key={b.id} style={[styles.benefitCard, { width: cardW }]}>
              <View style={styles.benefitHead}>
                <Text style={styles.benefitEmoji}>{b.emoji}</Text>
                <Text style={styles.benefitTitle}>{b.title}</Text>
              </View>
              <Text style={styles.benefitLine}>{b.line}</Text>
            </View>
          ))}
        </View>

        <View style={styles.priceBlock}>
          <Text style={styles.price}>{OCTOPUS_CONCIERGE_OFFER.priceLabel}</Text>
          <Text style={styles.pricePeriod}>{OCTOPUS_CONCIERGE_OFFER.periodLabel}</Text>
        </View>
        <Text style={styles.unlockSupport}>{OCTOPUS_CONCIERGE_OFFER.unlockSupport}</Text>

        <Pressable style={styles.primary} onPress={goToSales} accessibilityRole="button">
          <Text style={styles.primaryText}>{OCTOPUS_CONCIERGE_OFFER.ctaLabel}</Text>
        </Pressable>
        <Text style={styles.secureHint}>Secure payment · Unlocks only after payment confirms</Text>
      </ScrollView>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: color.surface },
  content: { paddingHorizontal: 18, paddingBottom: 28 },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  brandIcon: { width: 26, height: 26, borderRadius: 6, marginRight: 0 },
  kicker: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.3,
    color: color.brand,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: color.ink,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  lead: {
    fontSize: 15,
    lineHeight: 22,
    color: color.inkSoft,
    marginBottom: 8,
    fontWeight: "600",
  },
  persuade: {
    fontSize: 14,
    lineHeight: 21,
    color: color.ink,
    marginBottom: 8,
    fontWeight: "500",
  },
  distinction: {
    fontSize: 12,
    lineHeight: 18,
    color: "#FF6B6B",
    fontWeight: "700",
    marginBottom: 14,
  },
  benefitGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  benefitCard: {
    backgroundColor: color.surfaceWarm,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  benefitHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  benefitEmoji: { fontSize: 15 },
  benefitTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: color.ink,
    lineHeight: 16,
    flex: 1,
  },
  benefitLine: {
    fontSize: 11,
    color: color.muted,
    lineHeight: 15,
    paddingLeft: 21,
    fontWeight: "500",
  },
  priceBlock: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginBottom: 4,
  },
  price: {
    fontSize: 30,
    fontWeight: "800",
    color: color.ink,
  },
  pricePeriod: {
    fontSize: 13,
    fontWeight: "600",
    color: color.muted,
  },
  unlockSupport: {
    fontSize: 13,
    color: color.inkSoft,
    marginBottom: 14,
    fontWeight: "500",
  },
  primary: {
    backgroundColor: color.brand,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
    alignItems: "center",
    maxWidth: 400,
    alignSelf: "stretch",
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  secureHint: {
    marginTop: 12,
    textAlign: "left",
    color: color.muted,
    fontSize: 12,
    fontWeight: "500",
  },
});
