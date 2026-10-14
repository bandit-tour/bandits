import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { BanditsScreen } from "@/app/(tabs)/bandits";
import { ExploreScreen } from "@/app/(tabs)/explore";
import { ExperiencesScreen } from "@/app/(tabs)/experiences";
import { SmartTravelerScreen } from "@/app/(tabs)/smarttraveler";
import { BottleProductScreen } from "@/app/(tabs)/travelBottle";
import { ShopScreen } from "@/app/(tabs)/shop";
import BandiTeamHubScreen from "@/app/bandiTeam/index";
import type { UpperTabKey } from "@/lib/upperTab";

type Props = {
  active: UpperTabKey;
};

/**
 * Instant Explore-lane product switch. Stack routes stay in sync via router.replace.
 * Impact is More-only — not mounted in this rail host.
 * bandiTEAM mounts the full safety/community hub (Scam Alerts + report).
 */
export default function UpperTabScreens({ active }: Props) {
  const [visited, setVisited] = useState<Set<UpperTabKey>>(() => new Set(["explore"]));

  useEffect(() => {
    setVisited((prev) => {
      if (prev.has(active)) return prev;
      const next = new Set(prev);
      next.add(active);
      return next;
    });
  }, [active]);

  const tabsToMount = useMemo(() => {
    const next = new Set(visited);
    next.add(active);
    return next;
  }, [active, visited]);

  const pane = (key: UpperTabKey, child: React.ReactNode) => {
    if (!tabsToMount.has(key)) return null;
    return (
      <View
        style={[styles.pane, active === key ? styles.paneVisible : styles.paneHidden]}
        pointerEvents={active === key ? "auto" : "none"}
      >
        {child}
      </View>
    );
  };

  return (
    <View style={styles.host} pointerEvents="box-none" collapsable={false}>
      {pane("explore", <ExploreScreen tabActive={active === "explore"} />)}
      {pane("bandits", <BanditsScreen tabActive={active === "bandits"} />)}
      {pane("experiences", <ExperiencesScreen />)}
      {pane("smarttraveler", <SmartTravelerScreen />)}
      {pane("bottle", <BottleProductScreen />)}
      {pane("shop", <ShopScreen />)}
      {pane("banditeam", <BandiTeamHubScreen />)}
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
