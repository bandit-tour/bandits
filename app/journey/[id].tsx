import { Image as ExpoImage } from "expo-image";
import { Stack, useLocalSearchParams, type Href } from "expo-router";
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

import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import {
  bookBottleStayViaWorkspace,
  fetchLiveBottleStay,
  mapWorkspaceBottleStay,
  type WorkspaceBottleStay,
} from "@/lib/guest-workspace/liveBottle";
import {
  loadHotelBottleListing,
  type HotelBottleListing,
} from "@/lib/guest-workspace/hotelBottleListing";
import {
  getBottleMatchById,
  isSampleBottleMatch,
  journeyNightsLabel,
  withLiveHotelName,
  withPlannedHotelNights,
  type BottleMatch,
} from "@/lib/guest-workspace/productWorlds";
import { liveHotelDisplayName } from "@/lib/stay/liveHotelIdentity";
import { getHotelEntry } from "@/lib/pilotSession";

function nightLabel(n: number) {
  return `${n} night${n === 1 ? "" : "s"}`;
}

function isInventedWelcome(text: string): boolean {
  return /message in a bottle|calm, personal|soft welcome before you/i.test(text);
}

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
    <Modal visible animationType="fade" onRequestClose={onClose} testID="journey-lightbox">
      <View style={styles.lightbox}>
        <View style={styles.lightboxBar}>
          <Pressable onPress={onClose} accessibilityRole="button" testID="journey-lightbox-close">
            <Text style={styles.lightboxBack}>← Back</Text>
          </Pressable>
          <Text style={styles.lightboxTitle} numberOfLines={1}>
            {title} · {index + 1} / {frames.length}
          </Text>
        </View>
        <Pressable style={styles.lightboxStage} onPress={next} accessibilityRole="button">
          <FrameImage frame={frame} style={styles.lightboxImage} />
        </Pressable>
        {frames.length > 1 ? (
          <View style={styles.lightboxNav}>
            <Pressable onPress={prev} style={styles.lightboxNavBtn} accessibilityRole="button">
              <Text style={styles.lightboxNavText}>Previous</Text>
            </Pressable>
            <Pressable onPress={next} style={styles.lightboxNavBtn} accessibilityRole="button">
              <Text style={styles.lightboxNavText}>Next</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function PhotoGrid({
  frames,
  label,
  note,
  testID,
  onOpen,
}: {
  frames: Frame[];
  label: string;
  note?: string;
  testID: string;
  onOpen: (index: number) => void;
}) {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const hero = frames[0];
  const rest = frames.slice(1, 8);
  const cell = wide ? (Math.min(width, 1080) - 48) / 3 : (width - 40) / 2;

  return (
    <View testID={testID}>
      <Text style={styles.sectionKicker}>{label}</Text>
      {note ? <Text style={styles.sectionNote}>{note}</Text> : null}
      {!hero ? (
        <View style={styles.missingBlock}>
          <Text style={styles.missingTitle}>Photos not published yet</Text>
          <Text style={styles.missingBody}>This stay will not borrow another property’s images.</Text>
        </View>
      ) : (
        <>
          <Pressable onPress={() => onOpen(0)} accessibilityRole="button" testID={`${testID}-hero`}>
            <FrameImage frame={hero} style={styles.propertyHero} />
          </Pressable>
          {rest.length > 0 ? (
            <View style={styles.grid}>
              {rest.map((frame, i) => (
                <Pressable key={frame.key} onPress={() => onOpen(i + 1)} accessibilityRole="button">
                  <FrameImage frame={frame} style={[styles.gridCell, { width: cell, height: cell * 0.72 }]} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

/**
 * Paired journey detail — first hotel sleep, then a second sleeping stay.
 * Sample fixtures never create reservations or payments.
 */
export default function JourneyDetailScreen() {
  const { id, hotelNights: hotelNightsParam, hotelSlug, connectedStay } = useLocalSearchParams<{
    id: string;
    hotelNights?: string;
    hotelSlug?: string;
    planDate?: string;
    connectedStay?: string;
  }>();
  const { width } = useWindowDimensions();
  const [hotelName, setHotelName] = useState("");
  const [hotelListing, setHotelListing] = useState<HotelBottleListing | null>(null);
  const [liveRow, setLiveRow] = useState<WorkspaceBottleStay | null>(null);
  const [liveMatch, setLiveMatch] = useState<BottleMatch | undefined>(undefined);
  const [bookedLine, setBookedLine] = useState<string | null>(null);
  const [bookBusy, setBookBusy] = useState(false);
  const [secondNights, setSecondNights] = useState<number | null>(null);
  const [availNote, setAvailNote] = useState<string | null>(null);
  const [availBusy, setAvailBusy] = useState(false);
  const [viewer, setViewer] = useState<{ frames: Frame[]; index: number; title: string } | null>(null);

  const plannedHotelNights = Math.max(1, Number(hotelNightsParam) || 0) || null;

  React.useEffect(() => {
    void getHotelEntry().then((entry) => {
      const slug = connectedStay === "0" ? "" : hotelSlug || entry?.slug || "";
      if (!slug) {
        setHotelName("");
        setHotelListing(null);
        return;
      }
      setHotelName(liveHotelDisplayName({ entry, slug, stayName: entry?.slug === slug ? entry.displayName : null }));
      void loadHotelBottleListing(slug).then(setHotelListing);
    });
  }, [connectedStay, hotelSlug]);

  React.useEffect(() => {
    if (typeof id !== "string") return;
    void fetchLiveBottleStay(id).then((row) => {
      if (!row || row.source !== "provider_record") {
        setLiveRow(null);
        return;
      }
      setLiveRow(row);
      const mapped = mapWorkspaceBottleStay(row, hotelName);
      if (mapped) setLiveMatch(mapped);
    });
  }, [id, hotelName]);

  const match: BottleMatch | undefined = useMemo(() => {
    const base = liveMatch
      ? withLiveHotelName(liveMatch, hotelName || liveMatch.hotel.name)
      : (() => {
          const raw = typeof id === "string" ? getBottleMatchById(id) : undefined;
          return raw ? withLiveHotelName(raw, hotelName || raw.hotel.name) : undefined;
        })();
    if (!base) return undefined;
    const withHotel = plannedHotelNights ? withPlannedHotelNights(base, plannedHotelNights) : base;
    if (secondNights != null && secondNights > 0) {
      return {
        ...withHotel,
        second: { ...withHotel.second, nights: secondNights },
        journeyNights: withHotel.hotel.nights + secondNights,
      };
    }
    return withHotel;
  }, [id, hotelName, liveMatch, plannedHotelNights, secondNights]);

  const sample = isSampleBottleMatch(match);
  const bookable =
    !sample &&
    Boolean(liveRow) &&
    liveRow?.source === "provider_record" &&
    liveRow?.available !== false &&
    (liveRow?.availableDates?.length ?? 0) > 0;

  const screenOptions = useAppBackScreenOptions({
    title: match ? match.second.name : "Journey",
    fallback: "/travelBottle" as Href,
    showBack: true,
  });

  const hotelFrames: Frame[] = useMemo(() => {
    const frames: Frame[] = [];
    for (const uri of hotelListing?.remoteGalleryUrls || []) {
      frames.push({ key: uri, remote: uri });
    }
    const local = hotelListing?.localGallery || [];
    local.forEach((src, i) => frames.push({ key: `local-${i}`, local: src }));
    return frames.slice(0, 8);
  }, [hotelListing]);

  if (!match) {
    return (
      <ScrollView contentContainerStyle={styles.missing} style={styles.screen}>
        <Stack.Screen options={screenOptions} />
        <Text style={styles.missingText}>Journey not found</Text>
      </ScrollView>
    );
  }

  const second = match.second;
  const secondUrls = [second.imageUrl, ...(second.gallery || [])].filter(
    (u, i, arr) => u && /^https?:\/\//i.test(u) && arr.indexOf(u) === i,
  );
  const secondFrames: Frame[] = secondUrls.map((uri) => ({ key: uri, remote: uri }));
  const hotelTitle = hotelListing?.whiteLabel?.title || match.hotel.name;
  const hotelArea = hotelListing?.location || match.hotel.city || "Athens";
  const rawHotelCopy = String(hotelListing?.description || "").trim();
  const hotelSummary =
    rawHotelCopy.length > 80 && !isInventedWelcome(rawHotelCopy) && !/^welcome to\b/i.test(rawHotelCopy)
      ? rawHotelCopy
      : `${hotelTitle} is the first sleep — ${nightLabel(match.hotel.nights)} in ${hotelArea}. The second sleep is a different place to stay.`;
  const tags = (hotelListing?.services?.length
    ? hotelListing.services
    : ["Breakfast", "Restaurant", "Spa", "Rooftop", "Concierge"]
  ).slice(0, 6);
  const wide = width >= 900;
  const transferLine = sample
    ? `Illustrated estimate · ${match.travelTime} · ${match.distance}. Not a live route.`
    : liveRow?.distanceMinutes
      ? `About ${liveRow.distanceMinutes} min from the hotel, as published by the stay.`
      : "Transfer time is shown when the stay publishes it.";

  const checkAvailability = () => {
    if (availBusy) return;
    if (sample) {
      setAvailNote("Sample preview. This journey is not in live inventory, so dates cannot be reserved.");
      return;
    }
    setAvailBusy(true);
    void fetchLiveBottleStay(String(id)).then((row) => {
      setAvailBusy(false);
      if (!row || row.source !== "provider_record") {
        setAvailNote("No bookable stay was returned for this journey.");
        setLiveRow(null);
        return;
      }
      setLiveRow(row);
      if (row.available === false || !(row.availableDates?.length)) {
        setAvailNote("Unavailable right now. Workspace has this stay, but no open dates to book.");
        return;
      }
      setAvailNote(`Open dates from the hotel partner: ${row.availableDates.slice(0, 4).join(", ")}.`);
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="journey-detail">
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

      <View style={[styles.page, wide && styles.pageWide]}>
        {sample ? (
          <View style={styles.sampleBanner} testID="journey-sample-banner">
            <Text style={styles.sampleBannerTitle}>Sample paired journey</Text>
            <Text style={styles.sampleBannerBody}>
              Illustrative only. These photos and prices are not a live reservation. You cannot pay
              or complete a booking from this page.
            </Text>
          </View>
        ) : null}

        <View style={styles.journeyHero} testID="journey-hero">
          <Text style={styles.heroKicker}>One journey. Two ways to stay.</Text>
          <Text style={styles.heroTitle}>{journeyNightsLabel(match)}</Text>
          <View style={[styles.steps, wide && styles.stepsWide]}>
            <View style={styles.step}>
              <Text style={styles.stepIndex}>1 · First hotel</Text>
              <Text style={styles.stepName}>{hotelTitle}</Text>
              <Text style={styles.stepMeta}>
                {hotelArea} · {nightLabel(match.hotel.nights)}
              </Text>
            </View>
            <View style={styles.step}>
              <Text style={styles.stepIndex}>2 · Transfer</Text>
              <Text style={styles.stepName}>{match.departure || "Between stays"}</Text>
              <Text style={styles.stepMeta}>{transferLine}</Text>
            </View>
            <View style={styles.step}>
              <Text style={styles.stepIndex}>3 · Second sleep</Text>
              <Text style={styles.stepName}>{second.name}</Text>
              <Text style={styles.stepMeta}>
                {second.location} · {nightLabel(second.nights)} ·{" "}
                {sample ? "Sample price · not bookable" : match.priceLabel}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>First hotel</Text>
          <Text style={styles.blockLead}>{hotelSummary}</Text>
          <PhotoGrid
            frames={hotelFrames}
            label="Property photos"
            note={
              hotelFrames.length < 4
                ? `${hotelFrames.length || "No"} photo${hotelFrames.length === 1 ? "" : "s"} published for this hotel.`
                : undefined
            }
            testID="journey-hotel-gallery"
            onOpen={(index) => setViewer({ frames: hotelFrames, index, title: hotelTitle })}
          />
          <View style={styles.chips}>
            {tags.map((t) => (
              <View key={t} style={styles.chip}>
                <Text style={styles.chipText}>{t}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Second stay</Text>
          <Text style={styles.placeName}>{second.name}</Text>
          <Text style={styles.blockLead}>{match.story}</Text>
          <PhotoGrid
            frames={secondFrames}
            label={sample ? "Sample illustrations" : "Stay photos"}
            note={
              sample
                ? "Editorial sample images for this pairing. They are not another hotel’s branding, and they are not a confirmed property gallery."
                : undefined
            }
            testID="journey-second-gallery"
            onOpen={(index) => setViewer({ frames: secondFrames, index, title: second.name })}
          />
          <View style={styles.facts}>
            <Fact label="Nights" value={nightLabel(second.nights)} />
            <Fact label="Place" value={second.location || "—"} />
            <Fact label="Price from" value={match.priceLabel} />
            {typeof liveRow?.maxGuests === "number" ? (
              <Fact label="Guests" value={String(liveRow.maxGuests)} />
            ) : null}
            {liveRow?.cancellation ? <Fact label="Policy" value={liveRow.cancellation} /> : null}
          </View>
          {second.attributes?.length ? (
            <View style={styles.chips}>
              {second.attributes.map((a) => (
                <View key={a} style={styles.chip}>
                  <Text style={styles.chipText}>{a}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <Text style={styles.nightsLabel}>Second-stay length</Text>
          <View style={styles.nightChips}>
            {[1, 2, 3].map((n) => {
              const on = (secondNights ?? second.nights) === n;
              return (
                <Pressable
                  key={n}
                  style={[styles.nightChip, on && styles.nightChipOn]}
                  onPress={() => setSecondNights(n)}
                >
                  <Text style={[styles.nightChipText, on && styles.nightChipTextOn]}>{nightLabel(n)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.ctaStack}>
          <Pressable
            style={styles.ctaAlt}
            onPress={checkAvailability}
            accessibilityRole="button"
            testID="journey-dates-cta"
          >
            <Text style={styles.ctaAltText}>
              {availBusy ? "Checking Workspace…" : match.availabilityCta}
            </Text>
          </Pressable>
          {availNote ? (
            <Text style={styles.availNote} testID="journey-availability-note">
              {availNote}
            </Text>
          ) : null}
          {bookable ? (
            <Pressable
              style={[styles.cta, bookBusy && styles.ctaMuted]}
              disabled={bookBusy}
              onPress={() => {
                if (!match || bookBusy || sample) return;
                setBookBusy(true);
                void bookBottleStayViaWorkspace({
                  stayId: match.id,
                  title: match.second.name,
                  nights: match.second.nights,
                }).then((r) => {
                  setBookBusy(false);
                  setBookedLine(r.ok ? "Your second stay is booked." : r.detail);
                });
              }}
              accessibilityRole="button"
              testID="journey-book-cta"
            >
              <Text style={styles.ctaText}>{bookBusy ? "Booking…" : bookedLine || "Book this stay"}</Text>
            </Pressable>
          ) : (
            <Text style={styles.previewLock} testID="journey-not-bookable">
              {sample
                ? "Booking stays off for sample journeys."
                : "Booking opens only when Workspace confirms open dates."}
            </Text>
          )}
        </View>
      </View>
    </ScrollView>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F5F1" },
  content: { paddingBottom: 56 },
  page: { width: "100%", maxWidth: 1080, alignSelf: "center" },
  pageWide: { paddingHorizontal: 8 },
  missing: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  missingText: { color: "#1A1510", fontSize: 16 },
  sampleBanner: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#F3EFE8",
    borderWidth: 1,
    borderColor: "#E0D8CC",
  },
  sampleBannerTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#8B6914",
  },
  sampleBannerBody: { marginTop: 6, fontSize: 14, lineHeight: 20, color: "#3A342C" },
  journeyHero: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#1A1510",
  },
  heroKicker: {
    color: "#E8C547",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  heroTitle: { color: "#FFF", fontSize: 28, fontWeight: "800", marginTop: 8 },
  steps: { marginTop: 16, gap: 12 },
  stepsWide: { flexDirection: "row" },
  step: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 12,
  },
  stepIndex: {
    color: "#E8C547",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  stepName: { color: "#FFF", fontSize: 16, fontWeight: "800", marginTop: 6 },
  stepMeta: { color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 4, lineHeight: 18 },
  block: {
    marginHorizontal: 16,
    marginTop: 22,
    padding: 16,
    backgroundColor: "#FFF",
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5DFD6",
  },
  blockTitle: { fontSize: 13, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase", color: "#8B6914" },
  placeName: { marginTop: 6, fontSize: 26, fontWeight: "800", color: "#1A1510" },
  blockLead: { marginTop: 8, fontSize: 15, lineHeight: 22, color: "#3A342C" },
  sectionKicker: {
    marginTop: 16,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: "#5A534A",
  },
  sectionNote: { marginTop: 6, fontSize: 13, lineHeight: 18, color: "#6B645A" },
  propertyHero: {
    marginTop: 12,
    width: "100%",
    height: 280,
    borderRadius: 16,
    backgroundColor: "#2A241C",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  gridCell: { borderRadius: 12, backgroundColor: "#2A241C" },
  missingBlock: {
    marginTop: 12,
    padding: 20,
    borderRadius: 16,
    backgroundColor: "#F3EFE8",
  },
  missingTitle: { fontWeight: "800", color: "#1A1510" },
  missingBody: { marginTop: 4, color: "#5A534A", lineHeight: 18 },
  missingPhoto: { backgroundColor: "#2A241C" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F3EFE8",
  },
  chipText: { fontSize: 12, fontWeight: "700", color: "#3A342C" },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  fact: {
    minWidth: 120,
    flexGrow: 1,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#F7F5F1",
  },
  factLabel: { fontSize: 11, fontWeight: "800", color: "#8B6914", textTransform: "uppercase" },
  factValue: { marginTop: 4, fontSize: 15, fontWeight: "700", color: "#1A1510" },
  nightsLabel: { marginTop: 16, fontSize: 12, fontWeight: "800", color: "#5A534A" },
  nightChips: { flexDirection: "row", gap: 8, marginTop: 8 },
  nightChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0D8CC",
  },
  nightChipOn: { backgroundColor: "#1A1510", borderColor: "#1A1510" },
  nightChipText: { fontSize: 13, fontWeight: "600", color: "#5A534A" },
  nightChipTextOn: { color: "#FFF", fontWeight: "800" },
  ctaStack: { marginTop: 20, marginHorizontal: 16, gap: 10 },
  cta: {
    backgroundColor: "#1A1510",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  ctaMuted: { opacity: 0.7 },
  ctaText: { color: "#FFF", fontWeight: "800", fontSize: 15 },
  ctaAlt: {
    backgroundColor: "#FFF",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1A1510",
  },
  ctaAltText: { color: "#1A1510", fontWeight: "800", fontSize: 15 },
  availNote: { fontSize: 14, lineHeight: 20, color: "#3A342C" },
  previewLock: { fontSize: 14, lineHeight: 20, color: "#5A534A", textAlign: "center" },
  lightbox: { flex: 1, backgroundColor: "#0E0C0A" },
  lightboxBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 10,
  },
  lightboxBack: { color: "#F7F2E8", fontWeight: "800", fontSize: 16 },
  lightboxTitle: { color: "#C4B8A0", flex: 1, fontSize: 14 },
  lightboxStage: { flex: 1, marginHorizontal: 12 },
  lightboxImage: { width: "100%", height: "100%", borderRadius: 12 },
  lightboxNav: { flexDirection: "row", justifyContent: "space-between", padding: 16 },
  lightboxNavBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#C4B8A0",
  },
  lightboxNavText: { color: "#F7F2E8", fontWeight: "700" },
});
