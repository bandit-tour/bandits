import { Stack, usePathname, useRouter, type Href } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import MainBottomNav from "@/components/MainBottomNav";
import GuestChromeBar from "@/components/GuestChromeBar";
import NearbyContextRunner from "@/components/NearbyContextRunner";
import UpperTabScreens from "@/components/UpperTabScreens";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useAppState } from "@/contexts/AppStateContext";
import { useCity } from "@/contexts/CityContext";
import { UpperTabHostProvider } from "@/contexts/UpperTabHostContext";
import { bootstrapExploreEventsCache, preloadExploreEvents } from "@/lib/exploreEventsCache";
import { hasSeenOpeningIntro } from "@/lib/openingIntroStorage";
import {
  getLowerTabFromPath,
  getUpperTabFromPath,
  navigateLowerTab,
  navigateUpperTab,
  type LowerTabHref,
  type LowerTabKey,
} from "@/lib/appNavigation";
import { color as guestColor, space, type as guestType } from "@/lib/guestDesign";
import { bootstrapMainAppSession, syncPilotHotelProfileIfNeeded } from "@/lib/pilotSession";
import { hydrateBanditsHomeFromDisk, warmBanditsHomeCache } from "@/lib/banditsHomeCache";
import { perfMark, perfStart, perfTraceNavigationPress } from "@/lib/perfTiming";
import { discoveryLaneForLifecycle, type UpperTabKey } from "@/lib/upperTab";
import { useGuestLifecycle } from "@/lib/guest-lifecycle/useGuestLifecycle";

export type { UpperTabKey } from "@/lib/upperTab";

export default function TabsLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { width } = useWindowDimensions();
  const { chatUnreadCount } = useAppState();
  const { selectedCity } = useCity();
  const { isFullStay, state: lifeState } = useGuestLifecycle();
  const isDesktop = Platform.OS === "web" && width >= 900;

  const discoveryLanes = discoveryLaneForLifecycle({ isFullStay, state: lifeState });

  useEffect(() => {
    void bootstrapExploreEventsCache(selectedCity || undefined);
  }, [selectedCity]);

  useEffect(() => {
    if (!selectedCity) return;
    const delay = Platform.OS === "android" ? 1200 : 1800;
    const timer = setTimeout(() => {
      preloadExploreEvents(selectedCity);
    }, delay);
    return () => clearTimeout(timer);
  }, [selectedCity]);

  const lowerTab = getLowerTabFromPath(pathname);
  const upperTab = getUpperTabFromPath(pathname);
  const path = pathname || "";
  /**
   * Discovery rail is part of the Guest App shell — visible on Home AND Explore worlds.
   * Home keeps TripHomeScreen as the body (no overlay). Explore worlds mount UpperTabScreens.
   * Do NOT hide ecosystem lanes behind the Explore bottom tab alone.
   */
  const showDiscoveryRail =
    lowerTab === "home" ||
    upperTab !== null ||
    path.includes("/explore") ||
    path.includes("/bandits") ||
    path.includes("/experiences") ||
    path.includes("/smarttraveler") ||
    path.includes("/travelBottle") ||
    path.includes("/shop") ||
    path.includes("/bandiTeam") ||
    path.includes("/scam-alerts") ||
    path.includes("/alerts");
  const showUpperOverlay = upperTab !== null;
  const [optimisticUpperTab, setOptimisticUpperTab] = useState<UpperTabKey | null>(null);
  /** Null on Home = no rail chip selected (Explore container has no duplicate chip). */
  const displayUpperTab = (optimisticUpperTab ?? upperTab) as UpperTabKey | null;

  useEffect(() => {
    setOptimisticUpperTab(null);
  }, [pathname]);

  /** Active: near-black text; underline uses brand red below */
  const tabColor = colorScheme === "dark" ? "#FFFFFF" : guestColor.ink;
  const inactiveColor = colorScheme === "dark" ? "#A0A0A0" : guestColor.muted;

  const goLowerTab = useCallback(
    (path: LowerTabHref, tab: LowerTabKey) => {
      perfTraceNavigationPress(`tab_lower:${tab}`, () => {
        navigateLowerTab(router, path, tab, lowerTab);
      });
    },
    [lowerTab, router],
  );

  const goUpperTab = useCallback(
    (tab: UpperTabKey) => {
      perfTraceNavigationPress(`tab_upper:${tab}`, () => {
        setOptimisticUpperTab(tab);
        if (tab === "explore" || tab === "experiences" || tab === "bandits") {
          preloadExploreEvents(selectedCity || undefined);
        }
        navigateUpperTab(router, tab);
      });
    },
    [router, selectedCity],
  );

  useEffect(() => {
    perfMark("tabs_layout_mounted", "launch");
    void hydrateBanditsHomeFromDisk();
    void warmBanditsHomeCache();
    const end = perfStart("bootstrap_main_session", "launch");
    void (async () => {
      try {
        await bootstrapMainAppSession();
        await syncPilotHotelProfileIfNeeded();
      } finally {
        end();
      }
    })();
  }, []);

  useEffect(() => {
    const delay = Platform.OS === "android" ? 800 : 2500;
    const timer = setTimeout(() => {
      void import("@/app/(tabs)/explore");
      void import("@/app/(tabs)/experiences");
      void import("@/app/(tabs)/bandits");
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;
    let a = true;
    void (async () => {
      const seen = await hasSeenOpeningIntro();
      if (!a || seen) return;
      router.replace("/" as Href);
    })();
    return () => {
      a = false;
    };
  }, [router]);

  const upperTabButtons = discoveryLanes.map((tab) => (
    <UpperTabButton
      key={tab.key}
      label={
        tab.key === "bandits"
          ? "Local banDits"
          : tab.key === "shop"
            ? "banDiShop"
            : tab.label
      }
      active={displayUpperTab === tab.key}
      onPress={() => goUpperTab(tab.key)}
      color={tabColor}
      inactiveColor={inactiveColor}
      equalFlex={isDesktop}
    />
  ));

  return (
    <>
      <NearbyContextRunner />
      <UpperTabHostProvider
        enabled={showUpperOverlay}
        active={displayUpperTab ?? "explore"}
      >
        <View style={styles.container}>
          <GuestChromeBar />
          {showDiscoveryRail && (
            <View style={styles.upperTabs} testID="guest-discovery-rail">
              {isDesktop ? (
                <View style={styles.upperTabsInnerDesktop}>{upperTabButtons}</View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.upperTabsInnerMobile}
                  style={styles.upperTabsScroll}
                >
                  {upperTabButtons}
                </ScrollView>
              )}
            </View>
          )}

          <View style={styles.content} collapsable={false}>
            <Stack
              screenOptions={{
                headerShown: false,
                headerBackTitle: "Back",
                headerBackTitleVisible: true,
                freezeOnBlur: true,
                contentStyle: { backgroundColor: "#FFFFFF" },
                ...Platform.select({
                  web: { animation: "fade" as const, animationDuration: 120 },
                  default: { animation: "none" as const },
                }),
              }}
            />
            {showUpperOverlay && displayUpperTab ? (
              <View style={styles.upperTabOverlay} pointerEvents="box-none">
                <UpperTabScreens active={displayUpperTab} />
              </View>
            ) : null}
          </View>

          <View style={styles.bottomNavBar} collapsable={false}>
            <MainBottomNav
              activeTab={lowerTab}
              onHome={() => goLowerTab("/home", "home")}
              onExplore={() => goLowerTab("/explore", "explore")}
              onHotelier={() => goLowerTab("/hotelier", "hotelier")}
              onLocalFriend={() => goLowerTab("/localFriend", "localFriend")}
              onChat={() => goLowerTab("/community", "chat")}
              onMore={() => goLowerTab("/menu", "menu")}
              chatBadgeCount={chatUnreadCount}
            />
          </View>
        </View>
      </UpperTabHostProvider>
    </>
  );
}

