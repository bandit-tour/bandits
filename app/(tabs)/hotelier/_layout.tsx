import { Stack } from "expo-router";
import React from "react";

/**
 * Hotelier nested stack — Dashboard → Module → Item.
 * Back steps through the stack; never jumps to Home.
 */
export default function HotelierLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: "Back",
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        contentStyle: { backgroundColor: "#0F0E0C" },
        headerStyle: { backgroundColor: "#0F0E0C" },
        headerTintColor: "#F0D7A0",
        headerTitleStyle: { color: "#F7F2E8", fontWeight: "700" },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Hotel",
          headerLeft: () => null,
          headerBackVisible: false,
        }}
      />
      <Stack.Screen name="[module]" options={{ title: "Service" }} />
      <Stack.Screen name="item/[itemId]" options={{ title: "Details" }} />
    </Stack>
  );
}
