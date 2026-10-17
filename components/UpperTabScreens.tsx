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
  /** False while the discovery host is parked under Home/Hotel/Chat/More. */
  shellVisible?: boolean;
};

/**
 * Explore-lane host. Visited discovery panes stay warm (hidden, not unmounted)
 * so returning to a tab paints immediately. Data loads gate on tabActive.
 * Travel in a Bottle is More / stack — never mounted here.
 */
export default function UpperTabScreens({ active, shellVisible = true }: Props) {
  const [visited, setVisited] = useState<Set<UpperTabKey>>(() => new Set(["explore"]));

  useEffect(() => {
    setVisited((prev) => {
      if (prev.has(active)) return prev;
      const next = new Set(prev);
      next.add(active);
      return next;
    });
  }, [active]);

  const mounted = useMemo(() => {
    const next = new Set(visited);
    next.add(active);
    return next;
  }, [active, visited]);

  const pane = (key: UpperTabKey, child: React.ReactNode) => {
    if (!mounted.has(key)) return null;
    const on = shellVisible && active === key;
    return (
      <View
        style={[styles.pane, on ? styles.paneVisible : styles.paneHidden]}
        pointerEvents={on ? "auto" : "none"}
        collapsable={false}
      >
        {child}
      </View>
    );
  };

  return (
    <View style={styles.host} pointerEvents="box-none" collapsable={false}>
      {pane("explore", <ExploreScreen tabActive={shellVisible && active === "explore"} />)}
      {pane("bandits", <BanditsScreen tabActive={shellVisible && active === "bandits"} />)}
      {pane("experiences", <ExperiencesScreen tabActive={shellVisible && active === "experiences"} />)}
      {pane("smarttraveler", <SmartTravelerScreen tabActive={shellVisible && active === "smarttraveler"} />)}
      {pane("shop", <ShopScreen />)}
      {pane("banditeam", <BandiTeamHubScreen tabActive={shellVisible && active === "banditeam"} />)}
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
