/**
 * City Memory — traveler lifecycle memory (saved places, follows, taste).
 * NOT Hotel / Hotelier OS. Hotel tab remains stay companion services.
 */
import { Stack, useRouter, type Href } from "expo-router";
import React, { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AfterTripHome } from "@/components/guest-lifecycle/AfterTripHome";
import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import { buildAfterTripHome } from "@/lib/guest-lifecycle/city-memory";
import { useGuestLifecycle } from "@/lib/guest-lifecycle/useGuestLifecycle";
import { transitionStartTripPlanning } from "@/lib/guest-lifecycle/transitions";
import { usePremiumRefreshControl } from "@/lib/mobilePullToRefresh";

export default function CityMemoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { snap, state, loading, refresh } = useGuestLifecycle();
  const [refreshing, setRefreshing] = React.useState(false);

  const model = useMemo(() => (snap ? buildAfterTripHome(snap) : null), [snap]);

  const screenOptions = useAppBackScreenOptions({
    title: "City Memory",
    fallback: "/menu" as Href,
    escapeShortcuts: true,
    headerStyle: { backgroundColor: "#F7F4EE" },
    headerTintColor: "#121212",
  });

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    void refresh()
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, [refresh]);
  const refreshControl = usePremiumRefreshControl(refreshing, onRefresh);

  if (loading && !model) {
    return (
      <View style={styles.boot}>
        <Stack.Screen options={screenOptions} />
        <ActivityIndicator color="#121212" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 48 + insets.bottom, paddingHorizontal: 16 }}
      refreshControl={refreshControl}
      testID="city-memory-scroll"
    >
      <Stack.Screen options={screenOptions} />
      <Pressable
        onPress={() => router.replace("/home" as Href)}
        style={styles.homeLink}
        accessibilityRole="button"
        accessibilityLabel="Back to Home"
      >
        <Text style={styles.homeLinkText}>← Home</Text>
      </Pressable>
      {model ? (
        <AfterTripHome
          model={model}
          state={state || "AFTER_TRIP"}
          onPlanNextTrip={() => {
            void transitionStartTripPlanning({ intent: "Plan next trip" }).then(() => {
              void refresh();
              router.push("/travelBottle" as Href);
            });
          }}
          onReactivate={() => router.push("/reactivateStay" as Href)}
        />
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Your city memory</Text>
          <Text style={styles.emptyLead}>
            Places you save, banDits you follow, and trip taste live here — independent of hotel
            services.
          </Text>
          <Pressable style={styles.cta} onPress={() => router.push("/explore" as Href)}>
            <Text style={styles.ctaText}>Explore places</Text>
          </Pressable>
          <Pressable style={styles.ctaGhost} onPress={() => router.push("/reactivateStay" as Href)}>
            <Text style={styles.ctaGhostText}>Connect My New Stay</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F7F4EE" },
  screen: { flex: 1, backgroundColor: "#F7F4EE" },
  homeLink: { paddingVertical: 12 },
  homeLinkText: { fontSize: 15, fontWeight: "700", color: "#121212" },
  empty: { paddingTop: 24 },
  emptyTitle: { fontSize: 26, fontWeight: "800", color: "#121212" },
  emptyLead: { marginTop: 10, fontSize: 15, lineHeight: 22, color: "#444" },
  cta: {
    marginTop: 20,
    backgroundColor: "#121212",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  ctaText: { color: "#FFF", fontWeight: "800" },
  ctaGhost: { marginTop: 12, paddingVertical: 12, alignItems: "center" },
  ctaGhostText: { color: "#121212", fontWeight: "700" },
});
