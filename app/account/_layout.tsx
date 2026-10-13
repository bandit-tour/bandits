import { Stack } from "expo-router";
import React from "react";

/** Account & Settings stack — separate from travel identity / My Trip. */
export default function AccountLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: "Back",
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        contentStyle: { backgroundColor: "#F6F4F0" },
        headerStyle: { backgroundColor: "#F6F4F0" },
        headerTintColor: "#E03131",
        headerTitleStyle: { color: "#1A1A1A", fontWeight: "700" },
      }}
    />
  );
}
