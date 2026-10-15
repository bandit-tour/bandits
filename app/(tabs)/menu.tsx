import type { User } from "@supabase/supabase-js";
import { useFocusEffect } from "@react-navigation/native";
import { Stack, useRouter, type Href } from "expo-router";
import React from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppState } from "@/contexts/AppStateContext";
import { canShowOwnerPrivateMenu, isAnonymousSupabaseSession } from "@/lib/appAdminAccess";
import { safeSignOut } from "@/lib/authSafe";
import { liveHotelDisplayName } from "@/lib/stay/liveHotelIdentity";
import { useGuestLifecycle } from "@/lib/guest-lifecycle/useGuestLifecycle";
import { usePremiumRefreshControl } from "@/lib/mobilePullToRefresh";
import { resolveMenuAuthSnapshot } from "@/lib/pilotDeskGate";
import { getHotelEntry } from "@/lib/pilotSession";
import { logNativeNav } from "@/lib/nativeNavLog";
import { supabase } from "@/lib/supabase";

const LOGO = require("@/assets/icons/logobanditourapp.png");

type MenuCard = {
  key: string;
  emoji: string;
  title: string;
  href?: Href;
  action?: "logout";
};

type MenuGroup = {
  id: string;
  title: string;
  cards: MenuCard[];
};

/**
 * Prefer single-codepoint / widely-supported emoji. Avoid VS16 / ZWJ sequences
 * (e.g. bellhop 🛎️) that have crashed Android Text rendering on some devices.
 */
const QUICK_ACTIONS_STAY: { key: string; title: string; subtitle: string; emoji: string; href: Href }[] = [
  { key: "stay", title: "Continue My Stay", subtitle: "Stay management", emoji: "🏨", href: "/hotelier/stayInfo" },
  { key: "lf", title: "Local Friend", subtitle: "Meet someone local", emoji: "💬", href: "/localFriend" },
  { key: "alerts", title: "Safety alerts", subtitle: "bandiTEAM", emoji: "⚠", href: "/scam-alerts" },
  { key: "impact", title: "Impact / Passport", subtitle: "Your journey trace", emoji: "🌍", href: "/impact" },
  { key: "notif", title: "Notifications", subtitle: "Inbox", emoji: "🔔", href: "/notifications" },
];

const QUICK_ACTIONS_AFTER: { key: string; title: string; subtitle: string; emoji: string; href: Href }[] = [
  { key: "memory", title: "City Memory", subtitle: "Your trip memory", emoji: "🧭", href: "/cityMemory" as Href },
  { key: "bottle", title: "Next journey", subtitle: "Travel in a Bottle", emoji: "🌲", href: "/travelBottle" },
  { key: "lf", title: "Local Friend", subtitle: "Meet someone local", emoji: "💬", href: "/localFriend" },
  { key: "alerts", title: "Safety alerts", subtitle: "bandiTEAM", emoji: "⚠", href: "/scam-alerts" },
  { key: "impact", title: "Impact / Passport", subtitle: "Your journey trace", emoji: "🌍", href: "/impact" },
  { key: "spots", title: "My Spots", subtitle: "Saved places", emoji: "♥", href: "/mySpots" },
  { key: "reactivate", title: "Connect My New Stay", subtitle: "Verified booking", emoji: "🔑", href: "/reactivateStay" },
];

/**
 * MORE (canonical): Local Friend | Impact / Passport | Bookings | Following |
 * My Spots | Notifications | Account | Alerts / bandiTEAM safety
 */
/**
 * Stay groups: destinations not already in QUICK_ACTIONS_STAY
 * (Continue My Stay / Local Friend / Safety / Impact / Notifications).
 * Underlying routes remain reachable from Hotel tab + Account.
 */
