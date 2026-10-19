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
import { mixSearchParams, writeBottlePlanSelection } from "@/lib/bottlePlanSelection";
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
  const openMix = () => {
    if (!checkIn || !checkOut || totalNights < 2) {
      router.push("/travelBottle" as Href);
      return;
    }
    const hotelNights = Math.min(2, totalNights - 1);
    const sel = {
      destination: "Athens",
      checkIn,
      checkOut,
      travelers,
      hotelNights,
      outdoorNights: totalNights - hotelNights,
      placeId: parsed.kind === "place" ? parsed.id : undefined,
      hotelSlug: parsed.kind === "partner" ? parsed.id : undefined,
      hotelName: name,
      partner: parsed.kind === "partner",
    };
    writeBottlePlanSelection(sel);
    const qs = new URLSearchParams({ ...mixSearchParams(sel), autorun: "1" });
    router.push(`/bottleMix?${qs.toString()}` as Href);
  };
  const backToPlan = () => {
    if (name && checkIn && checkOut) {
      const hotelNights = totalNights >= 2 ? Math.min(2, totalNights - 1) : 1;
      writeBottlePlanSelection({
        destination: "Athens",
        checkIn,
        checkOut,
        travelers,
        hotelNights,
        outdoorNights: totalNights >= 2 ? totalNights - hotelNights : 1,
        placeId: parsed.kind === "place" ? parsed.id : undefined,
        hotelSlug: parsed.kind === "partner" ? parsed.id : undefined,
        hotelName: name,
        partner: parsed.kind === "partner",
      });
    }
    router.push("/travelBottle" as Href);
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
        <Text style={styles.kicker}>Travel in a Bottle · First hotel</Text>
        <Text style={styles.title} testID="bottle-hotel-detail-name">
          {name}
        </Text>
        <Text style={styles.meta}>
          {area} · {datesLabel} · {travelers} traveler{travelers === 1 ? "" : "s"}
        </Text>
        <Text style={styles.publish} testID="bottle-hotel-detail-publish">
          {placeHotel
            ? "Athens lodging · discovery listing"
            : listing?.workspacePublishStatus === "published"
              ? "Partner hotel"
              : "Athens boutique partner"}
        </Text>

        {frames.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.galleryRow}
            testID="bottle-hotel-detail-gallery"
          >
            {frames.map((frame, index) => (
              <Pressable
                key={frame.key}
                onPress={() => setViewer({ frames, index, title: name })}
                accessibilityRole="button"
              >
                <FrameImage frame={frame} style={styles.galleryImage} />
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.galleryEmpty}>
            <Text style={styles.galleryEmptyTitle}>{name}</Text>
            <Text style={styles.galleryEmptyBody}>
              Photos appear when available from the hotel or Google listing.
            </Text>
          </View>
        )}

        <View style={styles.block}>
          <Text style={styles.blockTitle}>About this stay</Text>
          <Text style={styles.body} testID="bottle-hotel-detail-summary">
            {summary}
          </Text>
        </View>

        <View style={styles.facts}>
          <Fact label="Address" value={placeHotel?.address || listing?.address || area} />
          {placeHotel?.rating != null ? (
            <Fact
              label="Guest rating"
              value={`★ ${placeHotel.rating.toFixed(1)}${
                placeHotel.userRatingCount ? ` · ${placeHotel.userRatingCount} reviews` : ""
              }`}
            />
          ) : null}
          <Fact
            label="Rates"
            value={
              rateLabel
                ? `From ${rateLabel} / night`
                : "No contracted room rate for these dates. This hotel is not bookable here until inventory is authorized."
            }
          />
          {placeHotel?.phone ? <Fact label="Phone" value={placeHotel.phone} /> : null}
        </View>

        {listing?.services?.length ? (
          <View style={styles.block} testID="bottle-hotel-detail-amenities">
            <Text style={styles.blockTitle}>Amenities</Text>
            <View style={styles.chips}>
              {listing.services.map((s) => (
                <View key={s} style={styles.chip}>
                  <Text style={styles.chipText}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {listing?.roomTypes?.length ? (
          <View style={styles.block} testID="bottle-hotel-detail-rooms">
            <Text style={styles.blockTitle}>Rooms</Text>
            {listing.roomTypes.map((room) => (
              <View key={room.id} style={styles.roomCard}>
                <Text style={styles.roomName}>{room.name}</Text>
                {room.occupancy ? <Text style={styles.roomMeta}>Sleeps {room.occupancy}</Text> : null}
                {room.description ? <Text style={styles.body}>{room.description}</Text> : null}
              </View>
            ))}
          </View>
        ) : placeHotel ? (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Rooms & availability</Text>
            <Text style={styles.gapNote}>
              Room types and live availability come from the hotel’s booking channel — Google discovery does
              not invent inventory.
            </Text>
          </View>
        ) : null}

        {listing?.policies?.length ? (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Policies</Text>
            {listing.policies.map((p) => (
              <Text key={p} style={styles.policyLine}>
                {p}
              </Text>
            ))}
          </View>
        ) : null}

        {reviews.length ? (
          <View style={styles.block} testID="bottle-hotel-reviews">
            <Text style={styles.blockTitle}>Recent reviews</Text>
            {reviews.map((r, i) => (
              <View key={`${r.author}-${i}`} style={styles.roomCard}>
                <Text style={styles.roomName}>
                  {r.author || "Guest"}
                  {r.rating != null ? ` · ★ ${r.rating}` : ""}
                </Text>
                <Text style={styles.body}>{r.text}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.attribution}>{attribution}</Text>

        <View style={styles.ctaStack}>
          {avail?.bookable && avail.rooms?.some((r) => r.totalCents != null) ? (
            <Pressable
              style={styles.cta}
              testID="bottle-hotel-book-banditour"
              onPress={() => {
                const room = avail.rooms!.find((r) => r.totalCents != null);
                if (!room || !checkIn || !checkOut) return;
                const qs = new URLSearchParams({
                  slug: parsed.id,
                  checkIn,
                  checkOut,
                  travelers: String(travelers),
                  roomId: room.id,
                });
                router.push(`/bottleBookHotel?${qs.toString()}` as Href);
              }}
            >
              <Text style={styles.ctaText}>
                {`Book through banDiTour · €${Math.round((avail.rooms.find((r) => r.totalCents != null)?.totalCents || 0) / 100)} · no fee`}
              </Text>
            </Pressable>
          ) : placeHotel ? (
            <Text style={styles.gapNote} testID="bottle-hotel-nonbookable">
              Discoverable on Places — not bookable in banDiTour until this hotel is contracted with live
              inventory.
            </Text>
          ) : avail && !avail.bookable ? (
            <Text style={styles.gapNote} testID="bottle-hotel-no-inventory">
              Partner hotel — rooms for these dates are not available to book yet
              {avail.reason ? ` (${avail.reason})` : ""}.
            </Text>
          ) : null}
          {mapUrl && !avail?.bookable ? (
            <Pressable
              style={styles.ctaGhost}
              onPress={() => void Linking.openURL(mapUrl)}
              accessibilityRole="link"
              testID="bottle-hotel-map-link"
            >
              <Text style={styles.ctaGhostText}>Open in Google Maps</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.ctaGhost}
            onPress={openMix}
            accessibilityRole="button"
            testID="bottle-hotel-mix-cta"
          >
            <Text style={styles.ctaGhostText}>Mix with a second sleep</Text>
          </Pressable>
          <Pressable
            style={styles.ctaGhost}
            onPress={backToPlan}
            testID="bottle-hotel-back-to-plan"
          >
            <Text style={styles.ctaGhostText}>Back to Bottle plan</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F5F1" },
  content: { paddingBottom: 56 },
  page: { width: "100%", maxWidth: 920, alignSelf: "center", paddingHorizontal: 16, paddingTop: 16 },
  pageWide: { paddingHorizontal: 24 },
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
