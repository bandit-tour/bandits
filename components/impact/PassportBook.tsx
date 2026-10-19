import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { color } from "@/lib/guestDesign";
import type { ImpactEvent } from "@/lib/impact/ledger";
import {
  addImpactMemory,
  blobToJpegDataUrl,
  deleteImpactMemory,
  listImpactMemories,
  setImpactMemoryVisibility,
  type ImpactMemory,
} from "@/lib/impact/memories";

function stampDate(iso: string): string {
  const day = iso.slice(0, 10);
  const parsed = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return day;
  return parsed
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
    .toUpperCase();
}

function tiltFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) >>> 0;
  return (h % 13) - 6;
}

export function PassportBook({
  userId,
  events,
  drops,
  onShare,
}: {
  userId: string;
  events: ImpactEvent[];
  drops: number;
  onShare: () => void;
}) {
  const cities = [...new Set(events.map((item) => item.city).filter(Boolean))];
  const [memories, setMemories] = useState<ImpactMemory[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const onFileRef = useRef<(file: Blob) => void>(() => undefined);

  const reload = useCallback(async () => {
    setMemories(await listImpactMemories(userId));
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveBlob = useCallback(
    async (blob: Blob) => {
      setBusy(true);
      setNote(null);
      try {
        const uri = await blobToJpegDataUrl(blob);
        await addImpactMemory({ userId, uri, mimeType: "image/jpeg" });
        await reload();
        setNote("Saved privately. This photo is not attendance and did not add Drops.");
      } catch (err) {
        setNote(err instanceof Error ? err.message : "Could not save that photo.");
      } finally {
        setBusy(false);
      }
    },
    [reload, userId],
  );

  onFileRef.current = (file) => {
    void saveBlob(file);
  };

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp,image/gif";
    input.setAttribute("data-testid", "impact-memory-file");
    input.setAttribute("aria-label", "Add a private volunteering photo");
    input.style.cssText = "position:fixed;left:-120px;top:0;width:1px;height:1px;opacity:0;";
    const onChange = () => {
      const file = input.files?.[0];
      input.value = "";
      if (file) onFileRef.current(file);
    };
    input.addEventListener("change", onChange);
    document.body.appendChild(input);
    inputRef.current = input;
    return () => {
      input.removeEventListener("change", onChange);
      input.remove();
      inputRef.current = null;
    };
  }, []);

  const onAdd = async () => {
    if (Platform.OS === "web") {
      inputRef.current?.click();
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setNote("Photo library permission is required.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setBusy(true);
    setNote(null);
    try {
      await addImpactMemory({
        userId,
        uri: asset.uri,
        mimeType: asset.mimeType || "image/jpeg",
      });
      await reload();
      setNote("Saved privately. This photo is not attendance and did not add Drops.");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not save that photo.");
    } finally {
      setBusy(false);
    }
  };

  const onToggle = async (memory: ImpactMemory) => {
    const next = memory.visibility === "hidden" ? "shown" : "hidden";
    await setImpactMemoryVisibility(userId, memory.id, next);
    await reload();
  };

  const onDelete = async (memory: ImpactMemory) => {
    await deleteImpactMemory(userId, memory.id);
    await reload();
    setNote("Photo deleted.");
  };

  return (
    <View style={styles.book} testID="impact-passport">
      <View style={styles.ribbon} />
      <Text style={styles.kicker}>Impact Passport</Text>
      <Text style={styles.headline}>{events.length ? `${drops} verified Drops` : "No stamps yet"}</Text>
      <View style={styles.page}>
        <View style={styles.identity}>
          <Text style={styles.identityKicker}>bandiTour</Text>
          <Text style={styles.identityTitle}>{events.length ? "Verified travel" : "Awaiting your first stamp"}</Text>
          <Text style={styles.identityMeta}>
            {events.length
              ? cities.join(" · ")
              : "Your Passport stays blank until a verified action is yours."}
          </Text>
        </View>
        {events.length === 0 ? (
          <View style={styles.emptyWrap} testID="impact-passport-empty">
            <View style={styles.emptyRing}>
              <Text style={styles.emptyMark}>Open</Text>
              <Text style={styles.emptySub}>No stamp</Text>
            </View>
          </View>
        ) : (
          <View style={styles.stampGrid} testID="impact-passport-stamps">
            {events.map((item) => (
              <View
                key={item.id}
                style={[styles.stamp, { transform: [{ rotate: `${tiltFor(item.id)}deg` }] }]}
                testID={`impact-stamp-${item.id}`}
              >
                <View style={styles.stampInner} />
                <Text style={styles.stampCity} numberOfLines={1}>
                  {item.city}
                </Text>
                <Text style={styles.stampTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.stampDate}>{stampDate(item.at)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.memories} testID="impact-memories">
        <View style={styles.memoryHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.memoryTitle}>Personal memories</Text>
            <Text style={styles.memoryLead}>
              Optional photos from volunteering. Private to you. Not attendance. No Drops.
            </Text>
          </View>
          <Pressable
            onPress={() => void onAdd()}
            disabled={busy}
            testID="impact-memory-add"
            accessibilityRole="button"
            accessibilityLabel="Add a private photo"
            style={[styles.addBtn, busy && styles.addBtnBusy]}
          >
            <Text style={styles.addBtnText}>{busy ? "Saving…" : "Add photo"}</Text>
          </Pressable>
        </View>
        {memories.length === 0 ? (
          <Text style={styles.memoryEmpty} testID="impact-memory-empty">
            No personal photos yet.
          </Text>
        ) : (
          <View style={styles.memoryRow}>
            {memories.map((memory) => (
              <View key={memory.id} style={styles.memoryCard} testID={`impact-memory-${memory.id}`}>
                {memory.visibility === "hidden" ? (
                  <View style={styles.hiddenPlate} testID={`impact-memory-hidden-${memory.id}`}>
                    <Text style={styles.hiddenText}>Hidden</Text>
                  </View>
                ) : (
                  <ExpoImage
                    source={{ uri: memory.uri }}
                    style={styles.memoryImage}
                    contentFit="cover"
                    accessibilityLabel="Private volunteering memory"
                  />
                )}
                <View style={styles.memoryActions}>
                  <Pressable
                    onPress={() => void onToggle(memory)}
                    testID={`impact-memory-privacy-${memory.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={memory.visibility === "hidden" ? "Show photo" : "Hide photo"}
                  >
                    <Text style={styles.memoryActionText}>
                      {memory.visibility === "hidden" ? "Show" : "Hide"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void onDelete(memory)}
                    testID={`impact-memory-delete-${memory.id}`}
                    accessibilityRole="button"
                    accessibilityLabel="Delete photo"
                  >
                    <Text style={styles.memoryDeleteText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
        {note ? (
          <Text style={styles.memoryNote} testID="impact-memory-note">
            {note}
          </Text>
        ) : null}
      </View>

      <Pressable
        style={({ pressed }) => [styles.share, pressed && styles.pressed]}
        onPress={onShare}
        testID="impact-share"
        accessibilityRole="button"
      >
        <Text style={styles.shareText}>{events.length ? "Share Passport" : "Nothing to share"}</Text>
      </Pressable>
      <Text style={styles.privacy} testID="impact-passport-privacy">
        Verified Drops and cities only. Photos stay private and never add Drops.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  book: {
    marginTop: 18,
    backgroundColor: color.charcoal,
    borderRadius: 22,
    padding: 14,
    paddingTop: 14,
    overflow: "hidden",
  },
  ribbon: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: color.brand,
  },
  kicker: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.72)",
  },
  headline: {
    fontFamily: "Georgia",
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 2,
    marginBottom: 10,
  },
  page: {
    backgroundColor: "#F7F1E8",
    borderRadius: 16,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: "#E4D5C4",
  },
  identity: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E4D5C4",
    paddingBottom: 8,
  },
  identityKicker: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: color.brand,
  },
  identityTitle: {
    marginTop: 2,
    fontFamily: "Georgia",
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
    color: color.ink,
  },
  identityMeta: {
    marginTop: 4,
    fontSize: 15,
    lineHeight: 21,
    color: color.inkSoft,
  },
  emptyWrap: { alignItems: "center", paddingVertical: 8 },
  emptyRing: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#C4A98E",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  emptyMark: {
    fontFamily: "Georgia",
    fontSize: 22,
    color: "#8C6B52",
  },
  emptySub: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#8C6B52",
  },
  stampGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  stamp: {
    width: 124,
    height: 124,
    borderRadius: 62,
    borderWidth: 2,
    borderColor: color.brand,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    backgroundColor: "rgba(224,49,49,0.05)",
  },
  stampInner: {
    position: "absolute",
    top: 5,
    left: 5,
    right: 5,
    bottom: 5,
    borderRadius: 56,
    borderWidth: 1,
    borderColor: "rgba(224,49,49,0.45)",
  },
  stampCity: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: color.brand,
  },
  stampTitle: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "800",
    color: color.ink,
    textAlign: "center",
  },
  stampDate: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: color.inkSoft,
    textAlign: "center",
  },
  memories: {
    marginTop: 12,
    backgroundColor: "#241C18",
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  memoryHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  memoryTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  memoryLead: { marginTop: 2, color: "rgba(255,255,255,0.72)", fontSize: 13, lineHeight: 18 },
  addBtn: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnBusy: { opacity: 0.6 },
  addBtnText: { color: color.ink, fontWeight: "800", fontSize: 14 },
  memoryEmpty: { color: "rgba(255,255,255,0.72)", fontSize: 14, lineHeight: 20 },
  memoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  memoryCard: {
    width: 108,
    backgroundColor: "#3A302A",
    borderRadius: 12,
    overflow: "hidden",
  },
  memoryImage: { width: 108, height: 84 },
  hiddenPlate: {
    width: 108,
    height: 84,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2A2420",
  },
  hiddenText: {
    color: "#F7F1E8",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  memoryActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  memoryActionText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  memoryDeleteText: { color: "#F0B4B4", fontSize: 12, fontWeight: "800" },
  memoryNote: { color: "rgba(255,255,255,0.8)", fontSize: 13, lineHeight: 18 },
  share: {
    marginTop: 12,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  shareText: { color: color.ink, fontWeight: "800", fontSize: 15 },
  privacy: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(255,255,255,0.72)",
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
});
