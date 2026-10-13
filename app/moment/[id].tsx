import { Image as ExpoImage } from "expo-image";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import {
  getMomentAttribution,
  getMomentById,
} from "@/lib/guest-workspace/profileMemory";

/** Moment story detail — Open Story from Profile journal. */
export default function MomentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const moment = useMemo(() => (id ? getMomentById(String(id)) : undefined), [id]);
  const attribution = moment ? getMomentAttribution(moment) : null;

  const screenOptions = useAppBackScreenOptions({
    title: moment?.title ?? "Moment",
    fallback: "/profile" as Href,
    showBack: true,
  });

  if (!moment) {
    return (
      <View style={styles.missing}>
        <Stack.Screen options={screenOptions} />
        <Text style={styles.missingText}>Moment not found</Text>
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
            {moment.banditAvatarUrl ? (
              <ExpoImage
                source={{ uri: moment.banditAvatarUrl }}
                style={styles.avatar}
                contentFit="cover"
              />
            ) : null}
            <View style={styles.attrText}>
              <Text style={styles.attrName}>{attribution.name}</Text>
              {moment.banditName && attribution.kind === "bottle_sender" ? (
                <Text style={styles.attrSub}>Journey also linked to {moment.banditName}</Text>
              ) : null}
            </View>
          </View>
          {moment.banditId ? (
            <Pressable
              style={styles.banditCta}
              onPress={() => router.push(`/bandit/${moment.banditId}` as Href)}
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
  missing: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  missingText: { color: "#666", fontSize: 16 },
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
