import { Image as ExpoImage } from "expo-image";
import { Stack, useRouter, type Href } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { TravelBottleMixLoading } from "@/components/TravelBottleMixLoading";
import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import {
  BOTTLE_FILTER_CHIPS,
  BOTTLE_PLAN_CITIES,
  BOTTLE_PLAN_DATES,
  BOTTLE_PLAN_HOTELS,
  journeyNightsLabel,
  withLiveHotelName,
  withPlannedHotelNights,
  type BottleMatch,
} from "@/lib/guest-workspace/productWorlds";
import { loadBottleCatalog, type BottleCatalogMode } from "@/lib/guest-workspace/liveBottle";
import {
  loadHotelBottleListing,
  type HotelBottleListing,
} from "@/lib/guest-workspace/hotelBottleListing";
import { getHotelWhiteLabelOrDefault, type HotelWhiteLabelConfig } from "@/lib/hotelWhiteLabel";
import { getHotelEntry } from "@/lib/pilotSession";
import { useGuestLifecycle } from "@/lib/guest-lifecycle/useGuestLifecycle";
import { canUseTravelBottle } from "@/lib/guest-lifecycle/access";

function nightLabel(n: number) {
  return `${n} night${n === 1 ? "" : "s"}`;
}

type LayoutMode = "mobile" | "tablet" | "desktop";

function layoutModeFor(width: number): LayoutMode {
  if (width >= 1024) return "desktop";
  if (width >= 700) return "tablet";
  return "mobile";
}

function cardWidthFor(width: number, mode: LayoutMode): number {
  if (mode === "mobile") return Math.min(width * 0.88, 400);
  if (mode === "tablet") {
    const gap = 14;
    const pad = 32;
    return Math.min(420, (width - pad - gap) / 2);
  }
  // Desktop: 3 per row, ~30–33% width
  const gap = 16;
  const pad = 32;
  const raw = (width - pad - gap * 2) / 3;
  return Math.max(280, Math.min(400, raw));
}

/** Workspace-backed cabin hero — never invent stock; onError drops broken URI. */
function BottleHero({ imageUrl, wide }: { imageUrl?: string | null; wide?: boolean }) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    setFailed(false);
  }, [imageUrl]);
  const ok = Boolean(imageUrl && /^https?:\/\//i.test(imageUrl) && !failed);
  return (
    <View style={[styles.heroFrame, wide && styles.heroFrameMin]}>
      {ok ? (
        <ExpoImage
          source={{ uri: imageUrl! }}
          style={styles.heroImage}
          contentFit="cover"
          transition={200}
          priority="high"
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={[styles.heroImage, styles.heroPending]}>
          <Text style={styles.heroPendingText}>Photo pending from hotel partner</Text>
        </View>
      )}
    </View>
  );
}

/**
 * Paired journey card — hotel + second stay as one curated trip.
 * Second-stay photo is a premium 4:3 accommodation hero (never a thin banner).
 */
