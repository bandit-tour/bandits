import { Redirect } from "expo-router";
import React from "react";

/**
 * Public alias for direct `/mySpots` entry.
 * Canonical screen lives in tabs route group — saved places, not followed banDits.
 */
export default function MySpotsAliasPage() {
  return <Redirect href="/(tabs)/mySpots" />;
}
