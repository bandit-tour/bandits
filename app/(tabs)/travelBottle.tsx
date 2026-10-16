import { Image as ExpoImage } from "expo-image";
import { Stack, useRouter, type Href } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { BottleDateRangeField, humanDate } from "@/components/BottleDateRangeField";
import { TravelBottleMixLoading } from "@/components/TravelBottleMixLoading";
import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import {
  journeyNightsLabel,
  withLiveHotelName,
  withPlannedHotelNights,
  BOTTLE_PLAN_CITIES,
  type BottleMatch,
} from "@/lib/guest-workspace/productWorlds";
import { loadBottleCatalog, searchMixedSleeps, type BottleCatalogMode } from "@/lib/guest-workspace/liveBottle";
import {
  type HotelBottleListing,
} from "@/lib/guest-workspace/hotelBottleListing";
import { useGuestLifecycle } from "@/lib/guest-lifecycle/useGuestLifecycle";
import { saveDreamDestination } from "@/lib/dream-destinations/store";
import { recordLifecycleNotice } from "@/lib/lifecycle/notices";
import { ensureAnonymousSession } from "@/lib/pilotSession";
import { useAppState } from "@/contexts/AppStateContext";

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

  const { getCurrentUser } = useAppState();
  const {
    activeStay,
  } = useGuestLifecycle();

  const [destination, setDestination] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [travelers, setTravelers] = useState(2);
  const [formError, setFormError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [availabilityFlash, setAvailabilityFlash] = useState<string | null>(null);
  const [catalogMatches, setCatalogMatches] = useState<BottleMatch[] | null>(null);
  const [catalogMode, setCatalogMode] = useState<BottleCatalogMode | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [mixing, setMixing] = useState(false);
  const [inspiration, setInspiration] = useState(false);
  const [notifyOk, setNotifyOk] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const mixGenRef = React.useRef(0);

  const connectedHotel = activeStay?.hotelName
    ? {
        name: activeStay.hotelName,
        slug: activeStay.hotelSlug || "",
        city: activeStay.city || "",
      }
    : null;

  const totalNights = useMemo(() => {
    const start = new Date(`${checkIn}T00:00:00`);
    const end = new Date(`${checkOut}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    const nights = Math.round((end.getTime() - start.getTime()) / 86400000);
    return nights >= 1 ? nights : null;
  }, [checkIn, checkOut]);

  const hotelNights = totalNights && totalNights >= 2 ? totalNights - 1 : 1;
  const hotelName = connectedHotel?.name || "";
  const datesReady = Boolean(checkIn && checkOut && totalNights && totalNights >= 2);
  const canMix = destination.trim().length >= 2 && datesReady && travelers >= 1 && !mixing;

  const mixSleepingExperiences = useCallback(async () => {
    const place = destination.trim();
    if (place.length < 2) {
      setFormError("Choose a destination.");
      return;
    }
    const start = new Date(`${checkIn}T00:00:00`);
    const end = new Date(`${checkOut}T00:00:00`);
    if (!checkIn || !checkOut || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setFormError("Choose a check-in and check-out date.");
      return;
    }
    if (end <= start) {
      setFormError("Check-out must be after check-in.");
      return;
    }
    if (!totalNights || totalNights < 2) {
      setFormError("Two sleeps need at least two nights.");
      return;
    }
    if (travelers < 1) {
      setFormError("Add at least one traveler.");
      return;
    }
    setFormError(null);
    setInspiration(false);
    setSaveMsg(null);
    const gen = ++mixGenRef.current;
    setMixing(true);
    setCatalogError(null);
    const videoTimer = setTimeout(() => {
      if (gen === mixGenRef.current) setShowVideo(true);
    }, 280);
    try {
      const result = await searchMixedSleeps({
        destination: place,
        checkIn,
        checkOut,
        travelers,
        hotelName: hotelName || null,
      });
      if (gen !== mixGenRef.current) return;
      setCatalogMatches(result.matches);
      setCatalogMode(result.mode);
      setCatalogError(result.error ? String(result.error) : null);
      setSearched(true);
      setActiveFilter(null);
    } catch (e) {
      if (gen !== mixGenRef.current) return;
      setCatalogMatches([]);
      setCatalogMode("live");
      setCatalogError(e instanceof Error ? e.message : "Could not mix sleeping stays.");
      setSearched(true);
    } finally {
      clearTimeout(videoTimer);
      if (gen === mixGenRef.current) {
        setShowVideo(false);
        setMixing(false);
      }
    }
  }, [checkIn, checkOut, destination, hotelName, totalNights, travelers]);

  const showInspiration = useCallback(async () => {
    setInspiration(true);
    const result = await loadBottleCatalog(hotelName || undefined);
    setCatalogMatches(result.matches);
    setCatalogMode("sample");
    setCatalogError(null);
    setSearched(true);
  }, [hotelName]);

  const saveDestination = useCallback(async () => {
    const place = destination.trim();
    if (place.length < 2) return;
    await ensureAnonymousSession().catch(() => undefined);
    const user = await getCurrentUser().catch(() => null);
    if (!user?.id) {
      setSaveMsg("Sign in to keep this destination.");
      return;
    }
    const row = await saveDreamDestination({
      userId: user.id,
      name: place,
      timing: checkIn && checkOut ? `${checkIn} → ${checkOut}` : undefined,
    });
    if (notifyOk) {
      await recordLifecycleNotice({
        id: `bottle_wait_${row.id}`,
        userId: user.id,
        notificationClass: "marketing",
        explicitConsent: true,
        title: `Availability for ${place}`,
        message: "We’ll let you know when a mixed sleeping journey opens. This is not a booking.",
        href: "/dreamDestinations",
      });
    }
    setSaveMsg(
      notifyOk
        ? `${place} saved. You’ll be notified only if a combination opens.`
        : `${place} saved. No availability alert was sent.`,
    );
  }, [checkIn, checkOut, destination, getCurrentUser, notifyOk]);

  const matches = useMemo(() => {
    const source = catalogMatches ?? [];
    return source.map((m) =>
      withPlannedHotelNights(withLiveHotelName(m, hotelName || m.hotel.name), hotelNights),
    );
  }, [catalogMatches, hotelName, hotelNights]);

  const showingSample = catalogMode === "sample";

  const filtered = useMemo(() => {
    if (!activeFilter) return matches;
    return matches.filter((m) => m.filterTags.includes(activeFilter));
  }, [matches, activeFilter]);

  const openMatch = (id: string) => {
    const slug = connectedHotel?.slug ? `&hotelSlug=${encodeURIComponent(connectedHotel.slug)}` : "&connectedStay=0";
    router.push(
      `/journey/${id}?hotelNights=${hotelNights}&checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}&travelers=${travelers}${slug}` as Href,
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

  return (
    <View style={styles.screen}>
      <Stack.Screen options={screenOptions} />
      <TravelBottleMixLoading
        visible={showVideo}
        statusHint="Mixing two sleeping experiences."
      />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.intro} testID="bottle-entry">
          <Text style={styles.kicker}>Travel in a Bottle</Text>
          <Text style={styles.title}>Two sleeps. One extraordinary trip.</Text>
        </View>

        <View style={[styles.askPanel, mode !== "mobile" && styles.askPanelRow]} testID="bottle-questions">
          <View style={styles.askField}>
            <Text style={styles.planLabel}>Where are you going?</Text>
            <TextInput
              testID="bottle-destination"
              value={destination}
              onChangeText={setDestination}
              placeholder="Destination"
              placeholderTextColor="#8A8178"
              style={styles.askInput}
            />
            <View style={styles.planChips}>
              {BOTTLE_PLAN_CITIES.map((city) => (
                <Pressable
                  key={city}
                  testID={`bottle-destination-${city.toLowerCase().replace(/\s+/g, "-")}`}
                  style={[styles.planChip, destination === city && styles.planChipOn]}
                  onPress={() => setDestination(city)}
                >
                  <Text style={[styles.planChipText, destination === city && styles.planChipTextOn]}>{city}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.askField}>
            <Text style={styles.planLabel}>When?</Text>
            <BottleDateRangeField
              checkIn={checkIn}
              checkOut={checkOut}
              onChange={(nextIn, nextOut) => {
                setCheckIn(nextIn);
                setCheckOut(nextOut);
                setFormError(null);
              }}
            />
          </View>
          <View style={styles.askField}>
            <Text style={styles.planLabel}>Who’s coming?</Text>
            <View style={styles.travelerRow}>
              <Pressable
                testID="bottle-travelers-dec"
                style={styles.travelerBtn}
                onPress={() => setTravelers((n) => Math.max(1, n - 1))}
                accessibilityRole="button"
                accessibilityLabel="Fewer travelers"
              >
                <Text style={styles.travelerBtnText}>−</Text>
              </Pressable>
              <Text testID="bottle-travelers-count" style={styles.travelerCount}>
                {travelers}
              </Text>
              <Pressable
                testID="bottle-travelers-inc"
                style={styles.travelerBtn}
                onPress={() => setTravelers((n) => Math.min(8, n + 1))}
                accessibilityRole="button"
                accessibilityLabel="More travelers"
              >
                <Text style={styles.travelerBtnText}>+</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {connectedHotel ? (
          <Text style={styles.stayHint} testID="bottle-connected-hotel">
            First sleep: {connectedHotel.name}
            {connectedHotel.city ? ` · ${connectedHotel.city}` : ""}
          </Text>
        ) : null}

        {formError ? (
          <Text style={styles.formError} testID="bottle-form-error">
            {formError}
          </Text>
        ) : null}

        <Pressable
          style={[styles.mixCta, !canMix && styles.mixCtaDisabled]}
          disabled={!canMix}
          onPress={() => void mixSleepingExperiences()}
          accessibilityRole="button"
          accessibilityLabel="Mix My Sleeping Experiences"
          testID="travel-bottle-mix-cta"
        >
          <Text style={styles.mixCtaText}>{mixing ? "Mixing…" : "Mix My Sleeping Experiences"}</Text>
        </Pressable>

        {searched && catalogError ? (
        <View style={styles.errorBanner} testID="bottle-catalog-error">
          <Text style={styles.errorBannerTitle}>Couldn’t reach Workspace</Text>
          <Text style={styles.errorBannerBody}>{catalogError}</Text>
          <Pressable
            style={styles.retryBtn}
            disabled={mixing}
            onPress={() => void mixSleepingExperiences()}
            accessibilityRole="button"
            accessibilityLabel="Retry mixing sleeping experiences"
          >
            <Text style={styles.retryBtnText}>Retry mix</Text>
          </Pressable>
        </View>
      ) : null}

      {searched && showingSample && !catalogError ? (
        <View style={styles.sampleBanner} testID="bottle-sample-banner">
          <Text style={styles.sampleBannerTitle}>Sample inspiration</Text>
          <Text style={styles.sampleBannerBody}>
            Preview only. These pairings are not live inventory and cannot be booked or paid for.
          </Text>
        </View>
      ) : null}

      {searched && !showingSample && !catalogError && filtered.length > 0 ? (
        <Text style={styles.section} testID="bottle-paired-journeys">
          Your mixed journey
        </Text>
      ) : null}

      {searched && showingSample ? (
        <Text style={styles.section} testID="bottle-paired-journeys">
          Sample paired journeys
        </Text>
      ) : null}

      {searched && filtered.length === 0 && !mixing && !catalogError ? (
        <View style={styles.emptyBlock} testID="bottle-catalog-empty">
          <Text style={styles.emptyTitle}>No combination for these dates</Text>
          <Text style={styles.empty}>
            {`Mixed sleeping stays are not available yet for ${destination.trim()} from ${humanDate(checkIn)} to ${humanDate(checkOut)}.`}
          </Text>
          <Pressable
            testID="bottle-notify-consent"
            style={styles.notifyRow}
            onPress={() => setNotifyOk((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: notifyOk }}
          >
            <Text style={styles.notifyMark}>{notifyOk ? "✓" : ""}</Text>
            <Text style={styles.notifyText}>Tell me when a combination opens</Text>
          </Pressable>
          <Pressable
            testID="bottle-save-destination"
            style={styles.retryBtn}
            onPress={() => void saveDestination()}
            accessibilityRole="button"
          >
            <Text style={styles.retryBtnText}>Save this destination</Text>
          </Pressable>
          {saveMsg ? <Text testID="bottle-save-msg">{saveMsg}</Text> : null}
          <Pressable testID="bottle-show-samples" onPress={() => void showInspiration()} style={styles.sampleLink}>
            <Text style={styles.sampleLinkText}>Preview sample journeys</Text>
          </Pressable>
        </View>
      ) : null}

      {searched && filtered.length > 0 && mode === "mobile" ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={cardW + 12}
          contentContainerStyle={styles.mobileRail}
        >
          {cards}
        </ScrollView>
      ) : searched && filtered.length > 0 ? (
        <View
          style={[
            styles.grid,
            mode === "desktop" && styles.gridDesktop,
            mode === "tablet" && styles.gridTablet,
          ]}
        >
          {cards}
        </View>
      ) : null}

      {!searched ? (
        <Pressable testID="bottle-show-samples" onPress={() => void showInspiration()} style={styles.sampleLink}>
          <Text style={styles.sampleLinkText}>Preview sample journeys</Text>
        </Pressable>
      ) : null}
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
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 8,
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
  planChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
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
    marginTop: 18,
    marginHorizontal: 20,
    backgroundColor: "#1A1510",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  mixCtaDisabled: { opacity: 0.4 },
  askPanel: { paddingHorizontal: 20, gap: 16, marginTop: 8 },
  askPanelRow: { flexDirection: "row", alignItems: "flex-start" },
  askField: { flex: 1, minWidth: 200 },
  askInput: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E0D8CC",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1A1510",
    backgroundColor: "#FFFFFF",
  },
  travelerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
  travelerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0D8CC",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  travelerBtnText: { fontSize: 20, fontWeight: "700", color: "#1A1510" },
  travelerCount: { fontSize: 20, fontWeight: "800", minWidth: 24, textAlign: "center", color: "#1A1510" },
  stayHint: { marginTop: 14, marginHorizontal: 20, color: "#3A342C", fontWeight: "700" },
  formError: { marginTop: 12, marginHorizontal: 20, color: "#9B2335", fontWeight: "700" },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: "#1A1510", marginBottom: 6 },
  notifyRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  notifyMark: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#1A1510",
    textAlign: "center",
    lineHeight: 20,
    fontWeight: "800",
  },
  notifyText: { color: "#3A342C", flex: 1 },
  sampleLink: { alignSelf: "flex-start", marginHorizontal: 20, marginTop: 18 },
  sampleLinkText: { color: "#6B645A", fontWeight: "700", textDecorationLine: "underline" },
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
