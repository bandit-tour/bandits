import { useRouter, type Href } from "expo-router";
import React from "react";
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconSymbol } from "@/components/ui/IconSymbol";
import { useAppState } from "@/contexts/AppStateContext";
import { useGuestLifecycle } from "@/lib/guest-lifecycle/useGuestLifecycle";
import { liveHotelDisplayName } from "@/lib/stay/liveHotelIdentity";
import { getHotelEntry } from "@/lib/pilotSession";

/** Official bandiTour mark — same asset as BANDITOUR_LOGO in hotelWhiteLabel. */
const BANDITOUR_LOGO = require("@/assets/icons/logobanditourapp.png");

/**
 * Guest chrome — brand + hotel/stay context only.
 * Not a navigation bar: no Profile, Menu, or Home here.
 * Notifications = top-right bell with badge (bottom nav is 6-item lock without Notifications).
 */
export default function GuestChromeBar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { unreadCount } = useAppState();
  const { activeStay } = useGuestLifecycle();
  const [hotelName, setHotelName] = React.useState("");

  const isCompact = width < 400;
  const logoStyle = isCompact
    ? styles.logoMobile
    : width >= 900
      ? styles.logoDesktop
      : styles.logoTablet;

  React.useEffect(() => {
    void getHotelEntry().then((entry) => {
      setHotelName(
        liveHotelDisplayName({
          stayName: activeStay?.hotelName,
          entry,
          slug: activeStay?.hotelSlug || entry?.slug,
        }),
      );
    });
  }, [activeStay?.hotelName, activeStay?.hotelSlug]);

  return (
    <View style={[styles.bar, { paddingTop: Math.max(insets.top, 6) }]}>
      <View style={styles.left}>
        <Image
          source={BANDITOUR_LOGO}
          style={logoStyle}
          resizeMode="contain"
          accessibilityLabel="bandiTour"
          accessibilityRole="image"
        />
      </View>
      <Text style={styles.hotelName} numberOfLines={1} accessibilityRole="header">
        {hotelName}
      </Text>
      <View style={styles.right}>
        <Pressable
          onPress={() => router.push("/notifications" as Href)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={
            unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
          }
          style={styles.bellHit}
        >
          <IconSymbol size={22} name="bell.badge.fill" color="#444" />
          {unreadCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : String(unreadCount)}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E8E8E8",
    gap: 8,
    zIndex: 120,
    elevation: 12,
  },
  left: {
    flexShrink: 0,
    justifyContent: "center",
    minWidth: 120,
  },
  /** Immediately recognizable brand — not favicon-sized. */
  logoMobile: {
    width: 148,
    height: 40,
  },
  logoTablet: {
    width: 172,
    height: 46,
  },
  logoDesktop: {
    width: 210,
    height: 56,
  },
  hotelName: {
    flex: 1,
    minWidth: 0,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
    color: "#0A0908",
    letterSpacing: 0.1,
    paddingHorizontal: 4,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    minWidth: 40,
    flexShrink: 0,
  },
  bellHit: {
    position: "relative",
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#C0392B",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#FFF",
    fontSize: 9,
    fontWeight: "800",
  },
});
