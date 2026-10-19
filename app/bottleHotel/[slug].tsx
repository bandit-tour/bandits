/**
 * Travel in a Bottle — first-sleep hotel detail.
 * Partner white-label OR Google Places lodging (discovery).
 * Never routes to `/hotel/*` QR messaging.
 */
import { Image as ExpoImage } from "expo-image";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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
import { mixSearchParams, readBottlePlanSelection, writeBottlePlanSelection } from "@/lib/bottlePlanSelection";
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
  }>();
  const rawSlug = typeof params.slug === "string" ? params.slug : "";
  const parsed = parseBottleHotelParam(rawSlug);
  const checkIn = typeof params.checkIn === "string" ? params.checkIn : "";
  const checkOut = typeof params.checkOut === "string" ? params.checkOut : "";
  const travelers = Math.max(1, Number(params.travelers) || 2);

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
      void loadHotelBottleListing(parsed.id).then((row) => {
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

  const partnerName =
    listing?.whiteLabel?.title ||
    listing?.displayName ||
    (isKnownHotelSlug(parsed.id) ? getHotelWhiteLabel(parsed.id)?.title : null) ||
    "Athens hotel";
  const name = placeHotel?.name || partnerName;
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
    checkIn && checkOut ? `${humanDate(checkIn)} → ${humanDate(checkOut)}` : "Add dates in Bottle plan";
  const summary =
    loadState === "loading"
      ? `Loading ${name}…`
      : placeHotel?.editorialSummary ||
        listing?.description ||
        `${name} is your first sleep in Athens. Mix pairs this hotel with a verified second sleep outside the city.`;
  const rateLabel = listing ? formatHotelBottleRate(listing.rates) : null;
  const mapUrl = placeHotel?.googleMapsUri || null;
  const totalNights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    const start = new Date(`${checkIn}T00:00:00`);
    const end = new Date(`${checkOut}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
  }, [checkIn, checkOut]);
  const placeId = parsed.kind === "place" ? parsed.id : undefined;
  const hotelSlug = parsed.kind === "partner" ? parsed.id : undefined;
  const savedPlan = readBottlePlanSelection();
  const savedMatches = Boolean(
    savedPlan &&
      ((placeId && savedPlan.placeId === placeId) ||
        (hotelSlug && savedPlan.hotelSlug === hotelSlug) ||
        (name && savedPlan.hotelName === name)),
  );
  const urlHotelNights = Number(params.hotelNights);
  const urlOutdoorNights = Number(params.outdoorNights);
  const hotelNights =
    urlHotelNights > 0
      ? urlHotelNights
      : savedMatches && savedPlan && savedPlan.hotelNights > 0
        ? savedPlan.hotelNights
        : totalNights >= 2
          ? Math.min(2, totalNights - 1)
          : 1;
  const outdoorNights =
    urlOutdoorNights > 0
      ? urlOutdoorNights
      : savedMatches && savedPlan && savedPlan.outdoorNights > 0
        ? savedPlan.outdoorNights
        : totalNights >= 2
          ? Math.max(1, totalNights - hotelNights)
          : 1;
  const shownName =
    placeHotel?.name ||
    (parsed.kind === "partner" ? partnerName : "") ||
    (savedMatches && savedPlan?.hotelName ? savedPlan.hotelName : "");
  const openMix = () => {
    if (!shownName || !checkIn || !checkOut) return;
    const sel = {
      destination: savedPlan?.destination || "Athens",
      checkIn,
      checkOut,
      travelers,
      hotelNights,
      outdoorNights,
      placeId,
      hotelSlug,
      hotelName: shownName,
      partner: parsed.kind === "partner",
    };
    writeBottlePlanSelection(sel);
    const qs = new URLSearchParams({ ...mixSearchParams(sel), autorun: "1" });
    router.push(`/bottleMix?${qs.toString()}` as Href);
  };
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="bottle-hotel-detail">
      <Stack.Screen options={screenOptions} />
      <View style={[styles.page, wide && styles.pageWide]}>
        {frames[0] ? (
          <FrameImage frame={frames[0]} style={styles.hero} />
        ) : (
          <View style={styles.hero} />
        )}
        <Text style={styles.title} testID="bottle-hotel-detail-name">
          {shownName}
        </Text>
        <Text style={styles.meta} testID="bottle-hotel-plan">
          {datesLabel} · {hotelNights} hotel + {outdoorNights} outdoor
        </Text>
        <Pressable
          style={styles.cta}
          onPress={openMix}
          accessibilityRole="button"
          testID="bottle-hotel-mix-cta"
        >
          <Text style={styles.ctaText}>MIX MY STAY</Text>
        </Pressable>
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
    height: 280,
    borderRadius: 16,
    backgroundColor: "#E8E2D8",
    marginBottom: 16,
  },
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
