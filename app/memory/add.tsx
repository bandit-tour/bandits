/**
 * Add / Edit a City Memory entry (visual journal) — private by default.
 * Not My Moments (text statuses for Bottle QR).
 */
import { Image as ExpoImage } from "expo-image";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppState } from "@/contexts/AppStateContext";
import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import { color, radius } from "@/lib/guestDesign";
import { usePremiumRefreshControl } from "@/lib/mobilePullToRefresh";
import { routeParamString } from "@/lib/routeParams";
import {
  getTravelMemory,
  pickTravelMemoryImages,
  pickTravelMemoryVideo,
  saveTravelMemory,
  TRAVEL_MEMORY_MAX_PHOTOS,
  TRAVEL_MEMORY_MAX_VIDEOS,
  type TravelMemoryMedia,
} from "@/lib/travel-memory";
import { alertMessage } from "@/lib/uiConfirm";

export default function AddTravelMemoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const editId = routeParamString(params.id);
  const { getCurrentUser, activeIdentity } = useAppState();

  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [city, setCity] = useState("Athens");
  const [placeLabel, setPlaceLabel] = useState("");
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [media, setMedia] = useState<TravelMemoryMedia[]>([]);
  const [loading, setLoading] = useState(Boolean(editId));
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const header = useAppBackScreenOptions({
    title: editId ? "Edit Memory" : "Add a Memory",
    fallback: "/cityMemory" as Href,
    showBack: true,
    escapeShortcuts: true,
    headerTintColor: color.ink,
    headerStyle: { backgroundColor: color.surfaceWarm },
  });

  const loadEdit = useCallback(async () => {
    if (!editId) return;
    setLoading(true);
    try {
      const row = await getTravelMemory(editId);
      if (!row) {
        alertMessage("Not found", "This Memory is missing or not yours.");
        router.replace("/cityMemory" as Href);
        return;
      }
      setTitle(row.title);
      setStory(row.story);
      setCity(row.city);
      setPlaceLabel(row.placeLabel || "");
      setOccurredAt(row.occurredAt.slice(0, 10));
      setMedia(row.media);
    } finally {
      setLoading(false);
    }
  }, [editId, router]);

  useEffect(() => {
    void loadEdit();
  }, [loadEdit]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadEdit();
    } finally {
      setRefreshing(false);
    }
  }, [loadEdit]);
  const refreshControl = usePremiumRefreshControl(refreshing, onRefresh);

  const addPhotos = async () => {
    try {
      const picked = await pickTravelMemoryImages();
      const room = TRAVEL_MEMORY_MAX_PHOTOS - media.filter((m) => m.kind === "image").length;
      setMedia((prev) => [...prev, ...picked.slice(0, Math.max(0, room))]);
      setDraftNote("Photos attached — save to keep them.");
    } catch (e) {
      alertMessage("Photos", e instanceof Error ? e.message : "Could not add photos.");
    }
  };

  const addVideo = async () => {
    try {
      if (media.filter((m) => m.kind === "video").length >= TRAVEL_MEMORY_MAX_VIDEOS) {
        alertMessage("Video", `You can attach up to ${TRAVEL_MEMORY_MAX_VIDEOS} short videos.`);
        return;
      }
      const v = await pickTravelMemoryVideo();
      if (v) {
        setMedia((prev) => [...prev, v]);
        setDraftNote("Video attached — save to keep it.");
      }
    } catch (e) {
      alertMessage("Video", e instanceof Error ? e.message : "Could not add video.");
    }
  };

  const removeMedia = (id: string) => {
    setMedia((prev) => prev.filter((m) => m.id !== id));
  };

  const onSave = async () => {
    if (saving) return;
    setSaving(true);
    setProgress("Saving…");
    try {
      const u = await getCurrentUser();
      const userId = u?.id || activeIdentity?.userId || "self";
      const iso = occurredAt ? `${occurredAt}T12:00:00.000Z` : new Date().toISOString();
      const row = await saveTravelMemory({
        id: editId || undefined,
        userId,
        title,
        story,
        city,
        placeLabel: placeLabel || null,
        occurredAt: iso,
        media,
        onMediaProgress: (done, total) => setProgress(`Saving media ${done}/${total}…`),
      });
      setProgress(null);
      router.replace(`/memory/${encodeURIComponent(row.id)}` as Href);
    } catch (e) {
      setProgress(null);
      setDraftNote("Draft kept on this screen — fix and try again.");
      alertMessage("Could not save", e instanceof Error ? e.message : "Try again.");
    } finally {
      setSaving(false);
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

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{
        padding: 20,
        paddingBottom: 40 + insets.bottom,
        maxWidth: 640,
        width: "100%",
        alignSelf: "center",
      }}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
      testID="memory-add-scroll"
    >
      <Stack.Screen options={header} />
      <Text style={styles.kicker}>City Memory · private by default</Text>
      <Text style={styles.title}>{editId ? "Edit your Memory" : "New Memory"}</Text>
      <Text style={styles.lead}>
        Photos and notes stay in your visual travel journal. They are not Bottle QR messages — those
        live in My Moments.
      </Text>

      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Give this Memory a name"
        placeholderTextColor={color.muted}
        testID="memory-title-input"
      />

      <Text style={styles.label}>Story</Text>
      <TextInput
        style={[styles.input, styles.story]}
        value={story}
        onChangeText={setStory}
        placeholder="What do you want to remember?"
        placeholderTextColor={color.muted}
        multiline
        testID="memory-story-input"
      />

      <Text style={styles.label}>City</Text>
      <TextInput
        style={styles.input}
        value={city}
        onChangeText={setCity}
        placeholder="City"
        placeholderTextColor={color.muted}
      />

      <Text style={styles.label}>Place (optional)</Text>
      <TextInput
        style={styles.input}
        value={placeLabel}
        onChangeText={setPlaceLabel}
        placeholder="Neighborhood, venue, or spot"
        placeholderTextColor={color.muted}
      />

      <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
      <TextInput
        style={styles.input}
        value={occurredAt}
        onChangeText={setOccurredAt}
        placeholder="2026-10-16"
        placeholderTextColor={color.muted}
        autoCapitalize="none"
      />

      <Text style={styles.label}>Media</Text>
      <View style={styles.mediaActions}>
        <Pressable style={styles.mediaBtn} onPress={() => void addPhotos()} testID="memory-add-photos">
          <Text style={styles.mediaBtnText}>Add photos</Text>
        </Pressable>
        <Pressable style={styles.mediaBtn} onPress={() => void addVideo()} testID="memory-add-video">
          <Text style={styles.mediaBtnText}>Add video</Text>
        </Pressable>
      </View>

      <View style={styles.mediaGrid}>
        {media.map((m) => (
          <View key={m.id} style={styles.mediaThumbWrap}>
            {m.kind === "image" ? (
              <ExpoImage source={{ uri: m.uri }} style={styles.mediaThumb} contentFit="cover" />
            ) : (
              <View style={[styles.mediaThumb, styles.videoThumb]}>
                <Text style={styles.videoThumbText}>Video</Text>
              </View>
            )}
            <Pressable style={styles.mediaRemove} onPress={() => removeMedia(m.id)}>
              <Text style={styles.mediaRemoveText}>✕</Text>
            </Pressable>
          </View>
        ))}
      </View>

      {draftNote ? <Text style={styles.hint}>{draftNote}</Text> : null}
      {progress ? <Text style={styles.hint}>{progress}</Text> : null}

      <Pressable
        style={[styles.saveCta, saving && styles.saveCtaBusy]}
        onPress={() => void onSave()}
        disabled={saving}
        testID="memory-save-cta"
      >
        <Text style={styles.saveCtaText}>{saving ? "Saving…" : "Save Memory"}</Text>
      </Pressable>
      <Pressable onPress={() => router.back()} style={styles.cancel}>
        <Text style={styles.cancelText}>Back to City Memory</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: color.surfaceWarm },
  screen: { flex: 1, backgroundColor: color.surfaceWarm },
  kicker: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: color.brand,
    fontWeight: "800",
  },
  title: { marginTop: 6, fontSize: 28, fontWeight: "800", color: color.ink, fontFamily: "Georgia" },
  lead: { marginTop: 8, fontSize: 14, lineHeight: 20, color: color.muted, marginBottom: 16 },
  label: { marginTop: 12, marginBottom: 6, fontSize: 12, fontWeight: "800", color: color.ink },
  input: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: color.ink,
  },
  story: { minHeight: 110, textAlignVertical: "top" },
  mediaActions: { flexDirection: "row", gap: 10 },
  mediaBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: color.ink,
  },
  mediaBtnText: { color: "#FFF", fontWeight: "700", fontSize: 13 },
  mediaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  mediaThumbWrap: { width: 96, height: 96, borderRadius: 12, overflow: "hidden" },
  mediaThumb: { width: "100%", height: "100%", backgroundColor: "#DDD" },
  videoThumb: { alignItems: "center", justifyContent: "center", backgroundColor: "#333" },
  videoThumbText: { color: "#FFF", fontWeight: "800" },
  mediaRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  mediaRemoveText: { color: "#FFF", fontSize: 12, fontWeight: "800" },
  hint: { marginTop: 10, fontSize: 12, color: color.muted },
  saveCta: {
    marginTop: 22,
    backgroundColor: color.brand,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveCtaBusy: { opacity: 0.7 },
  saveCtaText: { color: "#FFF", fontWeight: "800", fontSize: 16 },
  cancel: { marginTop: 14, alignItems: "center", paddingVertical: 10 },
  cancelText: { color: color.ink, fontWeight: "700", textDecorationLine: "underline" },
});
