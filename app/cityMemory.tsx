/**
 * City Memory — traveler's permanent personal travel space.
 * NOT Hotel / Hotelier OS. Hotel tab remains stay companion services.
 */
import { Stack, useFocusEffect, useRouter, type Href } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AfterTripHome } from "@/components/guest-lifecycle/AfterTripHome";
import { useAppState } from "@/contexts/AppStateContext";
import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import { buildAfterTripHome } from "@/lib/guest-lifecycle/city-memory";
import { useGuestLifecycle } from "@/lib/guest-lifecycle/useGuestLifecycle";
import { transitionStartTripPlanning } from "@/lib/guest-lifecycle/transitions";
import { usePremiumRefreshControl } from "@/lib/mobilePullToRefresh";
import { color } from "@/lib/guestDesign";
import { listTravelMemories, type TravelMemory } from "@/lib/travel-memory";

export default function CityMemoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { snap, state, loading, refresh } = useGuestLifecycle();
  const { getCurrentUser, activeIdentity } = useAppState();
  const [refreshing, setRefreshing] = useState(false);
  const [personalMoments, setPersonalMoments] = useState<TravelMemory[]>([]);

  const model = useMemo(() => (snap ? buildAfterTripHome(snap) : null), [snap]);

  const loadMoments = useCallback(async () => {
    const u = await getCurrentUser().catch(() => null);
    const uid = u?.id || activeIdentity?.userId || null;
    const list = await listTravelMemories(uid);
    setPersonalMoments(list);
  }, [activeIdentity?.userId, getCurrentUser]);

  useFocusEffect(
    useCallback(() => {
      void loadMoments();
    }, [loadMoments]),
  );

  const screenOptions = useAppBackScreenOptions({
    title: "City Memory",
    fallback: "/menu" as Href,
    showBack: true,
    escapeShortcuts: true,
    headerStyle: { backgroundColor: color.surfaceWarm },
    headerTintColor: color.ink,
  });

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void Promise.all([refresh(), loadMoments()])
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, [loadMoments, refresh]);
  const refreshControl = usePremiumRefreshControl(refreshing, onRefresh);

  if (loading && !model) {
    return (
      <View style={styles.boot}>
        <Stack.Screen options={screenOptions} />
        <ActivityIndicator color={color.ink} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{
        paddingBottom: 56 + insets.bottom,
        paddingHorizontal: 20,
        paddingTop: 8,
        maxWidth: 1100,
        width: "100%",
        alignSelf: "center",
      }}
      refreshControl={refreshControl}
      testID="city-memory-scroll"
    >
      <Stack.Screen options={screenOptions} />
      {model ? (
        <AfterTripHome
          model={model}
          state={state || "AFTER_TRIP"}
          personalMoments={personalMoments}
          onPlanNextTrip={() => {
            void transitionStartTripPlanning({ intent: "Plan next trip" }).then(() => {
              void refresh();
              router.push("/travelBottle" as Href);
            });
          }}
          onReactivate={() => router.push("/reactivateStay" as Href)}
        />
      ) : (
        <View style={styles.empty} testID="city-memory-empty-shell">
          <Text style={styles.emptyKicker}>City Memory</Text>
          <Text style={styles.emptyTitle}>Your journey lives here</Text>
          <Text style={styles.emptyLead}>
            Places you save and banDits you follow gather here — before, during, and after stays.
          </Text>
          <Pressable
            style={styles.cta}
            onPress={() => router.push("/memory/add" as Href)}
            accessibilityRole="button"
            testID="city-memory-empty-add"
          >
            <Text style={styles.ctaText}>Add a Memory</Text>
          </Pressable>
          <Pressable
            style={styles.cta}
            onPress={() => router.push("/explore" as Href)}
            accessibilityRole="button"
          >
            <Text style={styles.ctaText}>Explore places</Text>
          </Pressable>
          <Pressable
            style={styles.ctaGhost}
            onPress={() => router.push("/reactivateStay" as Href)}
            accessibilityRole="button"
          >
            <Text style={styles.ctaGhostText}>Connect a New Stay</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: color.surfaceWarm },
  screen: { flex: 1, backgroundColor: color.surfaceWarm },
  empty: { paddingTop: 28 },
  emptyKicker: {
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: color.brand,
    fontWeight: "800",
  },
  emptyTitle: { marginTop: 8, fontSize: 28, fontWeight: "800", color: color.ink, letterSpacing: -0.4 },
  emptyLead: { marginTop: 10, fontSize: 15, lineHeight: 22, color: color.muted, maxWidth: 420 },
  cta: {
    marginTop: 22,
    backgroundColor: color.ink,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    maxWidth: 280,
  },
  ctaText: { color: "#FFF", fontWeight: "800" },
  ctaGhost: { marginTop: 12, paddingVertical: 12, alignItems: "flex-start" },
  ctaGhostText: { color: color.ink, fontWeight: "700", textDecorationLine: "underline" },
});
