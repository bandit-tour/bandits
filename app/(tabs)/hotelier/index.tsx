import { Image as ExpoImage } from "expo-image";
import { Stack, useRouter, type Href } from "expo-router";
import React from "react";
import {
  Image,
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
  HOTELIER_QUICK_ACTIONS,
  PERSONAL_STAY_FACTS,
  buildHappeningFeed,
  rewritePlaySandboxCopy,
  type HappeningFeedItem,
  type HotelierModuleId,
} from "@/lib/guest-workspace/hotelierDashboard";
import {
  loadHotelBottleListing,
  type HotelBottleListing,
} from "@/lib/guest-workspace/hotelBottleListing";
import { useGuestLifecycle } from "@/lib/guest-lifecycle/useGuestLifecycle";
import { liveHotelDisplayName, isIsolatedPlaySandboxSlug } from "@/lib/stay/liveHotelIdentity";
import { imageFocusStyle } from "@/lib/imageRatios";
import { getHotelEntry } from "@/lib/pilotSession";

/**
 * Guest Hotel tab = Hotelier boutique experience (not Hotelier OS staff).
 * Lifecycle gates restricted requests only — never erases the product surface.
 * Between Trips is a contextual state (banner), not a replacement screen.
 */
export default function HotelierGuestHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [hotelName, setHotelName] = React.useState("");
  const [heroUri, setHeroUri] = React.useState<string | null>(null);
  const [hotelSlug, setHotelSlug] = React.useState("");
  const [hotelListing, setHotelListing] = React.useState<HotelBottleListing | null>(null);
  const happeningItems = React.useMemo(() => buildHappeningFeed(6), []);
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
        setHotelListing(null);
        return;
      }
      void loadHotelBottleListing(slug).then((listing) => {
        if (!cancelled) setHotelListing(listing);
      });
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

  const actionCols = width >= 1100 ? 4 : width >= 720 ? 3 : 2;
  const actionW = (contentW - 12 * (actionCols - 1)) / actionCols;

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
  const lifecyclePhase =
    isFullStay || state === "ACTIVE_STAY" || state === "REACTIVATED"
      ? "during"
      : isAfterTrip || state === "AFTER_TRIP" || state === "NEXT_TRIP_PLANNING"
        ? "after"
        : "before";
  const heroKicker =
    lifecyclePhase === "during"
      ? "Your boutique hotel lobby"
      : lifecyclePhase === "after"
        ? "Browse your hotel — reconnect when you book again"
        : "Explore the hotel before you arrive";

  const stayFacts = (playSandbox
    ? PERSONAL_STAY_FACTS
    : PERSONAL_STAY_FACTS.filter((f) => !["wifi", "addr", "desk"].includes(f.id))
  ).map((fact) => ({
    ...fact,
    value:
      fact.id === "room" && !playSandbox
        ? roomNumber
          ? `Room ${roomNumber}`
          : "Ask reception"
        : rewritePlaySandboxCopy(fact.value, copyCtx),
  }));

  const happeningCards: HappeningFeedItem[] = happeningItems.map((s) => ({
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

  const displayHotel =
    hotelListing?.whiteLabel?.title || hotelListing?.displayName || hotelName || "this hotel";
  const stockHero = Boolean(heroUri && /images\.unsplash\.com|images\.pexels\.com|picsum\.photos/i.test(heroUri));
  /** Hero belongs to the selected tenant. Stock URLs are not property photography. */
  const heroSource =
    heroUri && !stockHero
      ? { uri: heroUri }
      : hotelListing?.whiteLabel?.introHeroSource
        ? hotelListing.whiteLabel.introHeroSource
        : playSandbox
          ? require("@/assets/images/play-theatrou.png")
          : null;

  const galleryRemote = (hotelListing?.remoteGalleryUrls || []).filter(
    (uri) => !/images\.unsplash\.com/i.test(uri),
  );
  const galleryLocal = hotelListing?.localGallery || [];

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

      {/* 1 — YOUR HOTEL */}
      <View style={styles.identity} testID="hotelier-section-your-hotel">
        <Text style={styles.identityKicker}>Your hotel</Text>
        <Text style={styles.identityHotel} numberOfLines={1}>
          {displayHotel}
        </Text>
        <Text style={styles.identityMeta} numberOfLines={2}>
          {hotelListing?.location
            ? `${hotelListing.location}${identityMeta ? ` · ${identityMeta}` : ""}`
            : identityMeta || "Boutique hotel experience"}
        </Text>
      </View>

      {!isFullStay ? (
        <View style={styles.lifecycleBanner} testID="hotelier-lifecycle-banner">
          <Text style={styles.lifecycleBannerTitle}>
            {lifecyclePhase === "after"
              ? "Your stay may have ended. Your journey hasn't."
              : "Connect your stay to unlock room requests."}
          </Text>
          <Text style={styles.lifecycleBannerBody}>
            {lifecyclePhase === "after"
              ? "Browse hotel services anytime. Requests need a verified booking."
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
          </View>
        </View>
      ) : null}

      <View style={[styles.hero, { height: heroH, maxHeight: isMobile ? 220 : 300 }]}>
        {heroSource ? (
          <ExpoImage
            source={heroSource}
            style={[StyleSheet.absoluteFillObject, imageFocusStyle("center")]}
            contentFit="cover"
          />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, styles.heroFallback]} testID="hotelier-hero-fallback">
            <Text style={styles.heroFallbackName}>{displayHotel}</Text>
          </View>
        )}
        <View style={styles.heroScrim} />
        <Text style={styles.heroKicker}>{heroKicker}</Text>
      </View>

      {galleryRemote.length || galleryLocal.length ? (
        <View testID="hotelier-own-gallery">
          <Text style={styles.galleryLabel}>Photos</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hotelGalleryRow}
            testID="hotelier-hotel-gallery"
          >
            {galleryRemote.slice(0, 6).map((uri) => (
              <ExpoImage key={uri} source={{ uri }} style={styles.hotelGalleryImage} contentFit="cover" />
            ))}
            {galleryLocal.slice(0, 4).map((src, idx) => (
              <Image key={`loc-${idx}`} source={src} style={styles.hotelGalleryImage} resizeMode="cover" />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View testID="hotelier-guest-copy">
        <Text style={styles.welcomeTitle}>
          {isFullStay
            ? `Make yourself at home at ${displayHotel}.`
            : `Discover ${displayHotel}.`}
        </Text>
        <Text style={styles.welcomeLine}>
          {isFullStay
            ? "Discover what's happening, explore hotel services, and make the most of your stay."
            : "Explore the hotel and its experiences. Connect your stay to unlock personal guest services."}
        </Text>
      </View>

      {/* 2 — WHAT CAN WE DO FOR YOU? */}
      <Text style={styles.section} testID="hotelier-section-services">
        What can we do for you?
      </Text>
      <Text style={styles.sectionLead}>One service directory — each opens its full hotel page.</Text>
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
            accessibilityRole="button"
            accessibilityLabel={a.title}
            testID={`hotelier-service-${a.id}`}
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

      {/* 3 — HAPPENING AT YOUR HOTEL (deduped feed) */}
      <Text style={styles.section} testID="hotelier-section-happening">
        Happening at your hotel
      </Text>
      <Text style={styles.sectionLead}>
        Curated offers, events and campaigns — each theme once.
      </Text>
      <OfferGrid
        items={happeningCards}
        cardW={offerCardW}
        imgH={offerImgH}
        cols={offerCols}
        isMobile={isMobile}
        onOpen={openModule}
      />

      {/* 4 — YOUR STAY & NEXT JOURNEY */}
      <Text style={styles.section} testID="hotelier-section-stay-next">
        Your stay & next journey
      </Text>
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

      <View style={styles.nextJourneyRow}>
        <Pressable
          style={({ pressed }) => [styles.nextJourneyCard, pressed && styles.pressed]}
          onPress={() => router.push("/cityMemory" as Href)}
          accessibilityRole="button"
          testID="hotelier-city-memory"
        >
          <Text style={styles.nextJourneyKicker}>Always yours</Text>
          <Text style={styles.nextJourneyTitle}>City Memory</Text>
          <Text style={styles.nextJourneyDetail}>Places, people and moments — beyond this stay.</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.nextJourneyCard, pressed && styles.pressed]}
          onPress={() => router.push("/travelBottle" as Href)}
          accessibilityRole="button"
          testID="hotelier-travel-bottle"
        >
          <Text style={styles.nextJourneyKicker}>Plan ahead</Text>
          <Text style={styles.nextJourneyTitle}>Travel in a Bottle</Text>
          <Text style={styles.nextJourneyDetail}>Hotel nights + a second place to sleep.</Text>
        </Pressable>
      </View>
    </ScrollView>
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
  items: HappeningFeedItem[];
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
          <OfferCard key={c.contentKey} item={c} cardW={cardW} imgH={imgH} onOpen={onOpen} />
        ))}
      </ScrollView>
    );
  }
  return (
    <View style={styles.cardGrid}>
      {items.map((c) => (
        <OfferCard key={c.contentKey} item={c} cardW={cardW} imgH={imgH} onOpen={onOpen} />
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
  item: HappeningFeedItem;
  cardW: number;
  imgH: number;
  onOpen: (id: HotelierModuleId) => void;
}) {
  const kindLabel =
    item.kind === "event" ? "Event" : item.kind === "campaign" ? "Campaign" : item.kind === "offer" ? "Offer" : "Today";
  return (
    <Pressable
      style={({ pressed }) => [styles.mediaCard, { width: cardW, maxWidth: 320 }, pressed && styles.pressed]}
      onPress={() => onOpen(item.module)}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.cta}`}
      testID={`hotelier-happening-${item.contentKey}`}
    >
      <View style={[styles.mediaImageWrap, { height: imgH }]}>
        <ExpoImage
          source={{ uri: item.imageUrl }}
          style={[styles.mediaImage, imageFocusStyle("center")]}
          contentFit="cover"
          transition={160}
        />
        <View style={styles.kindPill}>
          <Text style={styles.kindPillText}>{kindLabel}</Text>
        </View>
        {/images\.unsplash\.com|images\.pexels\.com|picsum\.photos/i.test(item.imageUrl) ? (
          <View style={styles.illustrationPill}>
            <Text style={styles.kindPillText}>Illustration</Text>
          </View>
        ) : null}
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
  heroFallback: {
    backgroundColor: "#2A2620",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  heroFallbackName: {
    color: "#F7F2E8",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  galleryLabel: {
    color: "rgba(247,242,232,0.55)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    marginTop: 12,
  },
  welcomeTitle: {
    color: "#F7F2E8",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24,
    marginTop: 8,
    marginBottom: 4,
  },
  hotelGalleryRow: {
    gap: 8,
    paddingVertical: 10,
  },
  hotelGalleryImage: {
    width: 140,
    height: 96,
    borderRadius: 12,
    backgroundColor: "#2A2620",
  },
  welcomeLine: {
    color: "rgba(247,242,232,0.72)",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4,
  },
  sectionLead: {
    color: "rgba(247,242,232,0.55)",
    fontSize: 12,
    lineHeight: 17,
    marginTop: -6,
    marginBottom: 10,
  },
  illustrationPill: {
    position: "absolute",
    right: 8,
    bottom: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  kindPill: {
    position: "absolute",
    left: 8,
    top: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  kindPillText: {
    color: "#F0D7A0",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  nextJourneyRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  nextJourneyCard: {
    flexGrow: 1,
    flexBasis: 160,
    backgroundColor: "#1A1814",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(240,215,160,0.14)",
  },
  nextJourneyKicker: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "rgba(240,215,160,0.85)",
  },
  nextJourneyTitle: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: "800",
    color: "#F7F2E8",
  },
  nextJourneyDetail: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: "rgba(247,242,232,0.6)",
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
    borderRadius: 24,
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
