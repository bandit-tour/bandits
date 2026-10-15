import { Image as ExpoImage } from "expo-image";
import { useRouter, type Href } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

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
import { fetchLiveBottleStays, mapWorkspaceBottleStay } from "@/lib/guest-workspace/liveBottle";
import { isBottlePrimaryMoment } from "@/lib/guest-lifecycle/access";
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
        <View style={[styles.heroFrame, width >= 360 && styles.heroFrameMin]}>
          {second.imageUrl && /^https?:\/\//i.test(second.imageUrl) ? (
            <ExpoImage
              source={{ uri: second.imageUrl }}
              style={styles.heroImage}
              contentFit="cover"
              transition={200}
              priority="high"
            />
          ) : (
            <View style={[styles.heroImage, { backgroundColor: "#2A241C", alignItems: "center", justifyContent: "center" }]}>
              <Text style={{ color: "#C4B8A0", fontWeight: "700", fontSize: 13 }}>Photo pending</Text>
            </View>
          )}
        </View>

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
            {match.travelTime} {fromHotel} · {nightLabel(second.nights)} · {match.priceLabel}
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
        >
          <Text style={styles.ctaPrimaryText}>{match.cta}</Text>
        </Pressable>
        <Pressable
          style={styles.ctaSecondary}
          onPress={onCheckAvailability}
          accessibilityRole="button"
          accessibilityLabel={match.availabilityCta}
        >
          <Text style={styles.ctaSecondaryText}>{match.availabilityCta}</Text>
        </Pressable>
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

  const {
    state: lifeState,
    isFullStay,
    activeStay,
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
  const [liveMatches, setLiveMatches] = useState<BottleMatch[] | null>(null);

  const bottleOk = canUseTravelBottle(lifeState);
  const bottlePrimary = isBottlePrimaryMoment(lifeState);
  const preTrip = lifeState === "PRE_TRIP" || lifeState === "NEXT_TRIP_PLANNING";
  const checkedIn = isFullStay;

  React.useEffect(() => {
    void (async () => {
      const entry = await getHotelEntry();
      const slug = activeStay?.hotelSlug ?? entry?.slug ?? "";
      if (slug) {
        const local = getHotelWhiteLabelOrDefault(slug);
        if (activeStay?.hotelName) {
          setHotel({ ...local, displayName: activeStay.hotelName, menuLocationLine: activeStay.hotelName });
        } else {
          setHotel(local);
        }
      }
      if (slug === "nyx-athens" || slug === "aluma-athens" || slug === "play-theatrou") {
        setPlanHotelId(slug as typeof planHotelId);
      }
    })();
  }, [activeStay?.hotelSlug]);

  const planHotel =
    BOTTLE_PLAN_HOTELS.find((h) => h.id === planHotelId) ?? BOTTLE_PLAN_HOTELS[0];
  const planDate =
    BOTTLE_PLAN_DATES.find((d) => d.id === planDateId) ?? BOTTLE_PLAN_DATES[1];
  const hotelName = checkedIn
    ? (activeStay?.hotelName || hotel?.displayName || planHotel.name)
    : (activeStay?.hotelName || hotel?.displayName || planHotel.name);
  const hotelHero = hotel?.introHeroSource;
  const hotelNights = planDate.hotelNights;

  React.useEffect(() => {
    void (async () => {
      const rows = await fetchLiveBottleStays();
      setLiveMatches(
        rows
          .map((r) => mapWorkspaceBottleStay(r, hotelName))
          .filter((m): m is BottleMatch => Boolean(m)),
      );
    })();
  }, [hotelName]);

  const matches = useMemo(() => {
    const source = liveMatches && liveMatches.length ? liveMatches : [];
    return source.map((m) => withPlannedHotelNights(withLiveHotelName(m, hotelName), hotelNights));
  }, [liveMatches, hotelName, hotelNights]);

  const filtered = useMemo(() => {
    if (!activeFilter) return matches;
    return matches.filter((m) => m.filterTags.includes(activeFilter));
  }, [matches, activeFilter]);

  const openMatch = (id: string) => {
    router.push(`/journey/${id}` as Href);
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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.intro}>
        <Text style={styles.kicker}>Travel in a Bottle</Text>
        <Text style={styles.title}>
          {bottlePrimary
            ? "Plan your next journey"
            : "A later trip — not tonight"}
        </Text>
        <Text style={styles.lead}>
          {bottlePrimary
            ? "Mix your sleeping experience — hotel nights + a second place to sleep (treehouse, vineyard, glamping, lodge, boat)."
            : checkedIn
              ? "During this hotel stay, Bottle stays in the background. After checkout it becomes the place to plan a second sleep."
              : "Build one paired journey: hotel + a second sleeping stay."}
        </Text>
      </View>

      {/* Pre-trip planning — works before check-in */}
      <View style={styles.planPanel}>
        <Text style={styles.planKicker}>Plan your trip</Text>
        <Text style={styles.planLead}>
          Choose a city and hotel, set dates, then add a second stay — before you leave home or
          during your trip.
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
      </View>

      {/* Your hotel — context when known / selected (supports pre-trip too) */}
      <View style={styles.yourHotel}>
        <Text style={styles.yahKicker}>
          {checkedIn ? "Your hotel" : preTrip ? "Pre-trip · your hotel" : "Starting hotel"}
        </Text>
        <View style={styles.yahRow}>
          {hotelHero && planHotelId === (hotel?.slug ?? "play-theatrou") ? (
            <Image source={hotelHero} style={styles.yahImage} resizeMode="cover" />
          ) : (
            <View style={[styles.yahImage, styles.yahImageFallback]}>
              <Text style={styles.yahFallbackEmoji}>🏨</Text>
            </View>
          )}
          <View style={styles.yahBody}>
            <Text style={styles.yahName}>{hotelName}</Text>
            <Text style={styles.yahMeta}>
              {planCity} · {nightLabel(hotelNights)} · then add a second stay
            </Text>
            <Text style={styles.yahHint}>
              {checkedIn
                ? "Matched for your stay — pair it with somewhere extraordinary."
                : "Planning from home? Pick hotel + dates, then combine stays into one journey."}
            </Text>
          </View>
        </View>
      </View>

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
        {BOTTLE_FILTER_CHIPS.map((chip) => {
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

      <Text style={styles.section}>Paired journeys</Text>
      <Text style={styles.sectionSub}>
        Hotel + second stay as one curated trip. Add a second place to sleep — not outdoor
        browse.
      </Text>

      {filtered.length === 0 ? (
        <Text style={styles.empty}>
          {liveMatches === null
            ? "Finding sleeping stays published by hosts…"
            : "No published sleeping stays yet — hosts go live after verification."}
        </Text>
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

  yourHotel: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: "#181818",
    borderRadius: 18,
    overflow: "hidden",
  },
  yahKicker: {
    paddingHorizontal: 14,
    paddingTop: 12,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#C9A227",
  },
  yahRow: { flexDirection: "row", padding: 12, gap: 12 },
  yahImage: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: "#2A241C",
    alignItems: "center",
    justifyContent: "center",
  },
  yahImageFallback: { backgroundColor: "#3A3228" },
  yahFallbackEmoji: { fontSize: 28 },
  yahBody: { flex: 1, justifyContent: "center" },
  yahName: { fontSize: 18, fontWeight: "800", color: "#FFF" },
  yahMeta: {
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    marginTop: 4,
  },
  yahHint: {
    fontSize: 11,
    color: "rgba(255,255,255,0.65)",
    marginTop: 8,
    lineHeight: 15,
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
    backgroundColor: "#1A1510",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: "hidden",
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