const MENU_GROUPS_STAY: MenuGroup[] = [
  {
    id: "journey",
    title: "Your journey",
    cards: [
      { key: "bookings", emoji: "🎫", title: "Bookings", href: "/bookings" },
      { key: "following", emoji: "👥", title: "Following", href: "/following" },
      { key: "spots", emoji: "♥", title: "My Spots", href: "/mySpots" },
      { key: "premium", emoji: "⭐", title: "Your Local Insider", href: "/account/membership" },
      { key: "bottle", emoji: "🍾", title: "Travel in a Bottle", href: "/travelBottle" },
    ],
  },
  {
    id: "safety",
    title: "bandiTEAM · Safety",
    cards: [
      // See Reports = same route as Quick “Safety alerts”; keep upload-only here.
      { key: "upload-report", emoji: "📝", title: "Upload Report", href: "/bandiTeam/report" },
    ],
  },
  {
    id: "stay",
    title: "My Stay",
    cards: [
      { key: "hotel", emoji: "🏨", title: "Current Hotel", href: "/hotelier/welcome" },
      { key: "room", emoji: "🚪", title: "Room Details", href: "/hotelier/stayInfo" },
      { key: "brk", emoji: "🍳", title: "Breakfast", href: "/hotelier/breakfast" },
      { key: "rest", emoji: "🍷", title: "Restaurant", href: "/hotelier/restaurant" },
      { key: "spa", emoji: "✦", title: "Spa", href: "/hotelier/spa" },
      { key: "rs", emoji: "🔔", title: "Room Service", href: "/hotelier/roomService" },
      { key: "late", emoji: "⏰", title: "Late Checkout", href: "/hotelier/lateCheckout" },
      { key: "hev", emoji: "📅", title: "Hotel Events", href: "/hotelier/events" },
    ],
  },
  {
    id: "account",
    title: "Account",
    cards: [
      { key: "profile", emoji: "👤", title: "See My Profile", href: "/my-profile" as Href },
      { key: "acct", emoji: "🔧", title: "Account Settings", href: "/account" },
      { key: "pay", emoji: "💳", title: "Payments", href: "/account/payments" },
      { key: "lang", emoji: "🌍", title: "Language", href: "/account/language" },
      { key: "privacy", emoji: "🔒", title: "Privacy", href: "/account/privacy" },
      { key: "help", emoji: "❓", title: "Help", href: "/account/faq" },
    ],
  },
];

/**
 * After / pre-stay groups: no repeat of QUICK_ACTIONS_AFTER destinations
 * (City Memory, Next journey/TiB, Local Friend, Safety, Impact, My Spots, Connect Stay).
 */
const MENU_GROUPS_AFTER: MenuGroup[] = [
  {
    id: "saved",
    title: "Saved · Following · Premium",
    cards: [
      { key: "following", emoji: "👥", title: "Following", href: "/following" },
      { key: "premium", emoji: "⭐", title: "Your Local Insider", href: "/account/membership" },
      { key: "moments", emoji: "✨", title: "My Moments", href: "/myMoment" },
    ],
  },
  {
    id: "safety",
    title: "bandiTEAM · Safety",
    cards: [
      { key: "upload-report", emoji: "📝", title: "Upload Report", href: "/bandiTeam/report" },
    ],
  },
  {
    id: "account",
    title: "Account",
    cards: [
      { key: "profile", emoji: "👤", title: "See My Profile", href: "/my-profile" as Href },
      { key: "acct", emoji: "🔧", title: "Account Settings", href: "/account" },
      { key: "pay", emoji: "💳", title: "Payments", href: "/account/payments" },
      { key: "lang", emoji: "🌍", title: "Language", href: "/account/language" },
      { key: "privacy", emoji: "🔒", title: "Privacy", href: "/account/privacy" },
      { key: "help", emoji: "❓", title: "Help", href: "/account/faq" },
    ],
  },
  {
    id: "journey-after",
    title: "Your journey",
    cards: [
      { key: "bookings", emoji: "🎫", title: "Bookings", href: "/bookings" },
      { key: "notif", emoji: "🔔", title: "Notifications", href: "/notifications" },
    ],
  },
];

function applyMenuAuthFromUser(
  user: User | null,
  setters: {
    setOwnerPrivateMenuAllowed: (v: boolean) => void;
    setAuthHydrated: (v: boolean) => void;
  },
) {
  /** Guests / anonymous must never see Owner tools — even if a stale email slips through. */
  const allowed =
    Boolean(user) &&
    !isAnonymousSupabaseSession(user) &&
    canShowOwnerPrivateMenu(user);
  setters.setOwnerPrivateMenuAllowed(allowed);
  setters.setAuthHydrated(true);
}

function lifeStateLabel(state: string | null | undefined): string {
  return String(state || "PRE_TRIP").replace(/_/g, " ");
}

