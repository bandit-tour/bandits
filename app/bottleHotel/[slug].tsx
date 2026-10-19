/**
 * Travel in a Bottle — first-sleep hotel detail.
 * Partner white-label OR Google Places lodging (discovery).
 * Never routes to `/hotel/*` QR messaging.
 */
import { useFocusEffect } from "@react-navigation/native";
import { Image as ExpoImage } from "expo-image";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  Linking,
  Modal,
  Platform,
  type ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { humanDate } from "@/components/BottleDateRangeField";
import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import {
  fetchAthensHotelDetail,
  parseBottleHotelParam,
  type AthensDiscoveryHotel,
} from "@/lib/guest-workspace/athensHotelPlaces";
import {
  formatHotelBottleRate,
  loadHotelBottleListing,
  type HotelBottleListing,
} from "@/lib/guest-workspace/hotelBottleListing";
import { mixSearchParams, readBottlePlanSelection, writeBottlePlanSelection, type BottlePlanSelection } from "@/lib/bottlePlanSelection";
import { PLAY_THEATROU_ORIGIN } from "@/lib/guest-workspace/shopGeo";
import { getHotelWhiteLabel, isKnownHotelSlug } from "@/lib/hotelWhiteLabel";
import { workspaceGet } from "@/lib/workspace/client";

type Frame = { key: string; remote?: string; local?: ImageSourcePropType };

function FrameImage({ frame, style }: { frame: Frame; style: object }) {
  if (frame.remote) {
    return <ExpoImage source={{ uri: frame.remote }} style={style} contentFit="cover" />;
  }
  if (frame.local) {
    return <Image source={frame.local} style={style} resizeMode="cover" />;
  }
  return <View style={[style, styles.missingPhoto]} />;
}

