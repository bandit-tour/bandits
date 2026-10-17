/**
 * Travel in a Bottle — full hotel detail (first sleep).
 * Must NEVER route into `/hotel/*` QR messaging / flip-card entry.
 */
import { Image as ExpoImage } from "expo-image";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
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
  formatHotelBottleRate,
  loadHotelBottleListing,
  type HotelBottleListing,
} from "@/lib/guest-workspace/hotelBottleListing";
import { getHotelWhiteLabel, isKnownHotelSlug, normalizeHotelSlug } from "@/lib/hotelWhiteLabel";

type Frame = { key: string; remote?: string; local?: ImageSourcePropType };

function isInventedWelcome(text: string): boolean {
  return /message in a bottle|calm, personal|soft welcome before you/i.test(text);
}

function FrameImage({ frame, style }: { frame: Frame; style: object }) {
  if (frame.remote) {
    return <ExpoImage source={{ uri: frame.remote }} style={style} contentFit="cover" />;
  }
  if (frame.local) {
    return <Image source={frame.local} style={style} resizeMode="cover" />;
  }
  return <View style={[style, styles.missingPhoto]} />;
}

function GalleryViewer({
  frames,
  index,
  title,
  onClose,
  onIndex,
}: {
  frames: Frame[];
  index: number;
  title: string;
  onClose: () => void;
  onIndex: (n: number) => void;
}) {
  const frame = frames[index];
  const prev = () => onIndex((index - 1 + frames.length) % frames.length);
  const next = () => onIndex((index + 1) % frames.length);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!frame) return null;

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} testID="bottle-hotel-lightbox">
      <View style={styles.lightbox}>
        <View style={styles.lightboxBar}>
          <Pressable onPress={onClose} accessibilityRole="button" testID="bottle-hotel-lightbox-close">
            <Text style={styles.lightboxBack}>← Back</Text>
          </Pressable>
          <Text style={styles.lightboxTitle} numberOfLines={1}>
            {title} · {index + 1} / {frames.length}
          </Text>
        </View>
        <Pressable style={styles.lightboxStage} onPress={next} accessibilityRole="button">
          <FrameImage frame={frame} style={styles.lightboxImage} />
        </Pressable>
      </View>
    </Modal>
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