/** Premium trip command center — not a settings list. Lifecycle-aware. */
export default function MenuScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width >= 1000;
  const { activeIdentity } = useAppState();
  const { isFullStay, state: lifeState, activeStay, refresh: refreshLife } = useGuestLifecycle();
  const [ownerPrivateMenuAllowed, setOwnerPrivateMenuAllowed] = React.useState(false);
  const [authHydrated, setAuthHydrated] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [hotelName, setHotelName] = React.useState("");
  const [avatarFailed, setAvatarFailed] = React.useState(false);

  const roomLabel = activeStay?.roomNumber
    ? `Room ${activeStay.roomNumber}`
    : isFullStay
      ? "In stay"
      : "Between trips";

  const guestName = activeIdentity?.displayName?.trim() || "Guest";
  const avatarUrl = activeIdentity?.avatarUrl?.trim() || "";

  React.useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUrl]);

  const authSetters = React.useMemo(
    () => ({
      setOwnerPrivateMenuAllowed,
      setAuthHydrated,
    }),
    [],
  );

  const quickActions = isFullStay ? QUICK_ACTIONS_STAY : QUICK_ACTIONS_AFTER;
  const menuGroups = isFullStay ? MENU_GROUPS_STAY : MENU_GROUPS_AFTER;

  /** Card width without Yoga % + gap (historically fragile on Android). */
  const contentPad = 16;
  const gridGap = 12;
  const cardWidth = Math.max(140, Math.floor((Math.min(width, isDesktopWeb ? 720 : width) - contentPad * 2 - gridGap) / 2));

  const refreshMenuAccess = React.useCallback(async () => {
    try {
      const { user } = await resolveMenuAuthSnapshot();
      applyMenuAuthFromUser(user, authSetters);
    } catch {
      applyMenuAuthFromUser(null, authSetters);
    }
    try {
      await refreshLife();
    } catch {
      /* lifecycle read must never take down More */
    }
  }, [authSetters, refreshLife]);

  React.useEffect(() => {
    void getHotelEntry()
      .then((entry) => {
        setHotelName(
          liveHotelDisplayName({
            stayName: activeStay?.hotelName,
            entry,
            slug: activeStay?.hotelSlug || entry?.slug,
          }),
        );
      })
      .catch(() => {
        setHotelName(String(activeStay?.hotelName || "").trim());
      });
  }, [activeStay?.hotelName, activeStay?.hotelSlug]);

  React.useLayoutEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      applyMenuAuthFromUser(session?.user ?? null, authSetters);
    });
  }, [authSetters]);

  React.useEffect(() => {
    void refreshMenuAccess();
  }, [refreshMenuAccess]);

  React.useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applyMenuAuthFromUser(session?.user ?? null, authSetters);
    });
    return () => subscription.unsubscribe();
  }, [authSetters]);

  useFocusEffect(
    React.useCallback(() => {
      void refreshMenuAccess();
    }, [refreshMenuAccess]),
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshMenuAccess();
    } finally {
      setRefreshing(false);
    }
  }, [refreshMenuAccess]);

  const menuRefreshControl = usePremiumRefreshControl(refreshing, onRefresh);

  const go = (href: Href) => {
    try {
      logNativeNav("menu.go", { href: String(href) });
      router.push(href);
    } catch {
      /* ignore nav race */
    }
  };

  const onLogout = async () => {
    await safeSignOut();
    router.replace("/home" as Href);
  };

  const initials = guestName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false, title: "More" }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          isDesktopWeb && styles.contentDesktop,
          { paddingBottom: 48 + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        refreshControl={menuRefreshControl}
        testID="menu-scroll"
      >
        {/* Header — trip identity */}
        <View style={styles.header}>
          <View style={styles.logoChip}>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel="bandiTour" />
          </View>
          <View style={styles.identityRow}>
            <Pressable style={styles.avatarWrap} onPress={() => go("/my-profile" as Href)}>
              {avatarUrl && !avatarFailed ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.avatar}
                  onError={() => setAvatarFailed(true)}
                  accessibilityLabel="Profile photo"
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitials}>{initials || "G"}</Text>
                </View>
              )}
            </Pressable>
            <View style={styles.identityText}>
              <Text style={styles.guestName}>{guestName}</Text>
              <Text style={styles.hotelLine}>{hotelName}</Text>
              <Text style={styles.metaLine}>
                {isFullStay
                  ? `${roomLabel} · 2 nights remaining`
                  : `${lifeStateLabel(lifeState)} · account active`}
              </Text>
              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>
                  {isFullStay ? "Premium Guest" : "Members Club · After Trip"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick actions */}
        <Text style={styles.sectionLabel}>Quick actions</Text>
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickRow}
        >
          {quickActions.map((q, idx) => (
            <Pressable
              key={q.key}
              style={({ pressed }) => [
                styles.quickCard,
                idx < quickActions.length - 1 ? styles.quickCardGap : null,
                pressed && styles.pressed,
              ]}
              onPress={() => go(q.href)}
            >
              <Text style={styles.quickEmoji}>{q.emoji}</Text>
              <Text style={styles.quickTitle} numberOfLines={2}>
                {q.title}
              </Text>
              <Text style={styles.quickSub} numberOfLines={1}>
                {q.subtitle}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Grouped destination cards */}
        {menuGroups.map((group) => (
          <View key={group.id} style={styles.group}>
            <Text style={styles.sectionLabel}>{group.title}</Text>
            <View style={styles.grid}>
              {group.cards.map((card, idx) => (
                <Pressable
                  key={card.key}
                  style={({ pressed }) => [
                    styles.card,
                    { width: cardWidth },
                    idx % 2 === 0 ? styles.cardGapRight : null,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => {
                    if (card.href) go(card.href);
                  }}
                >
                  <Text style={styles.cardEmoji}>{card.emoji}</Text>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {card.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        {ownerPrivateMenuAllowed ? (
          <View style={styles.group}>
            <Text style={styles.sectionLabel}>Owner</Text>
            <View style={styles.grid}>
              <Pressable
                style={({ pressed }) => [
                  styles.card,
                  { width: cardWidth },
                  styles.cardGapRight,
                  pressed && styles.pressed,
                ]}
                onPress={() => go("/operatorDesk" as Href)}
              >
                <Text style={styles.cardEmoji}>🔧</Text>
                <Text style={styles.cardTitle}>Pilot Desk</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.card, { width: cardWidth }, pressed && styles.pressed]}
                onPress={() => go("/admin" as Href)}
              >
                <Text style={styles.cardEmoji}>📊</Text>
                <Text style={styles.cardTitle}>CDesk</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Pressable style={styles.logout} onPress={() => void onLogout()}>
          <Text style={styles.logoutText}>Sign out</Text>
        </Pressable>

        {authHydrated ? null : <Text style={styles.hint}>Loading account…</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F6F4F0" },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  contentDesktop: { maxWidth: 720, alignSelf: "center", width: "100%" },
  header: {
    backgroundColor: "#0A0908",
    borderRadius: 24,
    padding: 20,
    marginBottom: 22,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  logoChip: {
    alignSelf: "flex-start",
    backgroundColor: "#FFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  logo: { width: 118, height: 26 },
  identityRow: { flexDirection: "row", alignItems: "center" },
  avatarWrap: { borderRadius: 28, overflow: "hidden", marginRight: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(240,215,160,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(240,215,160,0.45)",
  },
  avatarInitials: {
    color: "rgba(240,215,160,0.98)",
    fontWeight: "800",
    fontSize: 18,
  },
  identityText: { flex: 1, minWidth: 0 },
  guestName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: -0.3,
  },
  hotelLine: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(240,215,160,0.95)",
    marginTop: 2,
  },
  metaLine: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(240,215,160,0.14)",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E8A317",
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800",
    color: "rgba(240,215,160,0.98)",
    letterSpacing: 0.3,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#6B5A3A",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 12,
    marginTop: 8,
  },
  quickRow: { paddingBottom: 8, paddingRight: 40, flexDirection: "row", alignItems: "stretch" },
  quickCard: {
    width: 148,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  quickCardGap: { marginRight: 12 },
  quickEmoji: { fontSize: 28, marginBottom: 10 },
  quickTitle: { fontSize: 14, fontWeight: "800", color: "#111", lineHeight: 18 },
  quickSub: { fontSize: 12, color: "#777", marginTop: 4 },
  group: { marginTop: 18 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  card: {
    minHeight: 108,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    justifyContent: "space-between",
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.07,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  cardGapRight: { marginRight: 12 },
  cardEmoji: { fontSize: 26, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#1A1A1A", lineHeight: 20 },
  /** Opacity only — avoid transform+elevation native crashes on Android Pressable. */
  pressed: { opacity: 0.88 },
  logout: {
    marginTop: 28,
    marginBottom: 8,
    backgroundColor: "#0A0908",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  logoutText: {
    color: "rgba(240,215,160,0.98)",
    fontWeight: "800",
    fontSize: 15,
  },
  hint: { marginTop: 12, fontSize: 12, color: "#999", textAlign: "center" },
});
