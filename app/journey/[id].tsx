import { Image as ExpoImage } from "expo-image";
import { Stack, useLocalSearchParams, type Href } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Image,
  type ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import { fetchLiveBottleStay, mapWorkspaceBottleStay, bookBottleStayViaWorkspace } from "@/lib/guest-workspace/liveBottle";
import { getBottleMatchById, journeyNightsLabel, withLiveHotelName, type BottleMatch } from "@/lib/guest-workspace/productWorlds";
import { liveHotelDisplayName } from "@/lib/stay/liveHotelIdentity";
import { getHotelWhiteLabel } from "@/lib/hotelWhiteLabel";
import { getHotelEntry } from "@/lib/pilotSession";

function nightLabel(n: number) {
  return `${n} night${n === 1 ? "" : "s"}`;
}

/**
 * Paired journey detail â€” trip planning framing.
 * Second stay is the visual destination hero; hotel is pairing context.
 */
export default function JourneyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const [hotelName, setHotelName] = useState("");
  const [hotelHero, setHotelHero] = useState<ImageSourcePropType | null>(null);
  const [availabilityChecked, setAvailabilityChecked] = useState(false);
  const [liveMatch, setLiveMatch] = useState<BottleMatch | undefined>(undefined);
  const [bookedLine, setBookedLine] = useState<string | null>(null);
  const [bookBusy, setBookBusy] = useState(false);

  React.useEffect(() => {
    void getHotelEntry().then((entry) => {
      const h = getHotelWhiteLabel(entry?.slug ?? "");
      setHotelName(liveHotelDisplayName({ entry, slug: entry?.slug }));
      if (h?.introHeroSource) setHotelHero(h.introHeroSource);
    });
  }, []);

  React.useEffect(() => {
    if (typeof id !== "string") return;
    void fetchLiveBottleStay(id).then((row) => {
      if (row) setLiveMatch(mapWorkspaceBottleStay(row, hotelName));
    });
  }, [id, hotelName]);

  const match: BottleMatch | undefined = useMemo(() => {
    if (liveMatch) return withLiveHotelName(liveMatch, hotelName);
    const raw = typeof id === "string" ? getBottleMatchById(id) : undefined;
    return raw ? withLiveHotelName(raw, hotelName) : undefined;
  }, [id, hotelName, liveMatch]);

  const screenOptions = useAppBackScreenOptions({
    title: match ? match.second.name : "Journey",
    fallback: "/travelBottle" as Href,
    showBack: true,
  });

  if (!match) {
    return (
      <ScrollView contentContainerStyle={styles.missing} style={styles.screen}>
        <Stack.Screen options={screenOptions} />
        <Text style={styles.missingText}>Journey not found</Text>
      </ScrollView>
    );
  }

  const second = match.second;
  const gallery = second.gallery ?? [];
  const attrs = second.attributes ?? [];
  const heroMaxW = Math.min(width - 24, 720);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={screenOptions} />

      {/* One journey pairing strip */}
      <View style={styles.journeyStrip}>
        <View style={styles.stripStay}>
          {hotelHero ? (
            <Image source={hotelHero} style={styles.stripThumb} resizeMode="cover" />
          ) : (
            <View style={[styles.stripThumb, styles.stripThumbFallback]} />
          )}
          <View style={styles.stripCopy}>
            <Text style={styles.stripLabel}>Hotel stay</Text>
            <Text style={styles.stripName} numberOfLines={1}>
              {match.hotel.name}
            </Text>
            <Text style={styles.stripMeta}>
              {nightLabel(match.hotel.nights)} Â· {match.hotel.city ?? "Athens"}
            </Text>
          </View>
        </View>

        <View style={styles.stripCenter}>
          <Text style={styles.livePill}>PAIRED</Text>
          <Text style={styles.stripArrow}>â†“</Text>
          <Text style={styles.stripStat}>{journeyNightsLabel(match)}</Text>
          <Text style={styles.stripSub}>{match.travelTime}</Text>
        </View>

        <View style={styles.stripStay}>
          <ExpoImage
            source={{ uri: second.imageUrl }}
            style={styles.stripThumb}
            contentFit="cover"
          />
          <View style={styles.stripCopy}>
            <Text style={styles.stripLabelNext}>Second stay</Text>
            <Text style={styles.stripName} numberOfLines={1}>
              {second.name}
            </Text>
            <Text style={styles.stripMeta}>
              {nightLabel(second.nights)} Â· {second.location}
            </Text>
          </View>
        </View>
      </View>

      {/* Second stay = visual hero â€” premium 4:3 */}
      <View
        style={[
          styles.hero,
          { maxWidth: heroMaxW, alignSelf: "center", width: width - 24 },
          width - 24 >= 360 && styles.heroMin,
        ]}
      >
        <ExpoImage
          source={{ uri: second.imageUrl }}
          style={styles.heroImage}
          contentFit="cover"
        />
        <View style={styles.heroScrim} />
        <View style={styles.heroCopy}>
          <Text style={styles.heroKicker}>Add a second stay</Text>
          <Text style={styles.heroEmoji}>{second.emoji}</Text>
          <Text style={styles.heroName}>{second.name}</Text>
          <Text style={styles.heroMeta}>
            {second.type ? `${second.type} Â· ` : ""}
            {second.location}
            {" Â· "}
            {nightLabel(second.nights)}
            {second.rating != null ? ` Â· â˜… ${second.rating.toFixed(2)}` : ""}
          </Text>
          <Text style={styles.heroPrice}>{match.priceLabel}</Text>
        </View>
      </View>

      {/* Explicit pairing readout */}
      <View style={styles.pairingBlock}>
        <Text style={styles.pairHotel}>{match.hotel.name}</Text>
        <Text style={styles.pairMeta}>
          {nightLabel(match.hotel.nights)} Â· {match.hotel.city ?? "Athens"}
        </Text>
        <Text style={styles.pairArrow}>â†“</Text>
        <Text style={styles.pairSecond}>{second.name}</Text>
        <Text style={styles.pairMeta}>
          {nightLabel(second.nights)} Â· {second.location}
        </Text>
        <Text style={styles.journeyTotal}>{journeyNightsLabel(match)}</Text>
      </View>

      {attrs.length > 0 ? (
        <Text style={styles.attrs}>{attrs.join(" Â· ")}</Text>
      ) : null}

      <View style={styles.panel}>
        {second.host ? (
          <>
            <Text style={styles.panelLabel}>Host</Text>
            <Text style={styles.panelValue}>{second.host}</Text>
          </>
        ) : null}
        {second.type ? (
          <>
            <Text style={[styles.panelLabel, styles.panelGap]}>Stay type</Text>
            <Text style={styles.panelValue}>{second.type}</Text>
          </>
        ) : null}
        {second.location ? (
          <>
            <Text style={[styles.panelLabel, styles.panelGap]}>Location</Text>
            <Text style={styles.panelValue}>{second.location}</Text>
          </>
        ) : null}
        {second.availability ? (
          <>
            <Text style={[styles.panelLabel, styles.panelGap]}>Availability</Text>
            <Text style={styles.panelValue}>{second.availability}</Text>
          </>
        ) : null}
      </View>

      <View style={styles.travelRow}>
        <View style={styles.travelCell}>
          <Text style={styles.travelLabel}>Travel time</Text>
          <Text style={styles.travelValue}>{match.travelTime}</Text>
        </View>
        <View style={styles.travelCell}>
          <Text style={styles.travelLabel}>Distance</Text>
          <Text style={styles.travelValue}>{match.distance}</Text>
        </View>
        <View style={styles.travelCell}>
          <Text style={styles.travelLabel}>From hotel</Text>
          <Text style={styles.travelValue} numberOfLines={1}>
            {match.hotel.name}
          </Text>
        </View>
      </View>

      <View style={styles.storyBlock}>
        <Text style={styles.whyLabel}>This journey</Text>
        <Text style={styles.story}>{match.story}</Text>
      </View>

      {gallery.length > 0 ? (
        <View style={styles.galleryBlock}>
          <Text style={styles.galleryLabel}>Gallery</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.galleryRow}
          >
            {gallery.map((uri) => (
              <ExpoImage
                key={uri}
                source={{ uri }}
                style={styles.galleryImage}
                contentFit="cover"
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {match.filterTags.length > 0 ? (
        <View style={styles.tags}>
          {match.filterTags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.ctaStack}>
        <Pressable
          style={[styles.cta, bookBusy && styles.ctaAlt]}
          onPress={() => {
            if (!match || bookBusy) return;
            setBookBusy(true);
            void bookBottleStayViaWorkspace({ stayId: match.id, title: match.second.name }).then((r) => {
              setBookBusy(false);
              if (!r.ok) {
                setBookedLine(r.detail);
                return;
              }
              setBookedLine("Your second stay is booked — host notified.");
              setAvailabilityChecked(true);
            });
          }}
          accessibilityRole="button"
          accessibilityLabel="Book this sleeping stay"
        >
          <Text style={styles.ctaText}>{bookBusy ? "Booking…" : bookedLine || "Book this stay"}</Text>
        </Pressable>
        <Pressable
          style={[styles.ctaAlt, availabilityChecked && styles.ctaDone]}
          onPress={() => setAvailabilityChecked(true)}
          accessibilityRole="button"
          accessibilityLabel={match.availabilityCta}
        >
          <Text style={[styles.ctaAltText, availabilityChecked && styles.ctaDoneText]}>
            {availabilityChecked ? "Dates open — ready to combine stays" : match.availabilityCta}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F5F1" },
  content: { paddingBottom: 48 },
  missing: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  missingText: { color: "#1A1510", fontSize: 16 },

  journeyStrip: {
    marginHorizontal: 12,
    marginTop: 12,
    flexDirection: "row",
    backgroundColor: "#1A1510",
    borderRadius: 16,
    overflow: "hidden",
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 4,
  },
  stripStay: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
  },
  stripThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#2A241C",
  },
  stripThumbFallback: { backgroundColor: "#3A3228" },
  stripCopy: { marginTop: 6, alignItems: "center", paddingHorizontal: 2 },
  stripLabel: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "rgba(232,197,71,0.75)",
  },
  stripLabelNext: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#E8C547",
  },
  stripName: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFF",
    marginTop: 2,
    textAlign: "center",
  },
  stripMeta: {
    fontSize: 9,
    color: "rgba(255,255,255,0.65)",
    marginTop: 2,
    textAlign: "center",
  },
  stripCenter: {
    width: 88,
    alignItems: "center",
    justifyContent: "center",
  },
  livePill: {
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 0.3,
    color: "#1A1510",
    backgroundColor: "#E8C547",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  stripArrow: {
    fontSize: 16,
    fontWeight: "800",
    color: "#E8C547",
    marginVertical: 2,
  },
  stripStat: { fontSize: 10, fontWeight: "800", color: "#FFF", textAlign: "center" },
  stripSub: { fontSize: 9, color: "rgba(255,255,255,0.65)", marginTop: 1 },

  hero: {
    marginTop: 12,
    marginHorizontal: 12,
    aspectRatio: 4 / 3,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#1A1510",
  },
  heroMin: { minHeight: 280 },
  heroImage: { ...StyleSheet.absoluteFillObject },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(20,14,8,0.42)",
  },
  heroCopy: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 18,
  },
  heroKicker: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#E8C547",
    marginBottom: 4,
  },
  heroEmoji: { fontSize: 22, marginBottom: 4 },
  heroName: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFF",
    lineHeight: 32,
  },
  heroMeta: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    marginTop: 6,
  },
  heroPrice: {
    marginTop: 10,
    fontSize: 22,
    fontWeight: "800",
    color: "#E8C547",
  },

  pairingBlock: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    backgroundColor: "#FFF",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5DFD6",
  },
  pairHotel: { fontSize: 17, fontWeight: "800", color: "#1A1510" },
  pairSecond: { fontSize: 17, fontWeight: "800", color: "#1A1510" },
  pairMeta: { fontSize: 13, color: "#6B645A", marginTop: 3 },
  pairArrow: {
    fontSize: 18,
    fontWeight: "800",
    color: "#8B6914",
    marginVertical: 6,
  },
  journeyTotal: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: "800",
    color: "#8B6914",
  },
  attrs: {
    marginHorizontal: 16,
    marginTop: 12,
    fontSize: 13,
    color: "#5A534A",
    lineHeight: 19,
  },

  panel: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    backgroundColor: "#FFF",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5DFD6",
  },
  panelLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#8B6914",
  },
  panelGap: { marginTop: 12 },
  panelValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1510",
    marginTop: 4,
  },

  travelRow: {
    marginHorizontal: 16,
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  travelCell: {
    flex: 1,
    backgroundColor: "#1A1510",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  travelLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: "rgba(232,197,71,0.8)",
  },
  travelValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFF",
    marginTop: 4,
  },

  storyBlock: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  whyLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#8B6914",
  },
  story: {
    fontSize: 15,
    lineHeight: 22,
    color: "#3A342C",
    marginTop: 6,
  },

  galleryBlock: { marginTop: 18 },
  galleryLabel: {
    marginHorizontal: 16,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#8B6914",
    marginBottom: 10,
  },
  galleryRow: {
    paddingHorizontal: 16,
    gap: 10,
  },
  galleryImage: {
    width: 160,
    aspectRatio: 4 / 3,
    borderRadius: 12,
    backgroundColor: "#2A241C",
  },

  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
    marginHorizontal: 16,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E0D8CC",
  },
  tagText: { fontSize: 11, fontWeight: "600", color: "#5A534A" },

  ctaStack: {
    marginTop: 22,
    marginHorizontal: 16,
    gap: 10,
  },
  cta: {
    backgroundColor: "#E03131",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  ctaText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
    textAlign: "center",
  },
  ctaAlt: {
    backgroundColor: "#181818",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  ctaAltText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
    textAlign: "center",
  },
  ctaDone: { backgroundColor: "#2F5D3A" },
  ctaDoneText: { color: "#FFF" },
});
