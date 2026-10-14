import { Image as ExpoImage } from "expo-image";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import AppEscapeNav from "@/components/AppEscapeNav";
import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import { goToAppHome } from "@/lib/appNavigation";
import {
  getMomentAttribution,
  getMomentById,
} from "@/lib/guest-workspace/profileMemory";
import {
  banditProfileHrefSafe,
  resolveRegisteredBanditId,
} from "@/lib/guest-workspace/registeredBanditIds";

/** Moment story detail — Open Story from Profile journal. */
export default function MomentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const moment = useMemo(() => (id ? getMomentById(String(id)) : undefined), [id]);
  const attribution = moment ? getMomentAttribution(moment) : null;
  /** Only link when a registered UUID resolves — never name-only / invented slugs. */
  const registeredBanditId = resolveRegisteredBanditId(moment?.banditId);
  const banditHref = banditProfileHrefSafe(moment?.banditId);

  const screenOptions = useAppBackScreenOptions({
    title: moment?.title ?? "Moment",
    fallback: "/profile" as Href,
    showBack: true,
    escapeShortcuts: true,
  });

  if (!moment) {
    return (
      <View style={styles.missing} testID="moment-missing">
        <Stack.Screen options={screenOptions} />
        <AppEscapeNav backFallback="/profile" />
        <Text style={styles.missingText}>Moment not found</Text>
        <Pressable
          style={styles.homeBtn}
          onPress={() => goToAppHome(router)}
          accessibilityRole="button"
          accessibilityLabel="Go Home"
        >
          <Text style={styles.homeBtnText}>Home</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={screenOptions} />
      <ExpoImage source={{ uri: moment.imageUrl }} style={styles.hero} contentFit="cover" />
      <Text style={styles.source}>{moment.sourceLabel}</Text>
      <Text style={styles.title}>{moment.title}</Text>
      <Text style={styles.meta}>
        {moment.dateLabel} · {moment.city} · {moment.hotel}
      </Text>
      <Text style={styles.story}>{moment.storyBody}</Text>

      {moment.bottleMessage ? (
        <View style={styles.bottleBox}>
          <Text style={styles.bottleLabel}>Message in the bottle</Text>
          <Text style={styles.bottleQuote}>“{moment.bottleMessage}”</Text>
        </View>
      ) : null}

      {attribution ? (
        <View style={styles.attrCard}>
          <Text style={styles.attrLabel}>{attribution.label}</Text>
          <View style={styles.attrRow}>
            {moment.banditAvatarUrl && registeredBanditId ? (
              <ExpoImage
                source={{ uri: moment.banditAvatarUrl }}
                style={styles.avatar}
                contentFit="cover"
              />
            ) : null}
            <View style={styles.attrText}>
              <Text style={styles.attrName}>{attribution.name}</Text>
              {moment.banditName && attribution.kind === "bottle_sender" && registeredBanditId ? (
                <Text style={styles.attrSub}>Journey also linked to {moment.banditName}</Text>
              ) : null}
            </View>
          </View>
          {banditHref ? (
            <Pressable
              style={styles.banditCta}
              onPress={() => router.push(banditHref as Href)}
              accessibilityRole="button"
              accessibilityLabel="Open Local banDit"
              testID="moment-open-bandit"
            >
              <Text style={styles.banditCtaText}>Open Local banDit</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F3EFE8" },
  content: { paddingBottom: 48 },
  missing: { flex: 1, padding: 24, gap: 12, backgroundColor: "#F3EFE8" },
  missingText: { color: "#666", fontSize: 16, textAlign: "center", marginTop: 24 },
  homeBtn: {
    alignSelf: "center",
    backgroundColor: "#111",
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  homeBtnText: { color: "#FFF", fontWeight: "800", fontSize: 15 },
  hero: { width: "100%", height: 280 },
  source: {
    marginHorizontal: 20,
    marginTop: 18,
    fontSize: 11,
    fontWeight: "700",
    color: "#9A7B4F",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  title: {
    marginHorizontal: 20,
    marginTop: 6,
    fontSize: 28,
    fontWeight: "800",
    color: "#1C1814",
    letterSpacing: -0.5,
  },
  meta: {
    marginHorizontal: 20,
    marginTop: 8,
    fontSize: 13,
    color: "#8A8278",
  },
  story: {
    marginHorizontal: 20,
    marginTop: 16,
    fontSize: 16,
    lineHeight: 24,
    color: "#3A342C",
  },
  bottleBox: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: "#1C1814",
    borderRadius: 18,
    padding: 18,
  },
  bottleLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(240,215,160,0.85)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  bottleQuote: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 24,
    color: "#FFF",
    fontStyle: "italic",
  },
  attrCard: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: "#FFF",
    borderRadius: 18,
    padding: 16,
  },
  attrLabel: { fontSize: 11, fontWeight: "700", color: "#8A8278", textTransform: "uppercase" },
  attrRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  attrText: { flex: 1 },
  attrName: { fontSize: 17, fontWeight: "800", color: "#1C1814" },
  attrSub: { fontSize: 13, color: "#8A8278", marginTop: 2 },
  banditCta: {
    marginTop: 14,
    backgroundColor: "#1C1814",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  banditCtaText: { color: "#F0D7A0", fontWeight: "800", fontSize: 14 },
});