function HotelMap({
  lat,
  lng,
  query,
  label,
}: {
  lat?: number | null;
  lng?: number | null;
  query?: string | null;
  label: string;
}) {
  const pin = typeof lat === "number" && typeof lng === "number" ? `${lat},${lng}` : "";
  const q = pin || (query || "").trim();
  if (!q || /^athens$/i.test(q)) return null;
  if (Platform.OS === "web") {
    return (
      <View style={styles.mapFrame} testID="bottle-hotel-map">
        {React.createElement("iframe", {
          title: `${label} map`,
          src: `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed`,
          style: { border: 0, width: "100%", height: "100%" },
        })}
      </View>
    );
  }
  const url = pin
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  return (
    <Pressable onPress={() => void Linking.openURL(url)} testID="bottle-hotel-map" accessibilityRole="link">
      <Text style={styles.mapLink}>Map</Text>
    </Pressable>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

export default function BottleHotelDetailScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{
    slug?: string;
    checkIn?: string;
    checkOut?: string;
    travelers?: string;
    hotelNights?: string;
    outdoorNights?: string;
    hotelName?: string;
    destination?: string;
  }>();
  const rawSlug = typeof params.slug === "string" ? params.slug : "";
  const parsed = parseBottleHotelParam(rawSlug);
  const urlCheckIn = typeof params.checkIn === "string" ? params.checkIn : "";
  const urlCheckOut = typeof params.checkOut === "string" ? params.checkOut : "";
  const urlHotelName = typeof params.hotelName === "string" ? params.hotelName.trim() : "";
  const placeId = parsed.kind === "place" ? parsed.id : undefined;
  const hotelSlug = parsed.kind === "partner" ? parsed.id : undefined;
  const [storedPlan, setStoredPlan] = useState<BottlePlanSelection | null>(() => readBottlePlanSelection());
  useFocusEffect(
    useCallback(() => {
      setStoredPlan(readBottlePlanSelection());
    }, []),
  );
  const savedPlan = storedPlan;
  const savedMatchesHotel = Boolean(
    savedPlan &&
      ((placeId && savedPlan.placeId === placeId) ||
        (hotelSlug && savedPlan.hotelSlug === hotelSlug) ||
        (urlHotelName && savedPlan.hotelName === urlHotelName)),
  );
  const checkIn = urlCheckIn || (savedMatchesHotel ? savedPlan?.checkIn || "" : "");
  const checkOut = urlCheckOut || (savedMatchesHotel ? savedPlan?.checkOut || "" : "");
  const travelers = Math.max(
    1,
    Number(params.travelers) || (savedMatchesHotel ? savedPlan?.travelers : 0) || 2,
  );

  const [listing, setListing] = useState<HotelBottleListing | null>(null);
  const [placeHotel, setPlaceHotel] = useState<AthensDiscoveryHotel | null>(null);
  const [reviews, setReviews] = useState<Array<{ rating?: number; text?: string; author?: string }>>([]);
  const [attribution, setAttribution] = useState("Powered by Google");
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [viewer, setViewer] = useState<{ frames: Frame[]; index: number; title: string } | null>(null);
  const [avail, setAvail] = useState<{
    bookable?: boolean;
    rooms?: Array<{ id: string; name: string; totalCents: number | null }>;
    reason?: string;
  } | null>(null);
  useEffect(() => {
    let alive = true;
    setLoadState("loading");
    if (parsed.kind === "place") {
      void fetchAthensHotelDetail(parsed.id).then((res) => {
        if (!alive) return;
        setPlaceHotel(res.hotel);
        setReviews(res.reviews || []);
        setAttribution(res.attribution || "Powered by Google");
        setListing(null);
        setAvail(null);
        setLoadState(res.hotel ? "ready" : "error");
      });
    } else {
      void loadHotelBottleListing(parsed.id, { allowPlayFallback: false }).then((row) => {
        if (!alive) return;
        setListing(row);
        setPlaceHotel(null);
        setLoadState("ready");
      });
    }
    return () => {
      alive = false;
    };
  }, [parsed.kind, parsed.id]);

  useEffect(() => {
    let alive = true;
    if (parsed.kind === "place" || !checkIn || !checkOut) {
      setAvail(null);
      return () => {
        alive = false;
      };
    }
    void workspaceGet<{
      bookable?: boolean;
      reason?: string;
      availability?: { rooms?: Array<{ id: string; name: string; totalCents: number | null }> };
    }>(
      `/api/public/hotels/${encodeURIComponent(parsed.id)}/booking?checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}&travelers=${travelers}`,
    ).then((res) => {
      if (!alive) return;
      if (!res.ok) {
        setAvail({ bookable: false, reason: res.detail || "availability_unavailable", rooms: [] });
        return;
      }
      setAvail({
        bookable: Boolean(res.data.bookable),
        reason: res.data.reason,
        rooms: res.data.availability?.rooms || [],
      });
    });
    return () => {
      alive = false;
    };
  }, [parsed.kind, parsed.id, checkIn, checkOut, travelers]);

  const partnerTitle = (
    listing?.displayName ||
    listing?.whiteLabel?.title ||
    (parsed.kind === "partner" && isKnownHotelSlug(parsed.id) ? getHotelWhiteLabel(parsed.id)?.title : "") ||
    ""
  ).trim();
  const name = placeHotel?.name || (parsed.kind === "partner" ? partnerTitle : "") || urlHotelName || "Hotel";
  const screenOptions = useAppBackScreenOptions({
    title: name,
    fallback: "/travelBottle" as Href,
    showBack: true,
  });

  const frames: Frame[] = useMemo(() => {
    if (placeHotel) {
      return placeHotel.photoUrls.slice(0, 12).map((uri) => ({ key: uri, remote: uri }));
    }
    if (!listing) return [];
    const out: Frame[] = [];
    for (const uri of listing.remoteGalleryUrls) out.push({ key: uri, remote: uri });
    listing.localGallery.forEach((src, i) => out.push({ key: `local-${i}`, local: src }));
    return out.slice(0, 12);
  }, [listing, placeHotel]);

  const wide = width >= 900;
  const area = placeHotel?.address || listing?.location || "Athens";
  const datesLabel =
    checkIn && checkOut
      ? `${humanDate(checkIn)} → ${humanDate(checkOut)}`
      : "Dates not set — outdoor discovery stays open";
  const rawSummary =
    loadState === "loading" ? "" : placeHotel?.editorialSummary || listing?.description || "";
  const summary =
    /play theatrou/i.test(rawSummary) && !/play/i.test(name) ? "" : rawSummary.trim();
  const rateLabel = listing ? formatHotelBottleRate(listing.rates) : null;
  const mapUrl = placeHotel?.googleMapsUri || null;
  const totalNights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    const start = new Date(`${checkIn}T00:00:00`);
    const end = new Date(`${checkOut}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
  }, [checkIn, checkOut]);
  const savedMatches = Boolean(
    savedPlan &&
      ((placeId && savedPlan.placeId === placeId) ||
        (hotelSlug && savedPlan.hotelSlug === hotelSlug) ||
        (name && savedPlan.hotelName === name)),
  );
  const urlHotelNights = Number(params.hotelNights);
  const urlOutdoorNights = Number(params.outdoorNights);
  const hotelNights =
    savedMatches && savedPlan && savedPlan.hotelNights > 0
      ? savedPlan.hotelNights
      : urlHotelNights > 0
        ? urlHotelNights
        : totalNights >= 2
          ? Math.min(2, totalNights - 1)
          : 1;
  const outdoorNights =
    savedMatches && savedPlan && savedPlan.outdoorNights > 0
      ? savedPlan.outdoorNights
      : urlOutdoorNights > 0
        ? urlOutdoorNights
        : totalNights >= 2
          ? Math.max(1, totalNights - hotelNights)
          : 1;
  const shownName =
    placeHotel?.name ||
    (parsed.kind === "partner" ? partnerTitle : "") ||
    urlHotelName ||
    (savedMatches && savedPlan?.hotelName ? savedPlan.hotelName : "");
  const pricedRooms = (avail?.rooms || []).filter((room) => room.name && room.totalCents != null && room.totalCents > 0);
  const supplierRooms =
    pricedRooms.length === 0 && listing?.rates.authorized
      ? listing.roomTypes.filter((room) => (room.priceCentsPerNight || 0) > 0)
      : [];
  const availabilityLabel = placeHotel
    ? "Not bookable yet"
    : !checkIn || !checkOut
      ? "Add dates to see availability"
      : pricedRooms.length > 0 && avail?.bookable
        ? "Available for these dates"
        : avail
          ? "Not bookable yet"
          : "Checking availability";
  const canMix = Boolean(shownName);
  const planBase = {
    destination:
      (typeof params.destination === "string" && params.destination.trim()) ||
      savedPlan?.destination ||
      "Athens",
    checkIn,
    checkOut,
    travelers,
    hotelNights,
    outdoorNights,
    placeId,
    hotelSlug,
    hotelName: shownName,
    partner: parsed.kind === "partner",
    outdoorPick: savedMatchesHotel ? savedPlan?.outdoorPick : undefined,
  };
  useEffect(() => {
    if (!shownName || !checkIn || !checkOut) return;
    writeBottlePlanSelection(planBase);
  }, [
    checkIn,
    checkOut,
    hotelNights,
    hotelSlug,
    outdoorNights,
    params.destination,
    parsed.kind,
    placeId,
    planBase.destination,
    planBase.hotelName,
    savedMatchesHotel,
    savedPlan?.outdoorPick?.id,
    savedPlan?.outdoorPick?.kind,
    shownName,
    travelers,
  ]);
  const openMix = () => {
    if (!shownName) return;
    writeBottlePlanSelection(planBase);
    const qs = new URLSearchParams({ ...mixSearchParams(planBase), autorun: "1" });
    router.push(`/bottleMix?${qs.toString()}` as Href);
  };
  const openHotelOnly = () => {
    if (!shownName) return;
    writeBottlePlanSelection(planBase);
    const qs = new URLSearchParams({
      hotelName: shownName,
      travelers: String(travelers),
      destination: planBase.destination,
    });
    if (hotelSlug) qs.set("slug", hotelSlug);
    if (placeId) qs.set("placeId", placeId);
    if (checkIn) qs.set("checkIn", checkIn);
    if (checkOut) qs.set("checkOut", checkOut);
    router.push(`/bottleBookHotel?${qs.toString()}` as Href);
  };
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="bottle-hotel-detail">
      <Stack.Screen options={screenOptions} />
      {viewer ? (
        <Modal visible animationType="fade" onRequestClose={() => setViewer(null)}>
          <View style={styles.lightbox}>
            <Pressable onPress={() => setViewer(null)} style={styles.lightboxBar}>
              <Text style={styles.lightboxBack}>← Back</Text>
            </Pressable>
            <Pressable
              style={styles.lightboxStage}
              onPress={() =>
                setViewer({
                  ...viewer,
                  index: (viewer.index + 1) % viewer.frames.length,
                })
              }
            >
              <FrameImage frame={viewer.frames[viewer.index]} style={styles.lightboxImage} />
            </Pressable>
          </View>
        </Modal>
      ) : null}
      <View style={[styles.page, wide && styles.pageWide]} testID={`bottle-hotel-detail-${parsed.id}`}>
        {frames[0] ? (
          <Pressable onPress={() => setViewer({ frames, index: 0, title: shownName })} accessibilityRole="button">
            <FrameImage frame={frames[0]} style={[styles.hero, wide && styles.heroWide]} />
          </Pressable>
        ) : (
          <View style={[styles.hero, wide && styles.heroWide]} />
        )}
        {frames.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.galleryRow}
            testID="bottle-hotel-detail-gallery"
          >
            {frames.map((frame, index) => (
              <Pressable
                key={frame.key}
                onPress={() => setViewer({ frames, index, title: shownName })}
                accessibilityRole="button"
              >
                <FrameImage frame={frame} style={styles.galleryImage} />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        <Text style={styles.title} testID="bottle-hotel-detail-name">
          {shownName || name}
        </Text>
        {placeHotel?.rating != null ? (
          <Text style={styles.meta} testID="bottle-hotel-rating">
            ★ {placeHotel.rating.toFixed(1)}
            {placeHotel.userRatingCount ? ` · ${placeHotel.userRatingCount} reviews` : ""}
          </Text>
        ) : null}
        <Text style={styles.meta} testID="bottle-hotel-address">
          {placeHotel?.address || listing?.address || (parsed.id === "play-theatrou" ? "Psyrri, Athens" : area)}
        </Text>
        <Text style={styles.meta} testID="bottle-hotel-plan">
          {checkIn && checkOut
            ? `${datesLabel} · ${hotelNights} hotel + ${outdoorNights} outdoor`
            : datesLabel}
        </Text>
        <Text style={styles.publish} testID="bottle-hotel-availability">
          {availabilityLabel}
        </Text>
        <Pressable
          style={[styles.cta, !canMix && styles.ctaOff]}
          onPress={openMix}
          disabled={!canMix}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canMix }}
          testID="bottle-hotel-mix-cta"
        >
          <Text style={styles.ctaText}>MIX MY STAY</Text>
        </Pressable>
        <Pressable
          style={[styles.ctaGhost, !shownName && styles.ctaOff]}
          onPress={openHotelOnly}
          disabled={!shownName}
          accessibilityRole="button"
          accessibilityState={{ disabled: !shownName }}
          testID="bottle-hotel-book-cta"
        >
          <Text style={styles.ctaGhostText}>Book Hotel Only</Text>
        </Pressable>
        {summary ? (
          <View style={styles.block}>
            <Text style={styles.body} testID="bottle-hotel-detail-summary">
              {summary}
            </Text>
          </View>
        ) : null}
        <View style={styles.facts}>
          <Fact label="Address" value={placeHotel?.address || listing?.address || area} />
          {rateLabel ? <Fact label="Rate" value={`From ${rateLabel} / night`} /> : null}
        </View>
        {listing?.services?.length ? (
          <View style={styles.block} testID="bottle-hotel-detail-amenities">
            <Text style={styles.blockTitle}>Amenities</Text>
            <View style={styles.chips}>
              {listing.services.map((service) => (
                <View key={service} style={styles.chip}>
                  <Text style={styles.chipText}>{service}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Location</Text>
          <HotelMap
            lat={placeHotel?.lat ?? (parsed.id === "play-theatrou" ? PLAY_THEATROU_ORIGIN.lat : null)}
            lng={placeHotel?.lng ?? (parsed.id === "play-theatrou" ? PLAY_THEATROU_ORIGIN.lng : null)}
            query={placeHotel?.address || listing?.address || (parsed.id === "play-theatrou" ? "Psyrri, Athens" : "")}
            label={shownName || name}
          />
          {mapUrl && (placeHotel?.lat == null || placeHotel?.lng == null) ? (
            <Pressable onPress={() => void Linking.openURL(mapUrl)} testID="bottle-hotel-map" accessibilityRole="link">
              <Text style={styles.mapLink}>Open map</Text>
            </Pressable>
          ) : null}
        </View>
        {pricedRooms.length ? (
          <View style={styles.block} testID="bottle-hotel-detail-rooms">
            <Text style={styles.blockTitle}>Rooms</Text>
            {pricedRooms.map((room) => (
              <View key={room.id} style={styles.roomCard}>
                <Text style={styles.roomName}>{room.name}</Text>
                <Text style={styles.roomMeta}>{`€${Math.round((room.totalCents || 0) / 100)} for these dates`}</Text>
              </View>
            ))}
          </View>
        ) : supplierRooms.length ? (
          <View style={styles.block} testID="bottle-hotel-detail-rooms">
            <Text style={styles.blockTitle}>Rooms</Text>
            {supplierRooms.map((room) => (
              <View key={room.id} style={styles.roomCard}>
                <Text style={styles.roomName}>{room.name}</Text>
                <Text style={styles.roomMeta}>{`€${Math.round((room.priceCentsPerNight || 0) / 100)} / night`}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {reviews.length ? (
          <View style={styles.block} testID="bottle-hotel-reviews">
            <Text style={styles.blockTitle}>Reviews</Text>
            {reviews.slice(0, 3).map((review, index) => (
              <View key={`${review.author || "guest"}-${index}`} style={styles.roomCard}>
                <Text style={styles.roomName}>
                  {review.author || "Guest"}
                  {review.rating != null ? ` · ★ ${review.rating}` : ""}
                </Text>
                {review.text ? <Text style={styles.body}>{review.text}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}
        <Text style={styles.attribution}>{attribution}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F5F1" },
  content: { paddingBottom: 56 },
  page: { width: "100%", maxWidth: 920, alignSelf: "center", paddingHorizontal: 16, paddingTop: 16 },
  pageWide: { paddingHorizontal: 24 },
  hero: {
    width: "100%",
    height: 320,
    borderRadius: 16,
    backgroundColor: "#E8E2D8",
    marginBottom: 12,
  },
  heroWide: { height: 460 },
  mapFrame: {
    width: "100%",
    height: 220,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#E8E2D8",
  },
  mapLink: { fontSize: 15, fontWeight: "700", color: "#1A1510", paddingVertical: 8 },
  ctaOff: { opacity: 0.45 },
  kicker: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#8A7A66",
    marginBottom: 6,
  },
  title: { fontSize: 28, fontWeight: "800", color: "#1A1510", marginBottom: 6 },
  meta: { fontSize: 14, color: "#5C5348", marginBottom: 4 },
  publish: { fontSize: 13, fontWeight: "600", color: "#6B5E4E", marginBottom: 14 },
  galleryRow: { gap: 10, paddingBottom: 8 },
  galleryImage: { width: 260, height: 170, borderRadius: 14, backgroundColor: "#E8E2D8" },
  galleryEmpty: {
    minHeight: 170,
    borderRadius: 16,
    backgroundColor: "#EDE7DC",
    padding: 18,
    justifyContent: "center",
    marginBottom: 8,
  },
  galleryEmptyTitle: { fontSize: 18, fontWeight: "800", color: "#1A1510", marginBottom: 6 },
  galleryEmptyBody: { fontSize: 14, lineHeight: 20, color: "#5C5348" },
  block: { marginTop: 20 },
  blockTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#8A7A66",
    marginBottom: 8,
  },
  body: { fontSize: 15, lineHeight: 22, color: "#2C261E" },
  facts: { marginTop: 16, gap: 10 },
  fact: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#FFFCF7",
    borderWidth: 1,
    borderColor: "#E6DFD3",
  },
  factLabel: { fontSize: 11, fontWeight: "800", color: "#8A7A66", marginBottom: 4, textTransform: "uppercase" },
  factValue: { fontSize: 14, lineHeight: 20, color: "#1A1510" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#EFE8DC",
  },
  chipText: { fontSize: 13, fontWeight: "600", color: "#3A3228" },
  gapNote: { fontSize: 14, lineHeight: 20, color: "#6B5E4E" },
  roomCard: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#FFFCF7",
    borderWidth: 1,
    borderColor: "#E6DFD3",
    marginBottom: 8,
  },
  roomName: { fontSize: 16, fontWeight: "700", color: "#1A1510", marginBottom: 4 },
  roomMeta: { fontSize: 13, color: "#6B5E4E", marginBottom: 4 },
  policyLine: { fontSize: 14, lineHeight: 21, color: "#2C261E", marginBottom: 6 },
  attribution: { marginTop: 16, fontSize: 11, color: "#8A7A66" },
  ctaStack: { marginTop: 28, gap: 10 },
  cta: {
    backgroundColor: "#1A1510",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  ctaText: { color: "#FFFCF7", fontSize: 15, fontWeight: "700" },
  ctaGhost: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D4CBBE",
  },
  ctaGhostText: { color: "#3A3228", fontSize: 15, fontWeight: "600" },
  unavailableCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#EDE7DC",
    borderWidth: 1,
    borderColor: "#D4CBBE",
  },
  unavailableTitle: { fontSize: 15, fontWeight: "700", color: "#1A1510", marginBottom: 6 },
  missingPhoto: { backgroundColor: "#E8E2D8" },
  lightbox: { flex: 1, backgroundColor: "#0E0C0A" },
  lightboxBar: {
    paddingTop: Platform.OS === "web" ? 16 : 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  lightboxBack: { color: "#F7F5F1", fontSize: 16, fontWeight: "700" },
  lightboxStage: { flex: 1, justifyContent: "center", padding: 12 },
  lightboxImage: { width: "100%", height: "100%", borderRadius: 8 },
});
