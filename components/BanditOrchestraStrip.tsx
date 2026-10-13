/**
 * Traveler-visible Workspace capabilities on a Local banDit card.
 * Trust badges only from server premium/Octopus truth — never decorative fallback.
 */

import { useRouter, type Href } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  buildBanditCardCapabilities,
  type BanditCapabilityChip,
} from "@/lib/guest-app/bandit-card-capabilities";
import { fetchBanditPremiumVisibility } from "@/lib/guest-app/premium-visibility";
import type { Database } from "@/lib/database.types";

type Bandit = Database["public"]["Tables"]["bandit"]["Row"] & {
  bandit_tags?: { tags: { id: string; name: string } | null }[] | null;
};

type Category = { genre: string; count: number };

export function BanditOrchestraStrip({
  bandit,
  categories,
  hotelSlug,
}: {
  bandit: Bandit;
  categories: Category[];
  hotelSlug?: string | null;
}) {
  const router = useRouter();
  const [premium, setPremium] = useState<Awaited<ReturnType<typeof fetchBanditPremiumVisibility>>>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchBanditPremiumVisibility(String(bandit.id)).then((v) => {
      if (!cancelled) setPremium(v);
    });
    return () => {
      cancelled = true;
    };
  }, [bandit.id]);

  const cap = useMemo(
    () => buildBanditCardCapabilities(bandit, categories, { hotelSlug, premium }),
    [bandit, categories, hotelSlug, premium],
  );

  const open = (chip: BanditCapabilityChip) => {
    if (!chip.href) return;
    router.push(chip.href as Href);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.badgeRow}>
        {cap.verified ? (
          <View style={[styles.seal, styles.sealGold]}>
            <Text style={styles.sealText}>Octopus Verified</Text>
          </View>
        ) : null}
        {cap.premium ? (
          <View style={[styles.seal, styles.sealPremium]}>
            <Text style={styles.sealText}>Premium</Text>
          </View>
        ) : null}
        {cap.liveLabel ? (
          <View style={[styles.seal, styles.sealLive]}>
            <Text style={styles.sealText}>Live</Text>
          </View>
        ) : null}
        <Text style={styles.ratingMark}>★ {cap.ratingLabel}</Text>
      </View>

      {cap.storyLine ? (
        <Text style={styles.story} numberOfLines={2}>
          {cap.storyLine}
        </Text>
      ) : null}

      {cap.aiLine && cap.aiLine !== cap.storyLine ? (
        <Text style={styles.ai} numberOfLines={1}>
          AI · {cap.aiLine}
        </Text>
      ) : null}

      {cap.liveLabel ? (
        <Text style={styles.liveLine} numberOfLines={1}>
          Live · {cap.liveLabel}
        </Text>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {cap.chips.map((chip) => (
          <Pressable
            key={chip.id}
            onPress={() => open(chip)}
            style={[
              styles.chip,
              chip.tone === "gold"
                ? styles.tone_gold
                : chip.tone === "live"
                  ? styles.tone_live
                  : chip.tone === "action"
                    ? styles.tone_action
                    : styles.tone_soft,
            ]}
          >
            <Text style={styles.chipText}>{chip.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginTop: 8 },
  badgeRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  seal: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  sealGold: { backgroundColor: "rgba(196,163,90,0.2)" },
  sealPremium: { backgroundColor: "rgba(196,163,90,0.12)" },
  sealLive: { backgroundColor: "rgba(40,140,90,0.18)" },
  sealText: { color: "#c4a35a", fontSize: 11, fontWeight: "700" },
  ratingMark: { color: "#9aa3ad", fontSize: 12, marginLeft: 4 },
  story: { color: "#e8e4dc", fontSize: 14, lineHeight: 20 },
  ai: { color: "#9aa3ad", fontSize: 12 },
  liveLine: { color: "#6ecf9a", fontSize: 12 },
  chips: { gap: 8, paddingVertical: 4 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  tone_gold: { backgroundColor: "rgba(196,163,90,0.18)" },
  tone_live: { backgroundColor: "rgba(40,140,90,0.18)" },
  tone_soft: { backgroundColor: "rgba(255,255,255,0.08)" },
  tone_action: { backgroundColor: "rgba(255,255,255,0.12)" },
  chipText: { color: "#f4f1ea", fontSize: 12, fontWeight: "600" },
});