function JourneyMatchCard({
  match,
  width,
  onViewJourney,
  onCheckAvailability,
}: {
  match: BottleMatch;
  width: number;
  onViewJourney: () => void;
  onCheckAvailability: () => void;
}) {
  const second = match.second;
  const attrs = second.attributes ?? [];
  const fromHotel = `from ${match.hotel.name}`;

  return (
    <View style={[styles.card, { width }]}>
      <Pressable
        onPress={onViewJourney}
        accessibilityRole="button"
        accessibilityLabel={`${second.name}. ${journeyNightsLabel(match)}. ${match.cta}`}
        style={({ pressed }) => pressed && styles.cardPressed}
      >
        <BottleHero imageUrl={second.imageUrl} wide={width >= 360} />

        <View style={styles.cardBody}>
          <Text style={styles.stayType} numberOfLines={1}>
            {second.type ?? "Second stay"}
          </Text>
          <Text style={styles.stayName} numberOfLines={2}>
            {second.name}
          </Text>
          <Text style={styles.stayLoc} numberOfLines={1}>
            {second.location}
            {second.rating != null ? ` · ★ ${second.rating.toFixed(2)}` : ""}
          </Text>
          <Text style={styles.stayMeta} numberOfLines={2}>
            {match.travelTime} {fromHotel} · {nightLabel(second.nights)} ·{" "}
            {match.inventorySource === "sample" ? "Sample price · not a live rate" : match.priceLabel}
          </Text>

          {attrs.length > 0 ? (
            <View style={styles.attrChips}>
              {attrs.slice(0, 4).map((a) => (
                <View key={a} style={styles.attrChip}>
                  <Text style={styles.attrChipText}>{a}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Visual pairing — one journey */}
          <View style={styles.pairing}>
            <Text style={styles.pairHotel} numberOfLines={1}>
              {match.hotel.name}
            </Text>
            <Text style={styles.pairMeta}>
              {nightLabel(match.hotel.nights)} · {match.hotel.city ?? "Athens"}
            </Text>
            <Text style={styles.pairArrow}>↓</Text>
            <Text style={styles.pairSecond} numberOfLines={1}>
              {second.name}
            </Text>
            <Text style={styles.pairMeta}>
              {nightLabel(second.nights)} · {second.location}
            </Text>
            <Text style={styles.journeyTotal}>{journeyNightsLabel(match)}</Text>
          </View>
        </View>
      </Pressable>

      <View style={styles.ctaRow}>
        <Pressable
          style={styles.ctaPrimary}
          onPress={onViewJourney}
          accessibilityRole="button"
          accessibilityLabel={match.cta}
          testID="bottle-view-journey"
        >
          <Text style={styles.ctaPrimaryText}>{match.cta}</Text>
        </Pressable>
        <Pressable
          style={styles.ctaSecondary}
          onPress={onCheckAvailability}
          accessibilityRole="button"
          accessibilityLabel={match.availabilityCta}
          testID="bottle-check-availability"
        >
          <Text style={styles.ctaSecondaryText}>{match.availabilityCta}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const HOTEL_SERVICE_TAGS = ["Breakfast", "Restaurant", "Spa", "Rooftop", "Concierge"];

function isInventedWelcome(text: string): boolean {
  return /message in a bottle|calm, personal|soft welcome before you/i.test(text);
}

function HotelStayPresentation({
  listing,
  fallbackName,
  city,
  nightsLabel,
  datesLabel,
  onViewHotel,
  onHotelServices,
  onContactHotel,
}: {
  listing: HotelBottleListing | null;
  fallbackName: string;
  city: string;
  nightsLabel: string;
  datesLabel: string;
  onViewHotel: () => void;
  onHotelServices: () => void;
  onContactHotel: () => void;
}) {
  const name = listing?.whiteLabel?.title || listing?.displayName || fallbackName;
  const area = listing?.location || city;
  const rawSummary = String(listing?.description || "").trim();
  const usableSummary =
    rawSummary.length > 80 && !isInventedWelcome(rawSummary) && !/^welcome to\b/i.test(rawSummary)
      ? rawSummary
      : "";
  const guestSummary =
    usableSummary ||
    `${name} is your hotel stay in ${area}. Bottle adds a second place to sleep around this stay — it does not replace the hotel.`;
  const tags = (listing?.services?.length ? listing.services : HOTEL_SERVICE_TAGS).slice(0, 6);
  const remote = listing?.remoteGalleryUrls || [];
  const local = listing?.localGallery || [];
  const photoCount = remote.length + local.length;

  return (
    <View style={styles.hotelCard} testID="bottle-hotel-panel">
      <Text style={styles.hotelKicker}>Current hotel stay</Text>
      {remote[0] ? (
        <ExpoImage
          source={{ uri: remote[0] }}
          style={styles.hotelHero}
          contentFit="cover"
          testID="bottle-hotel-hero"
        />
      ) : local[0] ? (
        <Image source={local[0]} style={styles.hotelHero} resizeMode="cover" testID="bottle-hotel-hero" />
      ) : (
        <View style={[styles.hotelHero, styles.hotelHeroEmpty]} testID="bottle-hotel-hero">
          <Text style={styles.hotelHeroEmptyText}>{name}</Text>
          <Text style={styles.hotelHeroEmptySub}>Property photos publish from the hotel</Text>
        </View>
      )}
      {photoCount > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hotelGalleryRow}
        >
          {remote.slice(remote[0] ? 1 : 0).map((uri) => (
            <ExpoImage key={uri} source={{ uri }} style={styles.hotelGalleryImage} contentFit="cover" />
          ))}
          {local.slice(remote[0] ? 0 : 1).map((src, idx) => (
            <Image key={`loc-${idx}`} source={src} style={styles.hotelGalleryImage} resizeMode="cover" />
          ))}
        </ScrollView>
      ) : null}
      <View style={styles.hotelBody}>
        <Text style={styles.hotelName} testID="bottle-hotel-name">
          {name}
        </Text>
        <Text style={styles.hotelMeta}>
          {area} · {/night/i.test(datesLabel) ? datesLabel : `${nightsLabel} · ${datesLabel}`}
        </Text>
        <Text style={styles.hotelSummary}>{guestSummary}</Text>
        <View style={styles.attrChips}>
          {tags.map((s) => (
            <View key={s} style={styles.attrChip}>
              <Text style={styles.attrChipText}>{s}</Text>
            </View>
          ))}
        </View>
        {photoCount < 4 ? (
          <Text style={styles.hotelGapNote}>
            {photoCount === 0
              ? "No property photos published yet. This block will not borrow another hotel’s images."
              : `${photoCount} property photo${photoCount === 1 ? "" : "s"} from this hotel. A fuller gallery appears when more are uploaded.`}
          </Text>
        ) : null}
        <View style={styles.hotelCtas}>
          <Pressable style={styles.hotelCta} onPress={onViewHotel} accessibilityRole="button" testID="bottle-view-hotel">
            <Text style={styles.hotelCtaText}>View hotel</Text>
          </Pressable>
          <Pressable
            style={styles.hotelCta}
            onPress={onHotelServices}
            accessibilityRole="button"
            testID="bottle-hotel-services"
          >
            <Text style={styles.hotelCtaText}>Hotel services</Text>
          </Pressable>
          <Pressable
            style={styles.hotelCtaGhost}
            onPress={onContactHotel}
            accessibilityRole="button"
            testID="bottle-contact-hotel"
          >
            <Text style={styles.hotelCtaGhostText}>Contact hotel</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** Travel in a Bottle — trip planning: hotel + second stay = one curated journey. */
export function BottleProductScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const mode = layoutModeFor(width);
  const cardW = cardWidthFor(width, mode);
  const screenOptions = useAppBackScreenOptions({
    title: "Travel in a Bottle",
    fallback: "/menu",
    showBack: true,
    escapeShortcuts: true,
  });

  const {
    state: lifeState,
    activeStay,
    snap,
    loading: lifeLoading,
  } = useGuestLifecycle();

  const [hotel, setHotel] = useState<HotelWhiteLabelConfig | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [planCity, setPlanCity] = useState<(typeof BOTTLE_PLAN_CITIES)[number]>("Athens");
  const [planHotelId, setPlanHotelId] = useState<(typeof BOTTLE_PLAN_HOTELS)[number]["id"]>(
    "play-theatrou",
  );
  const [planDateId, setPlanDateId] = useState<(typeof BOTTLE_PLAN_DATES)[number]["id"]>(
    "next-week",
  );
  const [availabilityFlash, setAvailabilityFlash] = useState<string | null>(null);
  const [catalogMatches, setCatalogMatches] = useState<BottleMatch[] | null>(null);
  const [catalogMode, setCatalogMode] = useState<BottleCatalogMode | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [mixing, setMixing] = useState(false);
  const [hotelListing, setHotelListing] = useState<HotelBottleListing | null>(null);
  const mixGenRef = React.useRef(0);

  const bottleOk = canUseTravelBottle(lifeState);

  React.useEffect(() => {
    void (async () => {
      const entry = await getHotelEntry();
      const rememberedStay =
        activeStay || snap?.stays?.find((s) => s.hotelSlug || s.hotelName) || null;
      const slug = rememberedStay?.hotelSlug || entry?.slug || "";
      if (slug) {
        const local = getHotelWhiteLabelOrDefault(slug);
        if (rememberedStay?.hotelName) {
          setHotel({ ...local, displayName: rememberedStay.hotelName, menuLocationLine: rememberedStay.hotelName });
        } else {
          setHotel(local);
        }
      }
      if (slug === "nyx-athens" || slug === "aluma-athens" || slug === "play-theatrou") {
        setPlanHotelId(slug as typeof planHotelId);
      }
    })();
  }, [activeStay?.hotelSlug, activeStay?.hotelName, snap?.stays]);

  const planHotel =
    BOTTLE_PLAN_HOTELS.find((h) => h.id === planHotelId) ?? BOTTLE_PLAN_HOTELS[0];
  const planDate =
    BOTTLE_PLAN_DATES.find((d) => d.id === planDateId) ?? BOTTLE_PLAN_DATES[1];
  const hotelName = activeStay?.hotelName || hotel?.displayName || planHotel.name;
  const hotelNights = planDate.hotelNights;

  /**
   * Real Workspace catalog load — drives the ocean-bottle loading transition.
   * No artificial delay: overlay dismisses when the request settles.
   */
  const mixSleepingExperiences = useCallback(
    async (name: string) => {
      const gen = ++mixGenRef.current;
      setMixing(true);
      setCatalogError(null);
      try {
        const [result] = await Promise.all([
          loadBottleCatalog(name),
          loadHotelBottleListing(planHotelId).then((listing) => {
            if (gen === mixGenRef.current) setHotelListing(listing);
          }),
        ]);
        if (gen !== mixGenRef.current) return;
        setCatalogMatches(result.matches);
        setCatalogMode(result.mode);
        setCatalogError(result.error ? String(result.error) : null);
      } catch (e) {
        if (gen !== mixGenRef.current) return;
        setCatalogMatches([]);
        setCatalogMode(null);
        setCatalogError(e instanceof Error ? e.message : "Could not mix sleeping stays.");
      } finally {
        if (gen === mixGenRef.current) setMixing(false);
      }
    },
    [planHotelId],
  );

  React.useEffect(() => {
    void mixSleepingExperiences(hotelName);
  }, [hotelName, mixSleepingExperiences]);

  const matches = useMemo(() => {
    const source = catalogMatches ?? [];
    return source.map((m) => withPlannedHotelNights(withLiveHotelName(m, hotelName), hotelNights));
  }, [catalogMatches, hotelName, hotelNights]);

  const showingSample = catalogMode === "sample";
  const filterChips = useMemo(() => {
    if (!showingSample && matches.length) {
      const present = new Set<string>();
      for (const m of matches) for (const t of m.filterTags) present.add(t);
      const liveChips = BOTTLE_FILTER_CHIPS.filter((c) => present.has(c));
      return liveChips.length ? liveChips : BOTTLE_FILTER_CHIPS;
    }
    return BOTTLE_FILTER_CHIPS;
  }, [matches, showingSample]);

  const filtered = useMemo(() => {
    if (!activeFilter) return matches;
    return matches.filter((m) => m.filterTags.includes(activeFilter));
  }, [matches, activeFilter]);

  const openMatch = (id: string) => {
    router.push(
      `/journey/${id}?hotelNights=${hotelNights}&hotelSlug=${encodeURIComponent(planHotelId)}&planDate=${encodeURIComponent(planDateId)}` as Href,
    );
  };

  const checkAvailability = (id: string) => {
    setAvailabilityFlash(id);
    setTimeout(() => setAvailabilityFlash((cur) => (cur === id ? null : cur)), 2200);
  };

  const cards = filtered.map((match: BottleMatch) => (
    <View key={match.id} style={styles.cardSlot}>
      <JourneyMatchCard
        match={match}
        width={cardW}
        onViewJourney={() => openMatch(match.id)}
        onCheckAvailability={() => {
          checkAvailability(match.id);
          openMatch(match.id);
        }}
      />
      {availabilityFlash === match.id ? (
        <Text style={styles.flashHint}>Checking availability for this journey…</Text>
      ) : null}
    </View>
  ));

  if (!lifeLoading && !bottleOk) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text style={styles.kicker}>Travel in a Bottle</Text>
          <Text style={styles.title}>Trip builder paused</Text>
          <Text style={styles.lead}>
            Bottle planning is for mixing sleeping stays after your hotel trip. Current stay mode: {lifeState}.
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={screenOptions} />
      <TravelBottleMixLoading
        visible={mixing}
        statusHint="Mixing hotel and nature stays from Workspace."
      />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.intro}>
        <Text style={styles.kicker}>Travel in a Bottle</Text>
        <Text style={styles.title}>Two sleeps, one journey</Text>
        <Text style={styles.lead}>
          First sleep is your hotel stay. Second sleep is a different place to stay — sea, mountain,
          vineyard, nature — paired with that hotel. This is not hotel messaging, a social bottle, or
          an experiences marketplace.
        </Text>
      </View>

      {/* A — current hotel stay */}
      <HotelStayPresentation
        listing={hotelListing}
        fallbackName={hotelName}
        city={planCity}
        nightsLabel={nightLabel(hotelNights)}
        datesLabel={planDate.label}
        onViewHotel={() => router.push("/hotelier" as Href)}
        onHotelServices={() => router.push("/hotelier" as Href)}
        onContactHotel={() => router.push("/hotelier/askHotel" as Href)}
      />

      {/* B — plan the second stay */}
      <View style={styles.planPanel} testID="bottle-second-stay">
        <Text style={styles.planKicker}>Plan your second stay</Text>
        <Text style={styles.planLead}>
          {`You're staying at ${hotelListing?.whiteLabel?.title || hotelListing?.displayName || hotelName} in ${hotelListing?.location || planCity}. Now add a second sleep experience — sea, mountain, vineyard, nature, remote work, romance.`}
        </Text>

        <Text style={styles.planLabel}>City</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.planChips}
        >
          {BOTTLE_PLAN_CITIES.map((city) => {
            const on = planCity === city;
            return (
              <Pressable
                key={city}
                style={[styles.planChip, on && styles.planChipOn]}
                onPress={() => setPlanCity(city)}
              >
                <Text style={[styles.planChipText, on && styles.planChipTextOn]}>{city}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.planLabel}>Hotel</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.planChips}
        >
          {BOTTLE_PLAN_HOTELS.map((h) => {
            const on = planHotelId === h.id;
            return (
              <Pressable
                key={h.id}
                style={[styles.planChip, on && styles.planChipOn]}
                onPress={() => setPlanHotelId(h.id)}
              >
                <Text style={[styles.planChipText, on && styles.planChipTextOn]}>{h.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.planLabel}>Dates</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.planChips}
        >
          {BOTTLE_PLAN_DATES.map((d) => {
            const on = planDateId === d.id;
            return (
              <Pressable
                key={d.id}
                style={[styles.planChip, on && styles.planChipOn]}
                onPress={() => setPlanDateId(d.id)}
              >
                <Text style={[styles.planChipText, on && styles.planChipTextOn]}>{d.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable
          style={[styles.mixCta, mixing && styles.mixCtaDisabled]}
          disabled={mixing}
          onPress={() => void mixSleepingExperiences(hotelName)}
          accessibilityRole="button"
          accessibilityLabel="Mix sleeping experiences"
          testID="travel-bottle-mix-cta"
        >
          <Text style={styles.mixCtaText}>
            {mixing ? "Mixing stays…" : "Mix sleeping experiences"}
          </Text>
          <Text style={styles.mixCtaSub}>
            Hotel + nature stay · real Workspace search
          </Text>
        </Pressable>
      </View>

      {catalogError ? (
        <View style={styles.errorBanner} testID="bottle-catalog-error">
          <Text style={styles.errorBannerTitle}>Couldn’t reach Workspace</Text>
          <Text style={styles.errorBannerBody}>{catalogError}</Text>
          <Pressable
            style={styles.retryBtn}
            disabled={mixing}
            onPress={() => void mixSleepingExperiences(hotelName)}
            accessibilityRole="button"
            accessibilityLabel="Retry mixing sleeping experiences"
          >
            <Text style={styles.retryBtnText}>Retry mix</Text>
          </Pressable>
        </View>
      ) : null}

      {showingSample && !catalogError ? (
        <View style={styles.sampleBanner} testID="bottle-sample-banner">
          <Text style={styles.sampleBannerTitle}>Sample paired journeys</Text>
          <Text style={styles.sampleBannerBody}>
            Sample preview only. Prices and “open” wording on these cards are not live rates or
            bookable dates. Check availability confirms there is nothing to reserve.
          </Text>
        </View>
      ) : null}

      {/* Filters — second overnight / journey type */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        <Pressable
          style={[styles.chip, !activeFilter && styles.chipOn]}
          onPress={() => setActiveFilter(null)}
        >
          <Text style={[styles.chipText, !activeFilter && styles.chipTextOn]}>All</Text>
        </Pressable>
        {filterChips.map((chip) => {
          const on = activeFilter === chip;
          return (
            <Pressable
              key={chip}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => setActiveFilter(on ? null : chip)}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{chip}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.section} testID="bottle-paired-journeys">
        {showingSample ? "Sample paired journeys" : "Paired journeys"}
      </Text>
      <Text style={styles.sectionSub}>
        {showingSample
          ? "Each card is a sample second sleep. Prices shown as sample are not inventory."
          : "Each card is a second sleep paired with your hotel."}
      </Text>

      {filtered.length === 0 && !mixing ? (
        <View style={styles.emptyBlock} testID="bottle-catalog-empty">
          <Text style={styles.empty}>
            {catalogError
              ? "No journeys to show until Workspace responds."
              : catalogMatches === null
                ? "Choose your plan, then mix sleeping experiences."
                : activeFilter
                  ? `No journeys tagged “${activeFilter}” in this catalog.`
                  : "No sleeping stays available for this mix."}
          </Text>
          {!catalogError ? (
            <Pressable
              style={styles.retryBtn}
              onPress={() => void mixSleepingExperiences(hotelName)}
              accessibilityRole="button"
              accessibilityLabel="Mix sleeping experiences again"
            >
              <Text style={styles.retryBtnText}>Mix again</Text>
            </Pressable>
          ) : null}
        </View>
      ) : filtered.length === 0 ? (
        <Text style={styles.empty}>Mixing your perfect stays…</Text>
      ) : mode === "mobile" ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={cardW + 12}
          contentContainerStyle={styles.mobileRail}
        >
          {cards}
        </ScrollView>
      ) : (
        <View
          style={[
            styles.grid,
            mode === "desktop" && styles.gridDesktop,
            mode === "tablet" && styles.gridTablet,
          ]}
        >
          {cards}
        </View>
      )}
      </ScrollView>
    </View>
  );
}

export default function TravelBottleRoute() {
  React.useEffect(() => {
    void import("@/lib/analytics").then(({ trackEvent }) =>
      trackEvent({ eventName: "bottle_planning_opened" }),
    );
  }, []);
  return <BottleProductScreen />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FAF9F7" },
  content: { paddingBottom: 48 },
  intro: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  kicker: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#E03131",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#111111",
    marginTop: 6,
    lineHeight: 32,
  },
  lead: {
    fontSize: 14,
    color: "#6B6B6B",
    marginTop: 8,
    lineHeight: 21,
  },

  planPanel: {
    marginHorizontal: 16,
    marginTop: 4,
    padding: 14,
    backgroundColor: "#FFF",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5DFD6",
  },
  planKicker: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#E03131",
  },
  planLead: {
    fontSize: 13,
    color: "#5A534A",
    marginTop: 6,
    lineHeight: 18,
    marginBottom: 4,
  },
  planLabel: {
    marginTop: 12,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: "#6B645A",
  },
  planChips: { gap: 8, paddingRight: 8 },
  planChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#F7F5F1",
    borderWidth: 1,
    borderColor: "#E0D8CC",
  },
  planChipOn: {
    backgroundColor: "#1A1510",
    borderColor: "#1A1510",
  },
  planChipText: { fontSize: 12, fontWeight: "600", color: "#5A534A" },
  planChipTextOn: { color: "#FFFFFF", fontWeight: "800" },
  mixCta: {
    marginTop: 16,
    backgroundColor: "#E03131",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  mixCtaDisabled: { opacity: 0.7 },
  mixCtaText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  mixCtaSub: {
    marginTop: 4,
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "600",
  },

  hotelCard: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5DFD6",
  },
  hotelKicker: {
    paddingHorizontal: 16,
    paddingTop: 14,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#8B6914",
  },
  hotelHero: {
    width: "100%",
    height: 240,
    marginTop: 12,
    backgroundColor: "#2A241C",
  },
  hotelHeroEmpty: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  hotelHeroEmptyText: {
    color: "#F7F2E8",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  hotelHeroEmptySub: {
    marginTop: 6,
    color: "#C4B8A0",
    fontSize: 13,
    textAlign: "center",
  },
  hotelGalleryRow: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 10,
  },
  hotelGalleryImage: {
    width: 220,
    height: 148,
    borderRadius: 14,
    backgroundColor: "#2A241C",
  },
  hotelBody: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 },
  hotelName: { fontSize: 26, fontWeight: "800", color: "#1A1510", lineHeight: 32 },
  hotelMeta: {
    fontSize: 14,
    color: "#5A534A",
    marginTop: 6,
    fontWeight: "600",
  },
  hotelSummary: {
    fontSize: 15,
    color: "#3A342C",
    marginTop: 10,
    lineHeight: 22,
  },
  hotelGapNote: {
    marginTop: 10,
    fontSize: 12,
    color: "#6B645A",
    lineHeight: 17,
  },
  hotelCtas: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  hotelCta: {
    backgroundColor: "#1A1510",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  hotelCtaText: { color: "#FFFFFF", fontWeight: "800", fontSize: 13 },
  hotelCtaGhost: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E0D8CC",
  },
  hotelCtaGhostText: { color: "#1A1510", fontWeight: "700", fontSize: 13 },
  sampleBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#F3EFE8",
    borderWidth: 1,
    borderColor: "#E0D8CC",
  },
  sampleBannerTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#8B6914",
  },
  sampleBannerBody: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: "#3A342C",
  },
  errorBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#FFF5F5",
    borderWidth: 1,
    borderColor: "#F0C2C2",
  },
  errorBannerTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#B42318",
  },
  errorBannerBody: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: "#5A534A",
  },
  retryBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: "#1A1510",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  retryBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 13 },
  emptyBlock: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingBottom: 8,
  },

  chipsRow: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E0D8CC",
  },
  chipOn: {
    backgroundColor: "#1A1510",
    borderColor: "#1A1510",
  },
  chipText: { fontSize: 12, fontWeight: "600", color: "#5A534A" },
  chipTextOn: { color: "#FFFFFF", fontWeight: "800" },

  section: {
    marginTop: 18,
    marginHorizontal: 16,
    fontSize: 16,
    fontWeight: "800",
    color: "#111111",
  },
  sectionSub: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    fontSize: 12,
    color: "#6B645A",
    lineHeight: 17,
  },
  empty: {
    marginHorizontal: 16,
    color: "#6B645A",
    fontSize: 14,
  },

  mobileRail: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 8,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 14,
  },
  gridTablet: {},
  gridDesktop: {
    gap: 16,
  },
  cardSlot: {
    marginBottom: 4,
  },

  card: {
    backgroundColor: "#FFF",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5DFD6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
    maxWidth: 420,
  },
  cardPressed: { opacity: 0.94 },

  /** Premium 4:3 accommodation hero — never a thin panoramic strip */
  heroFrame: {
    width: "100%",
    aspectRatio: 4 / 3,
    backgroundColor: "#2A241C",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: "hidden",
  },
  heroPending: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: "#2A241C",
  },
  heroPendingText: {
    color: "#C4B8A0",
    fontWeight: "700",
    fontSize: 13,
    textAlign: "center",
  },
  heroFrameMin: {
    minHeight: 280,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },

  cardBody: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  stayType: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#C9A227",
  },
  stayName: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1510",
    lineHeight: 22,
  },
  stayLoc: {
    marginTop: 4,
    fontSize: 13,
    color: "#5A534A",
    fontWeight: "600",
  },
  stayMeta: {
    marginTop: 6,
    fontSize: 13,
    color: "#3A342C",
    lineHeight: 18,
  },
  attrs: {
    marginTop: 8,
    fontSize: 12,
    color: "#6B645A",
    lineHeight: 17,
  },
  attrChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  attrChip: {
    backgroundColor: "#F3EFE8",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 980,
  },
  attrChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#3A3630",
  },

  pairing: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5DFD6",
  },
  pairHotel: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1A1510",
  },
  pairSecond: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1A1510",
  },
  pairMeta: {
    fontSize: 12,
    color: "#6B645A",
    marginTop: 2,
  },
  pairArrow: {
    fontSize: 16,
    fontWeight: "800",
    color: "#C9A227",
    marginVertical: 4,
  },
  journeyTotal: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: "800",
    color: "#C9A227",
    letterSpacing: 0.2,
  },

  ctaRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
  },
  ctaPrimary: {
    flex: 1,
    backgroundColor: "#E03131",
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
  ctaPrimaryText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  ctaSecondary: {
    flex: 1,
    backgroundColor: "#181818",
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
  ctaSecondaryText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  flashHint: {
    marginTop: 6,
    fontSize: 11,
    color: "#C9A227",
    fontWeight: "600",
  },
});
