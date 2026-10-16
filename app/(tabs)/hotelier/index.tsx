import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { Stack, useRouter, type Href } from "expo-router";
import React, { useRef } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  GUEST_STAY,
  HOTEL_CAMPAIGNS,
  HOTEL_EVENTS,
  HOTEL_OFFERS,
  HOTEL_SERVICES,
  HOTELIER_QUICK_ACTIONS,
  PERSONAL_STAY_FACTS,
  TODAY_AT_HOTEL,
  rewritePlaySandboxCopy,
  type CampaignCard,
  type HotelServiceCard,
  type HotelierModuleId,
} from "@/lib/guest-workspace/hotelierDashboard";
import { useGuestLifecycle } from "@/lib/guest-lifecycle/useGuestLifecycle";
import { liveHotelDisplayName, isIsolatedPlaySandboxSlug } from "@/lib/stay/liveHotelIdentity";
import { imageFocusStyle } from "@/lib/imageRatios";
import { getHotelEntry } from "@/lib/pilotSession";
import { radius } from "@/lib/guestDesign";

/**
 * Guest Hotel tab = Hotelier boutique experience (not Hotelier OS staff).
 * Lifecycle gates restricted requests only — never erases the product surface.
 * Between Trips is a contextual state (banner), not a replacement screen.
 */
