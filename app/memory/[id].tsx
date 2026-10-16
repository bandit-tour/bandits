/**
 * City Memory detail — private to owner; full-size media; edit/delete.
 * Not My Moments (text Bottle statuses).
 */
import { Image as ExpoImage } from "expo-image";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";

import { useAppState } from "@/contexts/AppStateContext";
import { useAppBackNavigation, useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import { color, radius } from "@/lib/guestDesign";
import { usePremiumRefreshControl } from "@/lib/mobilePullToRefresh";
import { routeParamString } from "@/lib/routeParams";
import { confirmDestructive, alertMessage } from "@/lib/uiConfirm";
import {
  deleteTravelMemory,
  getTravelMemory,
  type TravelMemory,
} from "@/lib/travel-memory";

function VideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  return (
    <VideoView
      style={styles.video}
      player={player}
      allowsFullscreen
      nativeControls
      contentFit="contain"
    />
  );
}

export default function TravelMemoryDetailScreen() {
  const raw = useLocalSearchParams<{ id?: string | string[] }>();
  const id = routeParamString(raw.id);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { getCurrentUser, activeIdentity } = useAppState();
  const goBack = useAppBackNavigation("/cityMemory" as Href);

  const [row, setRow] = useState<TravelMemory | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [fullscreenUri, setFullscreenUri] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const header = useAppBackScreenOptions({
    title: "Memory",
    fallback: "/cityMemory" as Href,
    showBack: true,
    escapeShortcuts: true,
    headerTintColor: color.ink,
    headerStyle: { backgroundColor: color.surfaceWarm },
  });

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const u = await getCurrentUser();
      const uid = u?.id || activeIdentity?.userId || null;
      const m = await getTravelMemory(id, uid);
      if (!m) {
        setRow(null);
        setForbidden(true);
        return;
      }
      if (uid && m.userId && m.userId !== uid && m.userId !== "self") {
        setRow(null);
        setForbidden(true);
        return;
      }
      setForbidden(false);
      setRow(m);
    } finally {
      setLoading(false);
    }
  }, [activeIdentity?.userId, getCurrentUser, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);
  const refreshControl = usePremiumRefreshControl(refreshing, onRefresh);

  const onDelete = async () => {
    if (!row) return;
    const ok = await confirmDestructive(
      "Delete Memory",
      "Remove this Memory and its media from your City Memory?",
    );
    if (!ok) return;
    try {
      const u = await getCurrentUser();
      await deleteTravelMemory(row.id, u?.id || activeIdentity?.userId);
      router.replace("/cityMemory" as Href);
    } catch (e) {
      alertMessage("Could not delete", e instanceof Error ? e.message : "Try again.");
    }
  };

  if (loading) {
    return (
      <View style={styles.boot}>
        <Stack.Screen options={header} />
        <ActivityIndicator color={color.ink} />
      </View>
    );
  }

  if (forbidden || !row) {
    return (
      <View style={styles.boot}>
        <Stack.Screen options={header} />
        <Text style={styles.missing}>This Memory is private or no longer available.</Text>
        <Pressable onPress={goBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← City Memory</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
      refreshControl={refreshControl}
      testID="memory-detail-scroll"
    >
      <Stack.Screen options={header} />
      <View style={styles.pad}>
        <Text style={styles.private}>Private Memory</Text>
        <Text style={styles.title}>{row.title}</Text>
        <Text style={styles.meta}>
          {[row.placeLabel || row.city, row.occurredAt.slice(0, 10)].filter(Boolean).join(" · ")}
        </Text>
        {row.story ? <Text style={styles.story}>{row.story}</Text> : null}
      </View>

      {row.media.map((m) => (
        <View key={m.id} style={styles.mediaBlock}>
          {m.kind === "image" ? (
            <Pressable onPress={() => setFullscreenUri(m.uri)} testID="memory-photo-open">
              <ExpoImage
                source={{ uri: m.uri }}
                style={{ width, height: Math.round(width * 1.15) }}
                contentFit="cover"
              />
            </Pressable>
          ) : (
            <VideoPlayer uri={m.uri} />
          )}
        </View>
      ))}

      <View style={styles.actions}>
        <Pressable
          style={styles.editCta}
          onPress={() => router.push(`/memory/add?id=${encodeURIComponent(row.id)}` as Href)}
          testID="memory-edit-cta"
        >
          <Text style={styles.editCtaText}>Edit Memory</Text>
        </Pressable>
        <Pressable style={styles.deleteCta} onPress={() => void onDelete()} testID="memory-delete-cta">
          <Text style={styles.deleteCtaText}>Delete</Text>
        </Pressable>
        <Pressable onPress={goBack} style={styles.backLink}>
          <Text style={styles.backLinkText}>Back to City Memory</Text>
        </Pressable>
      </View>

      <Modal visible={Boolean(fullscreenUri)} animationType="fade" onRequestClose={() => setFullscreenUri(null)}>
        <Pressable style={styles.fs} onPress={() => setFullscreenUri(null)}>
          {fullscreenUri ? (
            <ExpoImage source={{ uri: fullscreenUri }} style={styles.fsImage} contentFit="contain" />
          ) : null}
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.surfaceWarm,
    padding: 24,
  },
  screen: { flex: 1, backgroundColor: color.surfaceWarm },
  pad: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  private: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: color.brand,
  },
  title: {
    marginTop: 6,
    fontSize: 28,
    fontWeight: "800",
    color: color.ink,
    fontFamily: "Georgia",
    letterSpacing: -0.4,
  },
  meta: { marginTop: 6, fontSize: 13, color: color.muted },
  story: { marginTop: 14, fontSize: 16, lineHeight: 24, color: color.ink },
  mediaBlock: { marginTop: 12, backgroundColor: "#111" },
  video: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000" },
  actions: { padding: 20, gap: 12 },
  editCta: {
    backgroundColor: color.ink,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: "center",
  },
  editCtaText: { color: "#FFF", fontWeight: "800" },
  deleteCta: {
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(180,40,40,0.35)",
  },
  deleteCtaText: { color: "#B42828", fontWeight: "800" },
  backLink: { alignItems: "center", paddingVertical: 8 },
  backLinkText: { color: color.ink, fontWeight: "700", textDecorationLine: "underline" },
  missing: { fontSize: 15, color: color.muted, textAlign: "center", marginBottom: 16 },
  backBtn: { padding: 12 },
  backBtnText: { fontWeight: "800", color: color.ink },
  fs: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  fsImage: { width: "100%", height: "100%" },
});
