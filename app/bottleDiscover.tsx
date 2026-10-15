import { Stack, useRouter, type Href } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { color, radius } from "@/lib/guestDesign";
import {
  attachChatThreadToSession,
  getOrCreateMomentChatThread,
  GUEST_MOMENT_CHAT_TYPE,
  GUEST_MOMENT_THREAD_REF,
  loadActiveBottleSession,
  revealBottleScanSender,
  type BottleScanSession,
} from "@/lib/guest-moment";
import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";

/**
 * Bottle discovery bridge — Mode A (Moment) + Mode B (Local Friend).
 * Reveal → Reply → Chat. No dead ends.
 */
export default function BottleDiscoverScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<BottleScanSession | null>(null);
  const [busy, setBusy] = useState(false);

  const header = useAppBackScreenOptions({
    title: session?.mode === "local_friend" ? "Local Friend" : "Moment",
    fallback: "/home" as Href,
    escapeShortcuts: true,
    headerTintColor: color.ink,
    headerStyle: { backgroundColor: color.surface },
  });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setSession(await loadActiveBottleSession());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onReveal = async () => {
    setBusy(true);
    try {
      const next = await revealBottleScanSender();
      if (next) setSession(next);
    } finally {
      setBusy(false);
    }
  };

  const openChat = async () => {
    if (!session) return;
    setBusy(true);
    try {
      if (session.mode === "local_friend" && session.floatId) {
        router.push({
          pathname: "/chat",
          params: {
            banditName: session.revealed ? session.sender.displayName : "Message in a bottle",
            notificationId: session.notificationId || session.floatId,
            notificationType: "local_friend_bottle",
            referenceId: session.floatId,
            referenceType: "local_friend_ocean_claim",
            notificationTitle: session.revealed ? session.sender.displayName : "Message in a bottle",
            notificationMessage: session.quote,
          },
        } as Href);
        return;
      }

      /**
       * QA-06: Moments stay mystery-first. Reveal is not chat consent —
       * require an explicit reveal tap before opening a 2-way Chat thread.
       * Does not touch Notifications vs Chat routing.
       */
      if (session.mode === "moment" && !session.revealed) {
        const next = await revealBottleScanSender();
        if (next) setSession(next);
        return;
      }

      const thread = await getOrCreateMomentChatThread({
        threadId: session.chatThreadId,
        peer: session.sender,
        openingQuote: session.quote,
      });
      await attachChatThreadToSession(thread.id);
      /** When conversation starts, point inbox at the chat thread. */
      if (session.notificationId && /^[0-9a-f-]{36}$/i.test(session.notificationId)) {
        try {
          const { supabase } = await import("@/lib/supabase");
          await supabase
            .from("notifications")
            .update({
              title: session.sender.displayName,
              reference_id: thread.id,
              reference_type: GUEST_MOMENT_THREAD_REF,
              type: GUEST_MOMENT_CHAT_TYPE,
            })
            .eq("id", session.notificationId);
        } catch {
          /* best-effort */
        }
      }
      router.push({
        pathname: "/chat",
        params: {
          banditName: session.sender.displayName,
          notificationId: thread.id,
          notificationType: GUEST_MOMENT_CHAT_TYPE,
          referenceId: thread.id,
          referenceType: GUEST_MOMENT_THREAD_REF,
          notificationTitle: session.sender.displayName,
          notificationMessage: session.quote,
        },
      } as Href);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={header} />
        <View style={styles.loading}>
          <ActivityIndicator color={color.brand} />
        </View>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={header} />
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No bottle discovery yet</Text>
          <Text style={styles.emptyLead}>
            Scan a bandiTour bottle to receive a Moment or a Local Friend message.
          </Text>
          <Pressable style={styles.primary} onPress={() => router.push("/bottle" as Href)}>
            <Text style={styles.primaryText}>Open bottle scan</Text>
          </Pressable>
          <Pressable style={styles.link} onPress={() => router.push("/myMoment" as Href)}>
            <Text style={styles.linkText}>Set My Moment</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const isMoment = session.mode === "moment";

  return (
    <View style={styles.screen}>
      <Stack.Screen options={header} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>
          {isMoment ? "A MOMENT FROM THE CITY" : "A LOCAL FRIEND MESSAGE"}
        </Text>

        <View style={styles.quoteCard}>
          <Text style={styles.quote}>“{session.quote}”</Text>
        </View>

        {!session.revealed ? (
          <>
            <Text style={styles.curiosity}>
              {isMoment
                ? "Someone left this for the next traveler. Curiosity first — identity later."
                : "A traveler nearby sent this through Local Friend. Reply continues in Chat."}
            </Text>
            {isMoment ? (
              <Pressable
                style={[styles.primary, busy && styles.disabled]}
                disabled={busy}
                onPress={() => void onReveal()}
              >
                <Text style={styles.primaryText}>
                  {busy ? "Revealing…" : "See who sent this"}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.primary, busy && styles.disabled]}
                disabled={busy}
                onPress={() => void openChat()}
              >
                <Text style={styles.primaryText}>{busy ? "Opening…" : "Reply in Chat"}</Text>
              </Pressable>
            )}
          </>
        ) : (
          <>
            <View style={styles.senderCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{session.sender.avatarInitials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.senderName}>{session.sender.displayName}</Text>
                <Text style={styles.senderMeta}>
                  {[session.sender.city, session.sender.stayHint].filter(Boolean).join(" · ")}
                </Text>
                <Text style={styles.senderKind}>
                  {session.banditId || /^[0-9a-f-]{36}$/i.test(session.sender.id)
                    ? "Local banDit"
                    : session.sender.kind === "local_friend"
                      ? "Local Friend"
                      : "Guest · Moment"}
                </Text>
              </View>
            </View>

            <Pressable
              style={[styles.primary, busy && styles.disabled]}
              disabled={busy}
              onPress={() => void openChat()}
            >
              <Text style={styles.primaryText}>{busy ? "Opening…" : "Reply"}</Text>
            </Pressable>
            {session.banditId ||
            (session.sender.id &&
              /^[0-9a-f-]{36}$/i.test(session.sender.id)) ? (
              <Pressable
                style={[styles.secondary, busy && styles.disabled]}
                disabled={busy}
                onPress={() => {
                  const id = session.banditId || session.sender.id;
                  router.push(`/bandit/${encodeURIComponent(id)}` as Href);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Meet ${session.sender.displayName}`}
              >
                <Text style={styles.secondaryText}>
                  {`Meet ${session.sender.displayName} · Local banDit`}
                </Text>
              </Pressable>
            ) : null}
            <Text style={styles.hint}>
              Reply opens Chat. Meet opens their Local banDit profile — status, identity, City Guide,
              Routes, Premium.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surface },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 22, paddingBottom: 48 },
  emptyWrap: { flex: 1, padding: 24, justifyContent: "center" },
  emptyTitle: { fontSize: 22, fontWeight: "800", color: color.ink, marginBottom: 8 },
  emptyLead: { fontSize: 15, color: color.inkSoft, lineHeight: 22, marginBottom: 20 },
  kicker: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.3,
    color: color.muted,
    marginBottom: 14,
  },
  quoteCard: {
    backgroundColor: color.surfaceWarm,
    borderRadius: radius.xxl,
    padding: 28,
    borderWidth: 1,
    borderColor: color.hairline,
    marginBottom: 18,
  },
  quote: {
    fontSize: 26,
    fontWeight: "700",
    color: color.ink,
    lineHeight: 36,
    letterSpacing: -0.4,
    fontFamily: "Caros",
  },
  curiosity: {
    fontSize: 15,
    lineHeight: 22,
    color: color.inkSoft,
    marginBottom: 22,
  },
  primary: {
    backgroundColor: color.brand,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  secondary: {
    marginTop: 12,
    backgroundColor: color.ink,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: "center",
  },
  secondaryText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  disabled: { opacity: 0.7 },
  senderCard: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    backgroundColor: color.surfaceWarm,
    borderRadius: radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: color.hairline,
    marginBottom: 18,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: color.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 18 },
  senderName: { fontSize: 18, fontWeight: "800", color: color.ink },
  senderMeta: { fontSize: 13, color: color.muted, marginTop: 2 },
  senderKind: { fontSize: 12, fontWeight: "700", color: color.brand, marginTop: 6 },
  hint: {
    marginTop: 12,
    textAlign: "center",
    fontSize: 13,
    color: color.muted,
  },
  link: { marginTop: 16, alignItems: "center" },
  linkText: { color: color.inkSoft, fontWeight: "700", textDecorationLine: "underline" },
});