function publishLabel(listing: HotelBottleListing): string {
  if (listing.workspacePublishStatus === "not_published") return "Not published on Workspace";
  if (listing.workspacePublishStatus === "unreachable") return "Workspace unreachable";
  if (listing.tenantStatus) return `Workspace · ${listing.tenantStatus}`;
  if (listing.workspacePublishStatus === "published") return "Published on Workspace";
  return "Publication status unknown";
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
  const slug = normalizeHotelSlug(typeof params.slug === "string" ? params.slug : "") || "play-theatrou";
  const checkIn = typeof params.checkIn === "string" ? params.checkIn : "";
  const checkOut = typeof params.checkOut === "string" ? params.checkOut : "";
  const travelers = Math.max(1, Number(params.travelers) || 2);
  const wl = isKnownHotelSlug(slug) ? getHotelWhiteLabel(slug) : null;
  const seedName = wl?.title || wl?.displayName || "Athens boutique hotel";

  const [listing, setListing] = useState<HotelBottleListing | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready">("loading");
  const [viewer, setViewer] = useState<{ frames: Frame[]; index: number; title: string } | null>(null);

  useEffect(() => {
    let alive = true;
    setLoadState("loading");
    void loadHotelBottleListing(slug).then((row) => {
      if (!alive) return;
      setListing(row);
      setLoadState("ready");
    });
    return () => {
      alive = false;
    };
  }, [slug]);

  const screenOptions = useAppBackScreenOptions({
    title: listing?.whiteLabel?.title || listing?.displayName || seedName,
    fallback: "/travelBottle" as Href,
    showBack: true,
  });

  const frames: Frame[] = useMemo(() => {
    if (!listing) return [];
    const out: Frame[] = [];
    for (const uri of listing.remoteGalleryUrls) out.push({ key: uri, remote: uri });
    listing.localGallery.forEach((src, i) => out.push({ key: `local-${i}`, local: src }));
    return out.slice(0, 12);
  }, [listing]);

  const wide = width >= 900;
  const name = listing?.whiteLabel?.title || listing?.displayName || seedName;
  const area = listing?.location || "Athens";
  const notPublished = listing?.workspacePublishStatus === "not_published";
  const unreachable = listing?.workspacePublishStatus === "unreachable";
  const raw = String(listing?.description || "").trim();
  const summary =
    loadState === "loading"
      ? `Loading ${name} from Workspace…`
      : notPublished
        ? `${name} is discoverable for Athens Bottle planning. Authorized partner branding may appear below; rates and room inventory wait until Workspace goes LIVE — Guest will not invent them.`
        : unreachable
          ? `Could not reach Workspace for ${name}. This is a connection issue, not a missing listing.`
          : raw.length > 40 &&
              !isInventedWelcome(raw) &&
              !/^welcome to\b/i.test(raw) &&
              !/night layer already knows|opening move is waiting/i.test(raw)
            ? raw
            : `${name} is your first sleep in ${area}. Travel in a Bottle pairs this hotel with a second stay outside the city.`;
  const rateLabel = listing ? formatHotelBottleRate(listing.rates) : null;
  const datesLabel =
    checkIn && checkOut ? `${humanDate(checkIn)} → ${humanDate(checkOut)}` : "Dates from your Bottle plan";
  const publishText =
    loadState !== "ready" || !listing
      ? "Checking Workspace…"
      : listing.workspacePublishStatus === "published"
        ? publishLabel(listing)
        : listing.workspacePublishStatus === "not_published"
          ? "Discoverable · not LIVE on Workspace yet"
          : publishLabel(listing);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="bottle-hotel-detail">
      <Stack.Screen options={screenOptions} />
      {viewer ? (
        <GalleryViewer
          frames={viewer.frames}
          index={viewer.index}
          title={viewer.title}
          onClose={() => setViewer(null)}
          onIndex={(n) => setViewer({ ...viewer, index: n })}
        />
      ) : null}

      <View style={[styles.page, wide && styles.pageWide]} testID={`bottle-hotel-detail-${slug}`}>
        <Text style={styles.kicker} testID="bottle-hotel-product-kicker">
          Travel in a Bottle · First hotel
        </Text>
        <Text style={styles.title} testID="bottle-hotel-detail-name">
          {name}
        </Text>
        <Text style={styles.meta}>
          {area} · {datesLabel} · {travelers} traveler{travelers === 1 ? "" : "s"}
        </Text>
        <Text style={styles.publish} testID="bottle-hotel-detail-publish">
          {publishText}
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
          <View style={styles.galleryEmpty} testID="bottle-hotel-detail-gallery-empty">
            <Text style={styles.galleryEmptyTitle}>{name}</Text>
            <Text style={styles.galleryEmptyBody}>
              {notPublished
                ? "Discoverable profile — no approved property gallery frames yet. Guest will not invent photos."
                : unreachable
                  ? "Workspace unreachable — gallery will load when the connection recovers."
                  : "No property photos published yet. Stock and third-party images are not shown."}
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
          <Fact label="Address" value={listing?.address || "Address publishes with the hotel Workspace config."} />
          <Fact
            label="Rates"
            value={
              rateLabel
                ? `From ${rateLabel} / night`
                : listing?.rates.note || "Rates appear when authorized."
            }
          />
          <Fact
            label="Rooms"
            value={
              listing?.roomTypes.length
                ? `${listing.roomTypes.length} room type${listing.roomTypes.length === 1 ? "" : "s"} published`
                : "Room inventory not published yet."
            }
          />
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
        ) : (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Amenities</Text>
            <Text style={styles.gapNote}>Amenities appear when the hotel publishes services.</Text>
          </View>
        )}

        <View style={styles.block} testID="bottle-hotel-detail-rooms">
          <Text style={styles.blockTitle}>Rooms</Text>
          {listing?.roomTypes.length ? (
            listing.roomTypes.map((room) => (
              <View key={room.id} style={styles.roomCard}>
                <Text style={styles.roomName}>{room.name}</Text>
                {room.occupancy ? (
                  <Text style={styles.roomMeta}>Sleeps {room.occupancy}</Text>
                ) : null}
                {room.description ? <Text style={styles.body}>{room.description}</Text> : null}
              </View>
            ))
          ) : (
            <Text style={styles.gapNote} testID="bottle-hotel-rooms-missing">
              Room types are not in the public Workspace config yet. Guest will not invent inventory.
            </Text>
          )}
        </View>

        <View style={styles.block} testID="bottle-hotel-detail-policies">
          <Text style={styles.blockTitle}>Policies</Text>
          {listing?.policies.length ? (
            listing.policies.map((p) => (
              <Text key={p} style={styles.policyLine}>
                {p}
              </Text>
            ))
          ) : (
            <Text style={styles.gapNote}>
              Check-in, cancellation, and house rules appear when the hotel publishes them.
            </Text>
          )}
        </View>

        {listing?.benefits?.length ? (
          <View style={styles.block} testID="bottle-hotel-detail-benefits">
            <Text style={styles.blockTitle}>Guest benefits</Text>
            {listing.benefits.map((b) => (
              <View key={b.id || b.title} style={styles.benefit}>
                <Text style={styles.roomName}>{b.title}</Text>
                {b.body ? <Text style={styles.body}>{b.body}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.ctaStack}>
          <Pressable
            style={styles.cta}
            onPress={() => router.push("/travelBottle" as Href)}
            accessibilityRole="button"
            testID="bottle-hotel-back-to-plan"
          >
            <Text style={styles.ctaText}>Back to Bottle plan</Text>
          </Pressable>
          <Pressable
            style={styles.ctaGhost}
            onPress={() => router.push("/hotelier" as Href)}
            accessibilityRole="button"
            testID="bottle-hotel-open-services"
          >
            <Text style={styles.ctaGhostText}>Hotel services (in-stay)</Text>
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
  benefit: { marginBottom: 10 },
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
  missingPhoto: { backgroundColor: "#E8E2D8" },
  lightbox: { flex: 1, backgroundColor: "#0E0C0A" },
  lightboxBar: {
    paddingTop: Platform.OS === "web" ? 16 : 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  lightboxBack: { color: "#F7F5F1", fontSize: 16, fontWeight: "700" },
  lightboxTitle: { color: "#D4CBBE", fontSize: 14, flex: 1 },
  lightboxStage: { flex: 1, justifyContent: "center", padding: 12 },
  lightboxImage: { width: "100%", height: "100%", borderRadius: 8 },
});