export default function HotelierGuestHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const todayRef = useRef<ScrollView>(null);
  const [hotelName, setHotelName] = React.useState("");
  const [heroUri, setHeroUri] = React.useState<string | null>(null);
  const [hotelSlug, setHotelSlug] = React.useState("");
  const [todayX, setTodayX] = React.useState(0);
  const {
    loading: lifeLoading,
    isFullStay,
    isAfterTrip,
    state,
    activeStay,
    snap,
  } = useGuestLifecycle();

  const isMobile = width < 720;
  const contentPad = isMobile ? 14 : 20;
  const contentMax = Math.min(1120, width);
  const contentW = Math.max(280, contentMax - contentPad * 2);

  /** Desktop 260–300 · Mobile 190–220 · wide crop (~2.6–3.2:1) */
  const heroH = isMobile
    ? Math.min(220, Math.max(190, Math.round(contentW / 2.6)))
    : Math.min(300, Math.max(260, Math.round(Math.min(contentW, 920) / 3.2)));

  const todayCardW = isMobile
    ? Math.min(240, Math.max(220, width * 0.72))
    : Math.min(260, Math.max(220, 240));
  const todayGap = 12;
  const todayStep = todayCardW + todayGap;

  const serviceCols = width >= 1100 ? 3 : width >= 720 ? 2 : 1;
  const serviceCardW =
    serviceCols === 1
      ? Math.min(320, contentW * 0.88)
      : Math.min(320, Math.max(280, (contentW - 14 * (serviceCols - 1)) / serviceCols));
  const serviceImgH = Math.min(240, Math.max(180, Math.round(serviceCardW * (3 / 4))));

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const entry = await getHotelEntry();
      const past = snap?.stays?.find((s) => s.hotelSlug || s.hotelName) || snap?.stays?.[0];
      const slug = activeStay?.hotelSlug || past?.hotelSlug || entry?.slug || "";
      const name = liveHotelDisplayName({
        stayName: activeStay?.hotelName || past?.hotelName,
        entry,
        slug,
      });
      if (cancelled) return;
      setHotelName(name);
      setHotelSlug(slug);
      if (!slug) {
        setHeroUri(null);
        return;
      }
      // Live hotels: remote tenant hero only — never PLAY local asset fallback.
      if (isIsolatedPlaySandboxSlug(slug)) {
        setHeroUri(null);
        return;
      }
      try {
        const { resolveHotelWhiteLabel } = await import("@/lib/hotelRemoteWhiteLabel");
        const resolved = await resolveHotelWhiteLabel(slug, { allowPlayFallback: false });
        if (cancelled) return;
        const src = resolved.config.introHeroSource as { uri?: string } | number;
        if (resolved.source === "remote" && src && typeof src === "object" && src.uri) {
          setHeroUri(src.uri);
        } else {
          setHeroUri(null);
        }
      } catch {
        if (!cancelled) setHeroUri(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeStay?.hotelName, activeStay?.hotelSlug, snap?.stays]);

  const openModule = (id: HotelierModuleId) => {
    router.push(`/hotelier/${id}` as Href);
  };

  const onTodayScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setTodayX(e.nativeEvent.contentOffset.x);
  };

  const scrollToday = (dir: -1 | 1) => {
    const maxX = Math.max(0, TODAY_AT_HOTEL.length * todayStep - contentW);
    const next = Math.min(maxX, Math.max(0, todayX + dir * todayStep));
    todayRef.current?.scrollTo({ x: next, animated: true });
    setTodayX(next);
  };

  const actionCols = width >= 1100 ? 4 : width >= 720 ? 3 : 2;
  const actionW =
    (contentW - 12 * (actionCols - 1)) / actionCols;

  const offerCols = width >= 1000 ? 3 : width >= 640 ? 2 : 1;
  const offerCardW =
    offerCols === 1
      ? Math.min(320, contentW * 0.88)
      : Math.min(320, Math.max(280, (contentW - 14 * (offerCols - 1)) / offerCols));
  const offerImgH = Math.min(240, Math.max(180, Math.round(offerCardW * (3 / 4))));

  const playSandbox = isIsolatedPlaySandboxSlug(hotelSlug || activeStay?.hotelSlug);
  const roomNumber = isFullStay
    ? activeStay?.roomNumber || (playSandbox ? GUEST_STAY.roomNumber : null)
    : null;
  const copyCtx = {
    hotelName,
    roomNumber,
    hotelSlug: hotelSlug || activeStay?.hotelSlug,
  };
  const hasHotelContext = Boolean(hotelName || hotelSlug || playSandbox);
  const lifecyclePhase =
    isFullStay || state === "ACTIVE_STAY" || state === "REACTIVATED"
      ? "during"
      : isAfterTrip || state === "AFTER_TRIP" || state === "NEXT_TRIP_PLANNING"
        ? "after"
        : "before";
  const todaySectionLabel =
    lifecyclePhase === "during"
      ? "Today at your hotel"
      : lifecyclePhase === "after"
        ? "At your hotel"
        : "Discover your hotel";
  const heroKicker =
    lifecyclePhase === "during"
      ? "What can your hotel do for you right now?"
      : lifecyclePhase === "after"
        ? "Browse your hotel — reconnect when you book again"
        : "Explore the hotel before you arrive";

  const stayFacts = (playSandbox ? PERSONAL_STAY_FACTS : PERSONAL_STAY_FACTS.filter((f) => !["wifi", "addr", "desk"].includes(f.id))).map(
    (fact) => ({
      ...fact,
      value:
        fact.id === "room" && !playSandbox
          ? roomNumber
            ? `Room ${roomNumber}`
            : "Ask reception"
          : rewritePlaySandboxCopy(fact.value, copyCtx),
    }),
  );
  const serviceItems = HOTEL_SERVICES.map((s) => ({
    ...s,
    title: rewritePlaySandboxCopy(s.title, copyCtx),
    detail: rewritePlaySandboxCopy(s.detail, copyCtx),
  }));
  const offerItems = HOTEL_OFFERS.map((s) => ({
    ...s,
    title: rewritePlaySandboxCopy(s.title, copyCtx),
    detail: rewritePlaySandboxCopy(s.detail, copyCtx),
  }));
  const eventItems = HOTEL_EVENTS.map((s) => ({
    ...s,
    title: rewritePlaySandboxCopy(s.title, copyCtx),
    detail: rewritePlaySandboxCopy(s.detail, copyCtx),
  }));
  const campaignItems = HOTEL_CAMPAIGNS.map((s) => ({
    ...s,
    title: rewritePlaySandboxCopy(s.title, copyCtx),
    detail: rewritePlaySandboxCopy(s.detail, copyCtx),
  }));

  const identityMeta = [
    roomNumber ? `Room ${roomNumber}` : null,
    isFullStay && playSandbox ? `${GUEST_STAY.nightsRemaining} nights` : null,
    lifecyclePhase === "during"
      ? playSandbox
        ? GUEST_STAY.premiumStatus
        : hotelName
          ? "Your stay"
          : null
      : lifecyclePhase === "after"
        ? "Browse anytime"
        : "Before arrival",
  ]
    .filter(Boolean)
    .join(" · ");

  const heroSource = heroUri
    ? { uri: heroUri }
    : playSandbox || hasHotelContext
      ? require("@/assets/images/play-theatrou.png")
      : { uri: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80" };

  if (lifeLoading) {
    return (
      <View style={[styles.screen, styles.loadingWrap, Platform.OS === "web" && styles.screenWeb]}>
        <Stack.Screen options={{ title: "Hotelier", headerLeft: () => null, headerBackVisible: false }} />
        <Text style={styles.loadingText}>Opening Hotelier…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, Platform.OS === "web" && styles.screenWeb]}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: 56 + insets.bottom, paddingHorizontal: contentPad },
      ]}
      showsVerticalScrollIndicator
      bounces
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      testID="hotelier-guest-scroll"
    >
      <Stack.Screen
        options={{
          title: "Hotelier",
          headerLeft: () => null,
          headerBackVisible: false,
        }}
      />

      {/* Compact stay identity — above hero */}
      <View style={styles.identity}>
        <Text style={styles.identityKicker}>Hotelier</Text>
        <Text style={styles.identityHotel} numberOfLines={1}>
          {hotelName || "Your hotel"}
        </Text>
        <Text style={styles.identityMeta} numberOfLines={1}>
          {identityMeta || "Boutique hotel experience"}
        </Text>
      </View>

      {!isFullStay ? (
        <View style={styles.lifecycleBanner} testID="hotelier-lifecycle-banner">
          <Text style={styles.lifecycleBannerTitle}>
            {lifecyclePhase === "after"
              ? "Between trips? Your next stay is waiting."
              : "Connect your stay to unlock room requests."}
          </Text>
          <Text style={styles.lifecycleBannerBody}>
            {lifecyclePhase === "after"
              ? "Browse hotel stories and services anytime. Requests need a verified booking."
              : "Explore the hotel before you arrive. Breakfast, spa and room requests unlock with a verified stay."}
          </Text>
          <View style={styles.lifecycleBannerActions}>
            <Pressable
              style={styles.lifecyclePrimary}
              onPress={() => router.push("/reactivateStay" as Href)}
              accessibilityRole="button"
              testID="hotelier-connect-stay"
            >
              <Text style={styles.lifecyclePrimaryText}>
                {lifecyclePhase === "after" ? "Connect My New Stay" : "Connect My Stay"}
              </Text>
            </Pressable>
            <Pressable
              style={styles.lifecycleGhost}
              onPress={() =>
                router.push((lifecyclePhase === "after" ? "/travelBottle" : "/explore") as Href)
              }
              accessibilityRole="button"
            >
              <Text style={styles.lifecycleGhostText}>
                {lifecyclePhase === "after" ? "Explore your next stay" : "Explore the city"}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Compact hero — boutique photography */}
      <View style={[styles.hero, { height: heroH, maxHeight: isMobile ? 220 : 300 }]}>
        <ExpoImage
          source={heroSource}
          style={[StyleSheet.absoluteFillObject, imageFocusStyle("center")]}
          contentFit="cover"
        />
        <View style={styles.heroScrim} />
        <Text style={styles.heroKicker}>{heroKicker}</Text>
      </View>

      {/* TODAY / DISCOVER */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionInline}>{todaySectionLabel}</Text>
        <View style={styles.carouselControls}>
          <Pressable
            style={styles.carouselBtn}
            onPress={() => scrollToday(-1)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Previous today cards"
          >
            <Ionicons name="chevron-back" size={18} color="#F0D7A0" />
          </Pressable>
          <Pressable
            style={styles.carouselBtn}
            onPress={() => scrollToday(1)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Next today cards"
          >
            <Ionicons name="chevron-forward" size={18} color="#F0D7A0" />
          </Pressable>
        </View>
      </View>
      <ScrollView
        ref={todayRef}
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.todayRow, { gap: todayGap }]}
        onScroll={onTodayScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={todayStep}
        disableIntervalMomentum
        {...Platform.select({
          web: { style: styles.todayScrollWeb } as object,
          default: {},
        })}
      >
        {TODAY_AT_HOTEL.map((item) => (
          <Pressable
            key={item.id}
            style={({ pressed }) => [
              styles.todayCard,
              { width: todayCardW },
              pressed && styles.pressed,
            ]}
            onPress={() => openModule(item.module)}
          >
            <View style={[styles.todayAccent, { backgroundColor: item.accent ?? "#E03131" }]} />
            <Text style={styles.todayTitle} numberOfLines={2}>
              {rewritePlaySandboxCopy(item.title, copyCtx)}
            </Text>
            <Text style={styles.todayDetail} numberOfLines={2}>
              {rewritePlaySandboxCopy(item.detail, copyCtx)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* QUICK ACTIONS */}
      <Text style={styles.section}>Quick actions</Text>
      <View style={styles.actions}>
        {HOTELIER_QUICK_ACTIONS.map((a) => (
          <Pressable
            key={a.id}
            style={({ pressed }) => [
              styles.actionCard,
              { width: actionW, maxWidth: actionW },
              pressed && styles.pressed,
            ]}
            onPress={() => openModule(a.id)}
          >
            <Text style={styles.actionEmoji}>{a.emoji}</Text>
            <Text style={styles.actionTitle} numberOfLines={2}>
              {a.title}
            </Text>
            <Text style={styles.actionSub} numberOfLines={1}>
              {a.subtitle}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* YOUR STAY */}
      <Text style={styles.section}>Your stay</Text>
      <View style={styles.stayCard}>
        {stayFacts.map((fact, i) => (
          <Pressable
            key={fact.id}
            style={[styles.stayRow, i === stayFacts.length - 1 && styles.stayRowLast]}
            onPress={() => fact.module && openModule(fact.module)}
            disabled={!fact.module}
          >
            <Text style={styles.stayLabel}>{fact.label}</Text>
            <Text style={styles.stayValue}>{fact.value}</Text>
          </Pressable>
        ))}
      </View>

      {/* HOTEL SERVICES — 4:3 cards */}
      <Text style={styles.section}>Hotel services</Text>
      <ServiceGrid
        items={serviceItems}
        cardW={serviceCardW}
        imgH={serviceImgH}
        cols={serviceCols}
        isMobile={isMobile}
        onOpen={openModule}
      />

      {/* OFFERS */}
      <Text style={styles.section}>Hotel offers</Text>
      <OfferGrid
        items={offerItems}
        cardW={offerCardW}
        imgH={offerImgH}
        cols={offerCols}
        isMobile={isMobile}
        onOpen={openModule}
      />

      {/* EVENTS */}
      <Text style={styles.section}>Hotel events</Text>
      <OfferGrid
        items={eventItems}
        cardW={offerCardW}
        imgH={offerImgH}
        cols={offerCols}
        isMobile={isMobile}
        onOpen={openModule}
      />

      {/* CAMPAIGNS */}
      <Text style={styles.section}>Campaigns</Text>
      <OfferGrid
        items={campaignItems}
        cardW={offerCardW}
        imgH={offerImgH}
        cols={offerCols}
        isMobile={isMobile}
        onOpen={openModule}
      />
    </ScrollView>
  );
}

function ServiceGrid({
  items,
  cardW,
  imgH,
  cols,
  isMobile,
  onOpen,
}: {
  items: HotelServiceCard[];
  cardW: number;
  imgH: number;
  cols: number;
  isMobile: boolean;
  onOpen: (id: HotelierModuleId) => void;
}) {
  if (isMobile || cols === 1) {
    return (
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardRow}
        decelerationRate="fast"
        snapToInterval={cardW + 12}
      >
        {items.map((c) => (
          <ServiceCard key={c.id} item={c} cardW={cardW} imgH={imgH} onOpen={onOpen} />
        ))}
      </ScrollView>
    );
  }
  return (
    <View style={styles.cardGrid}>
      {items.map((c) => (
        <ServiceCard key={c.id} item={c} cardW={cardW} imgH={imgH} onOpen={onOpen} />
      ))}
    </View>
  );
}

function ServiceCard({
  item,
  cardW,
  imgH,
  onOpen,
}: {
  item: HotelServiceCard;
  cardW: number;
  imgH: number;
  onOpen: (id: HotelierModuleId) => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.mediaCard, { width: cardW, maxWidth: 320 }, pressed && styles.pressed]}
      onPress={() => onOpen(item.module)}
    >
      <View style={[styles.mediaImageWrap, { height: imgH }]}>
        <ExpoImage
          source={{ uri: item.imageUrl }}
          style={[styles.mediaImage, imageFocusStyle("center")]}
          contentFit="cover"
          transition={160}
        />
      </View>
      <View style={styles.mediaBody}>
        <Text style={styles.mediaTitle}>{item.title}</Text>
        <Text style={styles.mediaDetail}>{item.detail}</Text>
      </View>
    </Pressable>
  );
}

function OfferGrid({
  items,
  cardW,
  imgH,
  cols,
  isMobile,
  onOpen,
}: {
  items: CampaignCard[];
  cardW: number;
  imgH: number;
  cols: number;
  isMobile: boolean;
  onOpen: (id: HotelierModuleId) => void;
}) {
  if (isMobile || cols === 1) {
    return (
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardRow}
        decelerationRate="fast"
        snapToInterval={cardW + 12}
      >
        {items.map((c) => (
          <OfferCard key={c.id} item={c} cardW={cardW} imgH={imgH} onOpen={onOpen} />
        ))}
      </ScrollView>
    );
  }
  return (
    <View style={styles.cardGrid}>
      {items.map((c) => (
        <OfferCard key={c.id} item={c} cardW={cardW} imgH={imgH} onOpen={onOpen} />
      ))}
    </View>
  );
}

function OfferCard({
  item,
  cardW,
  imgH,
  onOpen,
}: {
  item: CampaignCard;
  cardW: number;
  imgH: number;
  onOpen: (id: HotelierModuleId) => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.mediaCard, { width: cardW, maxWidth: 320 }, pressed && styles.pressed]}
      onPress={() => onOpen(item.module)}
    >
      <View style={[styles.mediaImageWrap, { height: imgH }]}>
        <ExpoImage
          source={{ uri: item.imageUrl }}
          style={[styles.mediaImage, imageFocusStyle("center")]}
          contentFit="cover"
          transition={160}
        />
      </View>
      <View style={styles.mediaBody}>
        <Text style={styles.mediaTitle}>{item.title}</Text>
        <Text style={styles.mediaDetail}>{item.detail}</Text>
        <Text style={styles.mediaCta}>{item.cta} →</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#141210",
    ...Platform.select({
      web: { overflow: "auto" as const },
      default: {},
    }),
  },
  screenWeb: {
    height: "100%" as unknown as number,
    overflow: "auto" as const,
  },
  scrollContent: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
  },
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  loadingText: {
    color: "rgba(247,242,232,0.8)",
    fontWeight: "600",
    fontSize: 15,
  },
  identity: {
    paddingTop: 10,
    paddingBottom: 10,
  },
  identityKicker: {
    color: "rgba(240,215,160,0.9)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  identityHotel: {
    color: "#F7F2E8",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  identityMeta: {
    marginTop: 4,
    color: "rgba(247,242,232,0.72)",
    fontSize: 13,
    fontWeight: "600",
  },
  lifecycleBanner: {
    backgroundColor: "rgba(240,215,160,0.12)",
    borderWidth: 1,
    borderColor: "rgba(240,215,160,0.28)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  lifecycleBannerTitle: {
    color: "#F7F2E8",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  lifecycleBannerBody: {
    marginTop: 6,
    color: "rgba(247,242,232,0.78)",
    fontSize: 13,
    lineHeight: 19,
  },
  lifecycleBannerActions: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  lifecyclePrimary: {
    backgroundColor: "#F0D7A0",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  lifecyclePrimaryText: {
    color: "#141210",
    fontWeight: "800",
    fontSize: 13,
  },
  lifecycleGhost: {
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  lifecycleGhostText: {
    color: "rgba(240,215,160,0.95)",
    fontWeight: "700",
    fontSize: 13,
  },
  hero: {
    width: "100%",
    maxWidth: "100%",
    borderRadius: 20,
    overflow: "hidden",
    justifyContent: "flex-end",
    padding: 16,
    marginBottom: 4,
    backgroundColor: "#2A2620",
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    /** ~30% dark — photo stays recognizable */
    backgroundColor: "rgba(8,7,6,0.30)",
  },
  heroKicker: {
    color: "rgba(240,215,160,0.98)",
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 0.2,
    zIndex: 1,
    maxWidth: 320,
    lineHeight: 18,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
    marginBottom: 10,
  },
  sectionInline: {
    fontSize: 12,
    fontWeight: "800",
    color: "rgba(240,215,160,0.85)",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  section: {
    fontSize: 12,
    fontWeight: "800",
    color: "rgba(240,215,160,0.85)",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 22,
    marginBottom: 12,
  },
  carouselControls: { flexDirection: "row", gap: 6 },
  carouselBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(240,215,160,0.4)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(26,24,20,0.95)",
  },
  todayScrollWeb: {
    overflow: "auto" as const,
  },
  todayRow: {
    paddingBottom: 4,
    paddingRight: 40,
  },
  todayCard: {
    backgroundColor: "#1F1C18",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(240,215,160,0.18)",
    overflow: "hidden",
    height: 126,
    minHeight: 110,
    maxHeight: 140,
  },
  todayAccent: {
    width: 28,
    height: 3,
    borderRadius: 2,
    marginBottom: 10,
  },
  todayTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#F7F2E8",
    lineHeight: 19,
  },
  todayDetail: {
    fontSize: 12,
    color: "rgba(247,242,232,0.72)",
    marginTop: 5,
    lineHeight: 16,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  actionCard: {
    minHeight: 96,
    backgroundColor: "#1F1C18",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(240,215,160,0.14)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  actionEmoji: { fontSize: 22, marginBottom: 6 },
  actionTitle: { fontSize: 13, fontWeight: "800", color: "#F7F2E8" },
  actionSub: { fontSize: 11, color: "rgba(247,242,232,0.62)", marginTop: 2 },
  stayCard: {
    backgroundColor: "#1F1C18",
    borderRadius: 18,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(240,215,160,0.14)",
  },
  stayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(247,242,232,0.1)",
  },
  stayRowLast: { borderBottomWidth: 0 },
  stayLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(240,215,160,0.75)",
    width: 110,
  },
  stayValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#F7F2E8",
    textAlign: "right",
  },
  cardRow: {
    gap: 12,
    paddingRight: 24,
    paddingBottom: 4,
  },
  cardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  mediaCard: {
    backgroundColor: "#1F1C18",
    borderRadius: radius.xxl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(240,215,160,0.14)",
  },
  mediaImageWrap: {
    width: "100%",
    maxWidth: 320,
    maxHeight: 240,
    backgroundColor: "#2A2620",
    overflow: "hidden",
  },
  mediaImage: {
    width: "100%",
    height: "100%",
  },
  mediaBody: {
    padding: 12,
  },
  mediaTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#F7F2E8",
  },
  mediaDetail: {
    fontSize: 12,
    color: "rgba(247,242,232,0.7)",
    marginTop: 4,
    lineHeight: 17,
  },
  mediaCta: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "800",
    color: "#F0D7A0",
  },
  pressed: { opacity: 0.9 },
});