function UpperTabButton({
  label,
  active,
  onPress,
  color,
  inactiveColor,
  equalFlex,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  color: string;
  inactiveColor: string;
  equalFlex: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      delayPressIn={0}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      android_ripple={{ color: "rgba(224, 49, 49, 0.12)", borderless: false }}
      style={[styles.upperTabButton, equalFlex ? styles.upperTabEqual : styles.upperTabScrollItem]}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Text
        style={[
          styles.upperTabLabel,
          active ? guestType.navActive : guestType.nav,
          { color: active ? color : inactiveColor },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <View
        style={[
          styles.upperTabUnderline,
          { backgroundColor: active ? guestColor.brand : "transparent" },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { flex: 1, minHeight: 0 },
  bottomNavBar: {
    width: "100%",
    alignSelf: "stretch",
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    zIndex: 200,
    elevation: 24,
    ...Platform.select({
      web: { position: "relative" as const },
      android: { elevation: 24 },
      default: {},
    }),
  },
  upperTabOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    backgroundColor: "#FFFFFF",
  },
  upperTabs: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: guestColor.hairline,
    backgroundColor: "#FFFFFF",
    zIndex: 110,
    elevation: 12,
    ...Platform.select({ android: { elevation: 12 }, default: {} }),
  },
  upperTabsScroll: {
    width: "100%",
  },
  upperTabsInnerDesktop: {
    flexDirection: "row",
    width: "100%",
    paddingHorizontal: space.sm,
    paddingBottom: space.xs,
    paddingTop: space.xs,
    alignItems: "stretch",
  },
  upperTabsInnerMobile: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingHorizontal: space.sm,
    paddingBottom: space.xs,
    paddingTop: space.xs,
    gap: 2,
  },
  upperTabButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: space.sm,
  },
  upperTabEqual: {
    flex: 1,
  },
  upperTabScrollItem: {
    flexGrow: 0,
    flexShrink: 0,
    paddingHorizontal: 12,
  },
  upperTabLabel: {
    textAlign: "center",
  },
  upperTabUnderline: {
    height: 3,
    width: "72%",
    maxWidth: 40,
    marginTop: 6,
    borderRadius: 999,
  },
});
