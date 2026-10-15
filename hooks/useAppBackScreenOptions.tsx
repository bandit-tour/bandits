import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { useRouter, type Href } from "expo-router";
import React, { useCallback, useMemo } from "react";
import { BackHandler, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { goToAppHome, goToPlayMenu, navigateAppBack } from "@/lib/appNavigation";
import { perfTraceNavigationPress } from "@/lib/perfTiming";

/** Reliable back: stack history first, then expo-router, then safe fallback. */
export function useAppBackNavigation(fallback: Href): () => void {
  const router = useRouter();
  const navigation = useNavigation();
  return useCallback(() => {
    perfTraceNavigationPress("back", () => {
      navigateAppBack(router, fallback, navigation);
    });
  }, [navigation, router, fallback]);
}

function HeaderEscapeShortcuts() {
  const router = useRouter();
  return (
    <View style={styles.escapeHeaderRow}>
      <Pressable
        onPress={() => goToPlayMenu(router)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Go to Menu"
      >
        <Text style={styles.escapeHeaderText}>Menu</Text>
      </Pressable>
      <Pressable
        onPress={() => goToAppHome(router)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Go Home"
      >
        <Text style={styles.escapeHeaderText}>Home</Text>
      </Pressable>
    </View>
  );
}

/** Universal ← Back control for secondary Guest App screens. */
export function GuestBackButton({ onPress, tintColor }: { onPress: () => void; tintColor?: string }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 10, bottom: 10, left: 8, right: 12 }}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      style={styles.backBtn}
    >
      <Text style={[styles.backLabel, tintColor ? { color: tintColor } : null]}>← Back</Text>
    </Pressable>
  );
}

type AppBackScreenOptionsArgs = {
  title?: string;
  fallback: Href;
  headerShown?: boolean;
  /** When false, no Back control (tab roots). Default true for secondary screens. */
  showBack?: boolean;
  /** Menu + Home shortcuts in header (stack screens outside bottom tabs). */
  escapeShortcuts?: boolean;
  headerRight?: NativeStackNavigationOptions["headerRight"];
  headerStyle?: NativeStackNavigationOptions["headerStyle"];
  headerTintColor?: string;
};

export function useAppBackScreenOptions({
  title = "",
  fallback,
  headerShown = true,
  showBack = true,
  escapeShortcuts = false,
  headerRight,
  headerStyle,
  headerTintColor,
}: AppBackScreenOptionsArgs): NativeStackNavigationOptions {
  const navigation = useNavigation();
  const handleBack = useAppBackNavigation(fallback);

  useFocusEffect(
    useCallback(() => {
      if (!showBack || Platform.OS !== "android") return undefined;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        handleBack();
        return true;
      });
      return () => sub.remove();
    }, [handleBack, showBack]),
  );

  /** Clear stale titles (e.g. bandiTEAM) when leaving so the next screen never inherits them. */
  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ title, headerShown });
      return () => {
        navigation.setOptions({ title: "", headerShown: false });
      };
    }, [headerShown, navigation, title]),
  );

  const mergedHeaderRight = useMemo((): NativeStackNavigationOptions["headerRight"] => {
    if (!escapeShortcuts && !headerRight) return undefined;
    if (!escapeShortcuts) return headerRight;
    if (!headerRight) return () => <HeaderEscapeShortcuts />;
    return (props) => (
      <View style={styles.headerRightMerge}>
        {typeof headerRight === "function" ? headerRight(props) : headerRight}
        <HeaderEscapeShortcuts />
      </View>
    );
  }, [escapeShortcuts, headerRight]);

  return useMemo(
    () => ({
      headerShown,
      title,
      headerBackTitle: "Back",
      headerBackTitleVisible: true,
      headerBackVisible: false,
      gestureEnabled: showBack,
      fullScreenGestureEnabled: showBack,
      headerStyle,
      headerTintColor,
      headerLeft: showBack
        ? () => <GuestBackButton onPress={handleBack} tintColor={headerTintColor ?? "#111111"} />
        : () => null,
      headerRight: mergedHeaderRight,
    }),
    [handleBack, headerShown, headerStyle, headerTintColor, mergedHeaderRight, showBack, title],
  );
}

const styles = StyleSheet.create({
  backBtn: {
    paddingLeft: Platform.OS === "ios" ? 4 : 0,
    paddingRight: 8,
    paddingVertical: 6,
    justifyContent: "center",
  },
  backLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111111",
  },
  escapeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginRight: Platform.OS === "ios" ? 4 : 8,
  },
  escapeHeaderText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111111",
  },
  headerRightMerge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
});
