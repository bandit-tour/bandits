import { Stack, useRouter, type Href } from "expo-router";
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

import { useAppState } from "@/contexts/AppStateContext";
import { color, radius, space } from "@/lib/guestDesign";
import {
  getMomentHistory,
  getMyMomentToday,
  initials,
  pickInspiration,
  saveMyMoment,
  type GuestMoment,
  type MomentHistoryEntry,
} from "@/lib/guest-moment";
import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";

/**
 * My Moment — daily personal status for bottle discovery.
 * Not settings. Not a travel-journal list.
 */
export default function MyMomentScreen() {
  const router = useRouter();
  const { activeIdentity } = useAppState();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [moment, setMoment] = useState<GuestMoment | null>(null);
  const [draft, setDraft] = useState("");
  const [writing, setWriting] = useState(false);
  const [history, setHistory] = useState<MomentHistoryEntry[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const displayName = activeIdentity?.displayName?.trim() || "Guest";

  const header = useAppBackScreenOptions({
    title: "My Moment",
    fallback: "/menu" as Href,
    showBack: true,
    escapeShortcuts: true,
    headerTintColor: color.ink,
    headerStyle: { backgroundColor: color.surface },
  });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const self = {
        id: activeIdentity?.userId || "self",
        displayName,
        city: "Athens",
        stayHint: "PLAY Theatrou",
        avatarInitials: initials(displayName),
        kind: "guest" as const,
      };
      const m = await getMyMomentToday(self);
      setMoment(m);
      setDraft(m.text);
      setHistory(await getMomentHistory());
    } finally {
      setLoading(false);
    }
  }, [activeIdentity?.userId, displayName]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const persist = async (text: string) => {
    setSaving(true);
    setMsg(null);
    try {
      const self = {
        id: activeIdentity?.userId || "self",
        displayName,
        city: "Athens",
        stayHint: "PLAY Theatrou",
        avatarInitials: initials(displayName),
        kind: "guest" as const,
      };
      const next = await saveMyMoment({ text, bottleEligible: true, sender: self });
      setMoment(next);
      setDraft(next.text);
      setWriting(false);
      setMsg("Moment updated — eligible for bottle discovery today.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not save Moment.");
    } finally {
      setSaving(false);
    }
  };

  const onShuffle = () => {
    const insp = pickInspiration(undefined, moment?.id);
    setDraft(insp.line);
    setWriting(true);
  };

  const onNewMoment = () => {
    const insp = pickInspiration(`new:${Date.now()}`);
    setDraft(insp.line);
    setWriting(true);
  };

  if (loading || !moment) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={header} />
        <View style={styles.loading}>
          <ActivityIndicator color={color.brand} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={header} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>YOUR MOMENT TODAY</Text>
        <View style={styles.heroCard}>
          {writing ? (
            <TextInput
              style={styles.heroInput}
              value={draft}
              onChangeText={setDraft}
              multiline
              maxLength={280}
              placeholder="Write a short line the city might overhear…"
              placeholderTextColor={color.muted}
              autoFocus
            />
          ) : (
            <Text style={styles.heroQuote}>“{moment.text}”</Text>
          )}
          <Text style={styles.heroMeta}>
            {moment.bottleEligible ? "Eligible for bottle discovery" : "Private today"} · refreshed{" "}
            {new Date(moment.updatedAt).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>

        <Text style={styles.context}>
          Your Moment may appear when another traveler discovers you through a bandiTour bottle.
        </Text>

        <View style={styles.actions}>
          {writing ? (
            <>
              <Pressable
                style={[styles.primary, saving && styles.disabled]}
                disabled={saving}
                onPress={() => void persist(draft)}
              >
                <Text style={styles.primaryText}>{saving ? "Saving…" : "Save Moment"}</Text>
              </Pressable>
              <Pressable style={styles.secondary} onPress={() => { setDraft(moment.text); setWriting(false); }}>
                <Text style={styles.secondaryText}>Cancel</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable style={styles.primary} onPress={() => setWriting(true)}>
                <Text style={styles.primaryText}>Change Moment</Text>
              </Pressable>
              <Pressable style={styles.secondary} onPress={onNewMoment}>
                <Text style={styles.secondaryText}>New Moment</Text>
              </Pressable>
              <Pressable style={styles.secondary} onPress={onShuffle}>
                <Text style={styles.secondaryText}>Shuffle inspiration</Text>
              </Pressable>
              <Pressable
                style={styles.secondary}
                onPress={() => {
                  setDraft("");
                  setWriting(true);
                }}
              >
                <Text style={styles.secondaryText}>Write my own</Text>
              </Pressable>
            </>
          )}
        </View>

        {msg ? <Text style={styles.msg}>{msg}</Text> : null}

        <Text style={styles.section}>Moments received</Text>
        <Text style={styles.sectionLead}>
          Bottle discoveries you opened — Moments and Local Friend messages.
        </Text>
        {history.length === 0 ? (
          <Text style={styles.empty}>No bottle discoveries yet. Scan a bottle to begin.</Text>
        ) : (
          history.slice(0, 12).map((h) => (
            <Pressable
              key={h.id}
              style={styles.histCard}
              onPress={() => {
                if (h.chatThreadId) {
                  router.push({
                    pathname: "/chat",
                    params: {
                      banditName: h.sender.displayName,
                      notificationId: h.chatThreadId,
                      notificationType: "guest_moment",
                      referenceId: h.chatThreadId,
                      referenceType: "guest_moment_thread",
                      notificationTitle: h.sender.displayName,
                      notificationMessage: h.quote,
                    },
                  } as Href);
                  return;
                }
                router.push("/bottleDiscover" as Href);
              }}
            >
              <Text style={styles.histMode}>
                {h.mode === "moment" ? "Moment" : "Local Friend"} ·{" "}
                {h.revealed ? h.sender.displayName : "Sender hidden"}
              </Text>
              <Text style={styles.histQuote} numberOfLines={3}>
                “{h.quote}”
              </Text>
              <Text style={styles.histMeta}>
                {h.replied ? "Conversation started" : h.revealed ? "Revealed · reply in Chat" : "Waiting to reveal"}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surface },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 22, paddingBottom: 56 },
  kicker: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    color: color.muted,
    marginBottom: 12,
  },
  heroCard: {
    backgroundColor: color.surfaceWarm,
    borderRadius: radius.xxl,
    padding: 24,
    borderWidth: 1,
    borderColor: color.hairline,
    marginBottom: 14,
  },
  heroQuote: {
    fontSize: 24,
    fontWeight: "700",
    color: color.ink,
    lineHeight: 34,
    letterSpacing: -0.3,
    fontFamily: "Caros",
  },
  heroInput: {
    minHeight: 120,
    fontSize: 20,
    fontWeight: "600",
    color: color.ink,
    lineHeight: 30,
    textAlignVertical: "top",
  },
  heroMeta: {
    marginTop: 16,
    fontSize: 12,
    fontWeight: "600",
    color: color.muted,
  },
  context: {
    fontSize: 14,
    lineHeight: 21,
    color: color.inkSoft,
    marginBottom: 22,
  },
  actions: { gap: 10, marginBottom: 18 },
  primary: {
    backgroundColor: color.brand,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  secondary: {
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: color.ink,
  },
  secondaryText: { color: color.ink, fontWeight: "700", fontSize: 15 },
  disabled: { opacity: 0.7 },
  msg: { color: color.statusGreen, fontWeight: "600", marginBottom: 16, fontSize: 13 },
  section: {
    marginTop: space.lg,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: color.ink,
    textTransform: "uppercase",
  },
  sectionLead: { fontSize: 13, color: color.muted, marginTop: 4, marginBottom: 12 },
  empty: { color: color.muted, fontSize: 13 },
  histCard: {
    backgroundColor: color.surfaceWarm,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  histMode: { fontSize: 11, fontWeight: "800", color: color.brand, marginBottom: 6 },
  histQuote: { fontSize: 15, color: color.ink, lineHeight: 22, fontWeight: "600" },
  histMeta: { marginTop: 8, fontSize: 12, color: color.muted, fontWeight: "600" },
});
