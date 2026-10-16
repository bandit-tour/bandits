/**
 * Dream destinations — next-trip wishlist. Not a booking catalog.
 */
import { Stack, useRouter, type Href } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAppState } from "@/contexts/AppStateContext";
import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import { color, radius } from "@/lib/guestDesign";
import {
  DREAM_DESTINATION_SUGGESTIONS,
  listDreamDestinations,
  removeDreamDestination,
  saveDreamDestination,
  setPrimaryDreamDestination,
  type DreamDestination,
} from "@/lib/dream-destinations/store";
import { transitionStartTripPlanning } from "@/lib/guest-lifecycle/transitions";
import { recordLifecycleNotice } from "@/lib/lifecycle/notices";
import { ensureAnonymousSession } from "@/lib/pilotSession";
import { usePremiumRefreshControl } from "@/lib/mobilePullToRefresh";

export default function DreamDestinationsScreen() {
  const router = useRouter();
  const { activeIdentity, getCurrentUser } = useAppState();
  const [userId, setUserId] = useState<string | null>(activeIdentity?.userId || null);
  const [rows, setRows] = useState<DreamDestination[]>([]);
  const [draft, setDraft] = useState("");
  const [timing, setTiming] = useState("");
  const [notifyOk, setNotifyOk] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const header = useAppBackScreenOptions({
    title: "Dream Destinations",
    fallback: "/home" as Href,
    showBack: true,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await ensureAnonymousSession().catch(() => undefined);
      const user = await getCurrentUser().catch(() => null);
      const id = user?.id || activeIdentity?.userId || null;
      if (!cancelled) setUserId(id);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeIdentity?.userId, getCurrentUser]);

  const reload = useCallback(async () => {
    if (!userId) {
      setRows([]);
      return;
    }
    setRows(await listDreamDestinations(userId));
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const refreshControl = usePremiumRefreshControl(false, () => void reload());

  const onSave = async (name: string) => {
    const dest = name.trim();
    if (dest.length < 2 || busy || !userId) return;
    setBusy(true);
    setMsg(null);
    try {
      const row = await saveDreamDestination({
        userId,
        name: dest,
        timing: timing.trim() || undefined,
      });
      await transitionStartTripPlanning({
        intent: "Dream destination",
        destination: row.name,
      });
      if (notifyOk) {
        await recordLifecycleNotice({
          id: `dream_saved_${row.id}`,
          userId,
          title: "Dream destination saved",
          message: `${row.name} is your next-trip focus. Open this note to return to the list.`,
          href: "/dreamDestinations",
        });
      }
      setDraft("");
      setTiming("");
      setMsg(
        notifyOk
          ? `${row.name} saved. A notification deep-links back to this list.`
          : `${row.name} saved. No notification was sent — consent was off.`,
      );
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not save destination.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={refreshControl}
      testID="dream-destinations-scroll"
    >
      <Stack.Screen options={header} />
      <Text style={styles.kicker}>Between trips</Text>
      <Text style={styles.title}>Where do you dream of going next?</Text>
      <Text style={styles.lead}>
        Save a destination. banDiTour remembers it after checkout. Places without live inventory stay
        aspirational — we will not invent bookable stays.
      </Text>

      <Text style={styles.label}>Destination</Text>
      <TextInput
        style={styles.input}
        value={draft}
        onChangeText={setDraft}
        placeholder="e.g. Vietnam"
        placeholderTextColor={color.muted}
        testID="dream-destination-input"
      />
      <Text style={styles.label}>Timing (optional)</Text>
      <TextInput
        style={styles.input}
        value={timing}
        onChangeText={setTiming}
        placeholder="e.g. next spring"
        placeholderTextColor={color.muted}
        testID="dream-timing-input"
      />
      <Pressable
        style={styles.consentRow}
        onPress={() => setNotifyOk((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: notifyOk }}
        testID="dream-notify-consent"
      >
        <Text style={styles.consentMark}>{notifyOk ? "☑" : "☐"}</Text>
        <Text style={styles.consentText}>
          Notify me in the app when this destination is saved. Off by default.
        </Text>
      </Pressable>
      <Pressable
        style={[styles.primary, (busy || !userId) && styles.disabled]}
        disabled={busy || !userId}
        onPress={() => void onSave(draft)}
        testID="dream-save-cta"
      >
        <Text style={styles.primaryText}>{busy ? "Saving…" : "Save dream destination"}</Text>
      </Pressable>

      <Text style={styles.section}>Suggestions</Text>
      <View style={styles.chips}>
        {DREAM_DESTINATION_SUGGESTIONS.map((name) => (
          <Pressable
            key={name}
            style={styles.chip}
            onPress={() => setDraft(name)}
            testID={`dream-suggest-${name.replace(/\s+/g, "-")}`}
          >
            <Text style={styles.chipText}>{name}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>Your list</Text>
      {rows.length === 0 ? (
        <Text style={styles.empty} testID="dream-empty">
          No dream destinations yet.
        </Text>
      ) : (
        rows.map((d, i) => (
          <View key={d.id} style={styles.card} testID={`dream-row-${d.id}`}>
            <Text style={styles.cardName}>
              {i === 0 ? "Primary · " : ""}
              {d.name}
            </Text>
            <Text style={styles.cardMeta}>
              {[d.timing, d.styles.join(" · ")].filter(Boolean).join(" · ") || "Whenever you’re ready"}
            </Text>
            <View style={styles.cardActions}>
              {i > 0 ? (
                <Pressable onPress={() => void setPrimaryDreamDestination(userId, d.id).then(reload)}>
                  <Text style={styles.link}>Make primary</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => void removeDreamDestination(userId, d.id).then(reload)}
                testID={`dream-remove-${d.id}`}
              >
                <Text style={styles.linkDanger}>Remove</Text>
              </Pressable>
              <Pressable onPress={() => router.push("/travelBottle" as Href)}>
                <Text style={styles.link}>Travel in a Bottle</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
      {msg ? (
        <Text style={styles.msg} testID="dream-msg">
          {msg}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surfaceWarm },
  content: { padding: 20, paddingBottom: 48 },
  kicker: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: color.brand,
  },
  title: { marginTop: 8, fontSize: 26, fontWeight: "800", color: color.ink, lineHeight: 32 },
  lead: { marginTop: 8, fontSize: 15, lineHeight: 22, color: color.inkSoft },
  label: {
    marginTop: 18,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "800",
    color: color.muted,
    textTransform: "uppercase",
  },
  consentRow: { marginTop: 14, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  consentMark: { fontSize: 18, color: color.ink, lineHeight: 22 },
  consentText: { flex: 1, fontSize: 14, lineHeight: 20, color: color.inkSoft },
  input: {
    backgroundColor: color.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: color.hairline,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: color.ink,
  },
  primary: {
    marginTop: 16,
    backgroundColor: color.ink,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  disabled: { opacity: 0.6 },
  primaryText: { color: "#FFF", fontWeight: "800", fontSize: 15 },
  section: { marginTop: 28, fontSize: 16, fontWeight: "800", color: color.ink },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  chipText: { fontWeight: "700", color: color.inkSoft },
  empty: { marginTop: 10, color: color.muted },
  card: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  cardName: { fontSize: 18, fontWeight: "800", color: color.ink },
  cardMeta: { marginTop: 4, color: color.muted },
  cardActions: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 12 },
  link: { fontWeight: "700", color: color.brand },
  linkDanger: { fontWeight: "700", color: "#B42318" },
  msg: { marginTop: 16, color: color.inkSoft, lineHeight: 20 },
});
