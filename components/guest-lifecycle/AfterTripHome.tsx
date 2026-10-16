/**
 * City Memory — permanent personal travel space (Between Trips presentation).
 * Three sections: Memories · Still Connected · Where to Next.
 * Preserves existing routes, data, and lifecycle permissions.
 */

import { Image as ExpoImage } from "expo-image";
import { useRouter, type Href } from "expo-router";
import React, { useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { GuestDiscoveryCard } from "@/components/GuestDiscoveryCard";
import { HotelCheckoutInvite } from "@/components/guest-lifecycle/HotelCheckoutInvite";
import type { AfterTripHomeModel } from "@/lib/guest-lifecycle/city-memory";
import type { CityMemoryItem, GuestLifecycleState } from "@/lib/guest-lifecycle/types";
import { color, radius } from "@/lib/guestDesign";

type Props = {
  model: AfterTripHomeModel;
  state: GuestLifecycleState;
  onPlanNextTrip: () => void;
  onReactivate: () => void;
  compact?: boolean;
};

function memoryImageUri(item: CityMemoryItem): string | null {
  const meta = item.meta || {};
  for (const key of ["imageUrl", "photoUrl", "image_url", "coverUrl", "avatarUrl", "heroUrl"]) {
    const v = meta[key];
    if (typeof v === "string" && /^https?:\/\//i.test(v.trim())) return v.trim();
  }
  return null;
}

function uniquePlaces(model: AfterTripHomeModel): CityMemoryItem[] {
  const seen = new Set<string>();
  const out: CityMemoryItem[] = [];
  for (const item of [...model.savedPlaces, ...model.mySpots, ...model.placesLoved]) {
    const key = item.entityId || item.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function AfterTripHome({ model, state, onPlanNextTrip, onReactivate, compact }: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const go = (href: string) => router.push(href as Href);
  const showStayNotice = state === "AFTER_TRIP" || state === "NEXT_TRIP_PLANNING";
  const places = useMemo(() => uniquePlaces(model), [model]);
  const cardW = width >= 900 ? (Math.min(width, 1100) - 64) / 3 - 10 : width >= 640 ? (width - 56) / 2 - 8 : width - 48;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]} testID="city-memory-home">
      <Text style={styles.kicker}>City Memory</Text>
      <Text style={styles.title}>{model.memoryTitle}</Text>
      <Text style={styles.lead}>Your places, people, and next journeys — always yours.</Text>

      <HotelCheckoutInvite visible={showStayNotice} onConnectStay={onReactivate} />

      <GuestDiscoveryCard
        promptId="home_my_moments"
        eyebrow="Keep the story going"
        title="Update My Moments"
        body="A short daily Moment can reach the next traveler through a bottle — when you choose to share."
        cta="Open My Moments"
        href="/myMoment"
      />

      {/* A — YOUR TRAVEL MEMORIES */}
      <SectionHeader title="Your travel memories" />
      <View style={styles.cardRow}>
        <MemoryCard
          width={cardW}
          label="Places"
          title={places.length ? `${places.length} saved` : "Saved places"}
          detail={
            places.length
              ? places
                  .slice(0, 2)
                  .map((p) => p.title)
                  .join(" · ")
              : "Spots you save will gather here."
          }
          imageUri={places[0] ? memoryImageUri(places[0]) : null}
          accent="#2A4A3A"
          onPress={() => go("/mySpots")}
          testID="city-memory-places"
        />
        <MemoryCard
          width={cardW}
          label="Loved"
          title={model.placesLoved.length ? `${model.placesLoved.length} you loved` : "Places you loved"}
          detail={
            model.placesLoved.length
              ? model.placesLoved[0]!.title
              : "Mark favorites as you explore."
          }
          imageUri={model.placesLoved[0] ? memoryImageUri(model.placesLoved[0]) : null}
          accent="#6B3A2A"
          onPress={() => go("/mySpots")}
          testID="city-memory-loved"
        />
        <MemoryCard
          width={cardW}
          label="Moments"
          title="Travel moments"
          detail="Photos and notes from the road."
          imageUri={null}
          accent="#1A2A4A"
          onPress={() => go("/myMoment")}
          testID="city-memory-moments"
        />
        <MemoryCard
          width={cardW}
          label="Cities"
          title={
            model.destinationsVisited.length
              ? `${model.destinationsVisited.length} cities`
              : "Cities visited"
          }
          detail={
            model.destinationsVisited.length
              ? model.destinationsVisited.map((d) => d.title || d.city).join(" · ")
              : "Cities you visit will appear here."
          }
          imageUri={model.destinationsVisited[0] ? memoryImageUri(model.destinationsVisited[0]) : null}
          accent="#3A2A4A"
          onPress={() => go("/explore")}
          testID="city-memory-cities"
        />
      </View>

      {places.length > 0 ? (
        <View style={styles.previewRail}>
          {places.slice(0, 6).map((p) => (
            <Pressable
              key={p.id}
              style={[styles.previewChip, { width: Math.min(160, cardW) }]}
              onPress={() => go("/mySpots")}
              accessibilityRole="button"
            >
              <Text style={styles.previewChipTitle} numberOfLines={2}>
                {p.title}
              </Text>
              <Text style={styles.previewChipMeta} numberOfLines={1}>
                {[p.neighborhood, p.city].filter(Boolean).join(" · ") || "Saved"}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* B — STILL CONNECTED */}
      <SectionHeader title="Still connected" />
      <View style={styles.cardRow}>
        <MemoryCard
          width={cardW}
          label="Following"
          title={
            model.followedBandits.length
              ? `${model.followedBandits.length} banDits`
              : "Followed Local banDits"
          }
          detail={
            model.followedBandits.length
              ? model.followedBandits
                  .slice(0, 2)
                  .map((b) => b.title)
                  .join(" · ")
              : "Follows continue after checkout."
          }
          imageUri={model.followedBandits[0] ? memoryImageUri(model.followedBandits[0]) : null}
          accent="#111111"
          onPress={() => go("/following")}
          testID="city-memory-following"
        />
        {model.discoveryPicks.map((d) => (
          <MemoryCard
            key={d.id}
            width={cardW}
            label="Discover"
            title={d.title}
            detail={d.detail}
            imageUri={null}
            accent="#3A3A3A"
            onPress={() => go(d.href)}
            testID={`city-memory-disc-${d.id}`}
          />
        ))}
        <MemoryCard
          width={cardW}
          label="Chat"
          title="Keep the conversation"
          detail="Threads with locals stay in your inbox."
          imageUri={null}
          accent="#2A2A2A"
          onPress={() => go("/community")}
          testID="city-memory-chat"
        />
      </View>

      {/* C — WHERE TO NEXT? */}
      <SectionHeader title="Where to next?" />
      <Pressable
        style={styles.primaryNext}
        onPress={onPlanNextTrip}
        accessibilityRole="button"
        testID="city-memory-plan-next"
      >
        <Text style={styles.primaryNextTitle}>Plan Your Next Trip</Text>
        <Text style={styles.primaryNextDetail}>
          {model.nextTripIdeas[0]?.detail || "Start from memory — not from zero."}
        </Text>
      </Pressable>

      <View style={styles.cardRow}>
        <MemoryCard
          width={cardW}
          label="Bottle"
          title="Travel in a Bottle"
          detail="Shape the trip while City Memory stays with you."
          imageUri={null}
          accent="#4A2A1A"
          onPress={() => go("/travelBottle")}
          testID="city-memory-bottle"
        />
        {model.similarCities.map((c) => (
          <MemoryCard
            key={c.id}
            width={cardW}
            label="Idea"
            title={c.title}
            detail={c.detail}
            imageUri={null}
            accent="#1A3A4A"
            onPress={() => go("/explore")}
            testID={`city-memory-city-${c.id}`}
          />
        ))}
      </View>

      {showStayNotice ? (
        <Pressable
          style={styles.connectGhost}
          onPress={onReactivate}
          accessibilityRole="button"
          testID="city-memory-connect-footer"
        >
          <Text style={styles.connectGhostText}>Connect a New Stay</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function MemoryCard({
  width,
  label,
  title,
  detail,
  imageUri,
  accent,
  onPress,
  testID,
}: {
  width: number;
  label: string;
  title: string;
  detail: string;
  imageUri: string | null;
  accent: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      style={[styles.memCard, { width }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      testID={testID}
    >
      <View style={[styles.memMedia, { backgroundColor: accent }]}>
        {imageUri ? (
          <ExpoImage source={{ uri: imageUri }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
        ) : (
          <Text style={styles.memInitial}>{title.slice(0, 1).toUpperCase()}</Text>
        )}
        <View style={styles.memLabelPill}>
          <Text style={styles.memLabelText}>{label}</Text>
        </View>
      </View>
      <Text style={styles.memTitle} numberOfLines={2}>
        {title}
      </Text>
      <Text style={styles.memDetail} numberOfLines={2}>
        {detail}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 18,
    paddingBottom: 28,
    paddingTop: 4,
  },
  wrapCompact: { paddingTop: 4 },
  kicker: {
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: color.brand,
    fontWeight: "800",
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: color.ink,
    letterSpacing: -0.6,
    lineHeight: 36,
  },
  lead: {
    fontSize: 15,
    lineHeight: 22,
    color: color.muted,
    marginTop: -6,
    maxWidth: 420,
  },
  sectionHead: {
    marginTop: 10,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: color.ink,
    letterSpacing: -0.3,
  },
  cardRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  memCard: {
    marginBottom: 4,
  },
  memMedia: {
    width: "100%",
    aspectRatio: 4 / 5,
    borderRadius: radius.xl,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  memInitial: {
    fontSize: 42,
    fontWeight: "800",
    color: "rgba(255,255,255,0.88)",
  },
  memLabelPill: {
    position: "absolute",
    left: 10,
    top: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  memLabelText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  memTitle: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: "800",
    color: color.ink,
  },
  memDetail: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    color: color.muted,
  },
  previewRail: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  previewChip: {
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderRadius: radius.md,
    padding: 12,
  },
  previewChipTitle: { fontSize: 13, fontWeight: "700", color: color.ink },
  previewChipMeta: { marginTop: 4, fontSize: 11, color: color.muted },
  primaryNext: {
    backgroundColor: color.ink,
    borderRadius: radius.xl,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  primaryNextTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: -0.4,
  },
  primaryNextDetail: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.75)",
  },
  connectGhost: {
    marginTop: 8,
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  connectGhostText: {
    fontSize: 14,
    fontWeight: "700",
    color: color.ink,
    textDecorationLine: "underline",
  },
});
