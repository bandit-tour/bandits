import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconSymbol } from "@/components/ui/IconSymbol";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import type { LowerTabKey } from "@/lib/appNavigation";
import { color as guestColor, space } from "@/lib/guestDesign";

interface MainBottomNavProps {
  activeTab: LowerTabKey | null;
  onHome: () => void;
  onExplore: () => void;
  onHotelier: () => void;
  onLocalFriend: () => void;
  onChat: () => void;
  /** MORE = full universe (menu). */
  onMore: () => void;
  chatBadgeCount?: number;
}

/**
 * FINAL CANONICAL bottom ACCESS (locked):
 * Home · Explore · Hotel · Local Friend · Chat · More
 * Notifications live in GuestChromeBar bell only.
 * Impact / bandiTEAM deep links remain via More + top rail (stay) / Home.
 */
export default function MainBottomNav({
  activeTab,
  onHome,
  onExplore,
  onHotelier,
  onLocalFriend,
  onChat,
  onMore,
  chatBadgeCount = 0,
}: MainBottomNavProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === "android" ? Math.max(insets.bottom, 12) : Math.max(insets.bottom, 8);

  const getColor = (key: LowerTabKey | "more") => {
    if (key === "more") {
      return activeTab === "menu" || activeTab === "profile" ? theme.tint : theme.text;
    }
    return activeTab === key ? theme.tint : theme.text;
  };

  return (
    <View
      pointerEvents="auto"
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
          borderTopColor: theme.tabIconDefault,
          paddingBottom: bottomPad,
        },
      ]}
      testID="guest-bottom-nav"
    >
      <View style={styles.row}>
        <NavButton label="Home" iconName="house.fill" color={getColor("home")} onPress={onHome} />
        <NavButton
          label="Explore"
          iconName="safari.fill"
          color={getColor("explore")}
          onPress={onExplore}
        />
        <NavButton label="Hotel" iconName="building.2.fill" color={getColor("hotelier")} onPress={onHotelier} />
        <NavButton
          label="Local Friend"
          iconName="person.2.fill"
          color={getColor("localFriend")}
          onPress={onLocalFriend}
        />
        <NavButton
          label="Chat"
          iconName="bubble.left.and.bubble.right.fill"
          color={getColor("chat")}
          onPress={onChat}
          badgeCount={chatBadgeCount}
        />
        <NavButton
          label="More"
          iconName="ellipsis.circle.fill"
          color={getColor("more")}
          onPress={onMore}
        />
      </View>
    </View>
  );
}

function NavButton({
  label,
  iconName,
  color,
  onPress,
  badgeCount = 0,
}: {
  label: string;
  iconName: string;
  color: string;
  onPress: () => void;
  badgeCount?: number;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      onPress={onPress}
      delayPressIn={0}
      hitSlop={{ top: 6, bottom: 6, left: 0, right: 0 }}
      android_ripple={{ color: "rgba(224, 49, 49, 0.12)", borderless: false }}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={`bottom-nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <View style={styles.iconWrapper}>
        <IconSymbol size={20} name={iconName as any} color={color} />
        {badgeCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeCount > 9 ? "9+" : badgeCount}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignSelf: "stretch",
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.xs,
    minHeight: 56,
  },
  row: {
    flexDirection: "row",
    width: "100%",
    alignItems: "stretch",
    justifyContent: "space-evenly",
  },
  button: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 1,
  },
  buttonPressed: {
    opacity: 0.72,
  },
  iconWrapper: {
    position: "relative",
    marginBottom: 2,
  },
  label: {
    fontSize: 9,
    fontWeight: "600",
    textAlign: "center",
    width: "100%",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -10,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: guestColor.cityGuide,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  badgeText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "800",
  },
});
