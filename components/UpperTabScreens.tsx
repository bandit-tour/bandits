import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { BanditsScreen } from "@/app/(tabs)/bandits";
import { ExploreScreen } from "@/app/(tabs)/explore";
import { ExperiencesScreen } from "@/app/(tabs)/experiences";
import { SmartTravelerScreen } from "@/app/(tabs)/smarttraveler";
import { ShopScreen } from "@/app/(tabs)/shop";
import BandiTeamHubScreen from "@/app/bandiTeam/index";
import type { UpperTabKey } from "@/lib/upperTab";

type Props = {
  active: UpperTabKey;
};

/**
 * Explore-lane host. Explore + Local banDits keep a warm mount (tabActive gate).
 * Other rail products mount only while active — avoids JS contention freezes.
 * Travel in a Bottle is More / stack — never mounted here.
 */
export default function UpperTabScreens({ active }: Props) {
  const [visitedHeavy, setVisitedHeavy] = useState<Set<UpperTabKey>>(
    () => new Set(["explore"]),
  );

  useEffect(() => {
    if (active !== "explore" && active !== "bandits") return;
    setVisitedHeavy((prev) => {
      if (prev.has(active)) return prev;
      const next = new Set(prev);
      next.add(active);
      return next;
    });
  }, [active]);

  const heavyMounted = useMemo(() => {
    const next = new Set(visitedHeavy);
    next.add(active);
    return next;
  }, [active, visitedHeavy]);

  const heavyPane = (key: "explore" | "bandits", child: React.ReactNode) => {
    if (!heavyMounted.has(key)) return null;
    return (
      <View
        style={[styles.pane, active === key ? styles.paneVisible : styles.paneHidden]}
        pointerEvents={active === key ? "auto" : "none"}
      >
        {child}
      </View>
    );
  };

  const activeOnly = (key: UpperTabKey, child: React.ReactNode) => {
    if (active !== key) return null;
    return (
      <View style={[styles.pane, styles.paneVisible]} pointerEvents="auto">
        {child}
      </View>
    );
  };

  return (
    <View style={styles.host} pointerEvents="box-none" collapsable={false}>
      {heavyPane("explore", <ExploreScreen tabActive={active === "explore"} />)}
      {heavyPane("bandits", <BanditsScreen tabActive={active === "bandits"} />)}
      {activeOnly("experiences", <ExperiencesScreen />)}
      {activeOnly("smarttraveler", <SmartTravelerScreen />)}
      {activeOnly("shop", <ShopScreen />)}
      {activeOnly("banditeam", <BandiTeamHubScreen tabActive />)}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1, backgroundColor: "#FFFFFF" },
  pane: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFFFFF",
  },
  paneVisible: {
    opacity: 1,
    zIndex: 1,
  },
  paneHidden: {
    opacity: 0,
    zIndex: 0,
    pointerEvents: "none",
  },
});
