import { Image as ExpoImage } from "expo-image";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import { getExperienceHostById } from "@/lib/guest-workspace/experienceDetail";
import { color } from "@/lib/guestDesign";

/**
 * Experience host / provider profile — canonical identity from Experience catalog.
 * Does NOT fetch Local banDit rows (hosts are partners/people, not always banDits).
 */
export default function ExperienceHostProfileScreen() {
  const router = useRouter();
  const { id, fromExperience } = useLocalSearchParams<{
    id: string | string[];
    fromExperience?: string | string[];
  }>();
  const hostId = Array.isArray(id) ? id[0] : id;
  const fromExp = Array.isArray(fromExperience) ? fromExperience[0] : fromExperience;

  const resolved = useMemo(() => getExperienceHostById(String(hostId || "")), [hostId]);
  const backHref = (fromExp
    ? `/experience/${encodeURIComponent(fromExp)}`
    : resolved?.experienceIds[0]
      ? `/experience/${encodeURIComponent(resolved.experienceIds[0])}`
      : "/experiences") as Href;

  const screenOptions = useAppBackScreenOptions({
    title: resolved?.host.name || "Host",
    fallback: backHref,
    escapeShortcuts: true,
  });

  if (!resolved) {
    return (
      <>
        <Stack.Screen options={screenOptions} />
        <View style={styles.centered}>
          <Text style={styles.err}>Host profile not found.</Text>
          <Pressable onPress={() => router.replace(backHref)} style={styles.cta}>
            <Text style={styles.ctaText}>Back to Experiences</Text>
          </Pressable>
        </View>
      </>
    );
  }

  const { host, experienceIds } = resolved;

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <ExpoImage
          source={{ uri: host.photoUrl }}
          style={styles.hero}
          contentFit="cover"
          transition={160}
        />
        <Text style={styles.name}>{host.name}</Text>
        <Text style={styles.expertise}>{host.expertise}</Text>
        <Text style={styles.meta}>
          {host.yearsHosting} years hosting · {host.languages.join(" · ")}
        </Text>
        <Text style={styles.bio}>{host.bio}</Text>

        {host.credentials.length ? (
          <View style={styles.credBlock}>
            {host.credentials.map((c) => (
              <Text key={c} style={styles.cred}>
                {c}
              </Text>
            ))}
          </View>
        ) : null}

        {host.messageViaLocalFriend ? (
          <Pressable
            style={styles.cta}
            onPress={() => router.push("/localFriend" as Href)}
            accessibilityRole="button"
          >
            <Text style={styles.ctaText}>{`Message ${host.name.split(" ")[0]}`}</Text>
          </Pressable>
        ) : null}

        <Pressable style={styles.secondary} onPress={() => router.push(backHref)}>
          <Text style={styles.secondaryText}>Back to Experience</Text>
        </Pressable>

        {experienceIds.length > 1 ? (
          <View style={styles.more}>
            <Text style={styles.moreTitle}>Also hosting</Text>
            {experienceIds.map((eid) => (
              <Pressable
                key={eid}
                onPress={() => router.push(`/experience/${encodeURIComponent(eid)}` as Href)}
              >
                <Text style={styles.moreLink}>{eid.replace(/^exp_/, "").replace(/_/g, " ")}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FAFAF8" },
  content: { paddingBottom: 48 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  err: { color: "#B00020", fontSize: 16, textAlign: "center" },
  hero: { width: "100%", aspectRatio: 4 / 5, backgroundColor: "#111" },
  name: {
    marginTop: 20,
    marginHorizontal: 20,
    fontSize: 32,
    fontWeight: "700",
    color: "#111111",
    fontFamily: "Georgia",
  },
  expertise: { marginHorizontal: 20, marginTop: 6, fontSize: 15, color: "#555" },
  meta: { marginHorizontal: 20, marginTop: 8, fontSize: 13, color: "#888" },
  bio: { marginHorizontal: 20, marginTop: 16, fontSize: 16, lineHeight: 24, color: "#222" },
  credBlock: { marginHorizontal: 20, marginTop: 16, gap: 6 },
  cred: { fontSize: 13, color: "#666" },
  cta: {
    marginHorizontal: 20,
    marginTop: 24,
    backgroundColor: "#E03131",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondary: { marginHorizontal: 20, marginTop: 12, paddingVertical: 12, alignItems: "center" },
  secondaryText: { color: "#111111", fontSize: 15, fontWeight: "600" },
  more: { marginHorizontal: 20, marginTop: 28, gap: 8 },
  moreTitle: { fontSize: 14, fontWeight: "700", color: "#888", textTransform: "uppercase" },
  moreLink: { fontSize: 15, color: "#E03131", fontWeight: "600" },
});
