/**
 * City Memory — visual travel journal (photos, places, people, journeys).
 * Distinct from My Moments (`/myMoment`) — text statuses for Bottle QR discovery.
 * Sections: Memories · My Places · My People · My Journeys · Still connected · Next Journey.
 */

import { Image as ExpoImage } from "expo-image";
import { useRouter, type Href } from "expo-router";
import React, { useMemo } from "react";
import {
  Pressable,
  ScrollView,
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
import {
  humanBanditLabel,
  isInternalIdLabel,
  pluralCount,
  travelMemoryCoverUri,
  type TravelMemory,
} from "@/lib/travel-memory";

type Props = {
  model: AfterTripHomeModel;
  state: GuestLifecycleState;
  personalMoments?: TravelMemory[];
  onPlanNextTrip: () => void;
  onReactivate: () => void;
  compact?: boolean;
};

function memoryImageUri(item: CityMemoryItem): string | null {
  const meta = item.meta || {};
  for (const key of ["imageUrl", "photoUrl", "image_url", "coverUrl", "avatarUrl", "heroUrl"]) {
    const v = meta[key];
    if (typeof v === "string" && (/^https?:\/\//i.test(v.trim()) || v.trim().startsWith("data:"))) {
      return v.trim();
    }
  }
  return null;
}

function uniquePlaces(model: AfterTripHomeModel): CityMemoryItem[] {
  const seen = new Set<string>();
  const out: CityMemoryItem[] = [];
  for (const item of [...model.savedPlaces, ...model.mySpots, ...model.placesLoved]) {
    const key = item.entityId || item.id;
    if (seen.has(key)) continue;
    if (isInternalIdLabel(item.title) && !memoryImageUri(item)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function readablePeople(model: AfterTripHomeModel): CityMemoryItem[] {
  return model.followedBandits.filter((b) => !isInternalIdLabel(b.title));
}

export function AfterTripHome({
  model,
  state,
  personalMoments = [],
  onPlanNextTrip,
  onReactivate,
  compact,
}: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const go = (href: string) => router.push(href as Href);
  const showStayNotice = state === "AFTER_TRIP" || state === "NEXT_TRIP_PLANNING";
  const places = useMemo(() => uniquePlaces(model), [model]);
  const people = useMemo(() => readablePeople(model), [model]);
  const journeys = model.destinationsVisited.filter((d) => !isInternalIdLabel(d.title));
  const thumbW = Math.min(148, Math.max(120, width * 0.36));

  const hasAnyMemory =
    personalMoments.length > 0 || places.length > 0 || people.length > 0 || journeys.length > 0;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]} testID="city-memory-home">
      <Text style={styles.kicker}>City Memory</Text>
      <Text style={styles.title}>{model.memoryTitle}</Text>
      <Text style={styles.lead}>
        Your visual travel journal — photos, saved places, people and cities. Private by default.
        Personal Bottle messages live in My Moments.
      </Text>

      <HotelCheckoutInvite visible={showStayNotice} onConnectStay={onReactivate} />

      <Pressable
        style={styles.addMemoryCta}
        onPress={() => go("/memory/add")}
        accessibilityRole="button"
        accessibilityLabel="Add a Memory"
        testID="city-memory-add-memory"
      >
        <Text style={styles.addMemoryCtaTitle}>Add a Memory</Text>
        <Text style={styles.addMemoryCtaDetail}>Photos, video, story, place and date</Text>
      </Pressable>

      {/* MEMORIES — visual journal (not My Moments text statuses) */}
      <SectionHeader
        title="Memories"
        actionLabel={personalMoments.length ? "Add another" : undefined}
        onAction={personalMoments.length ? () => go("/memory/add") : undefined}
      />
      {personalMoments.length === 0 ? (
        <EmptyRail
          title="No memories yet"
          body="Capture a place, a face, a night — photos and stories stay in City Memory."
          cta="Add your first Memory"
          onPress={() => go("/memory/add")}
          testID="city-memory-moments-empty"
        />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
          testID="city-memory-moments-rail"
        >
          {personalMoments.slice(0, 12).map((m) => {
            const cover = travelMemoryCoverUri(m);
            return (
              <Pressable
                key={m.id}
                style={[styles.momentCard, { width: thumbW }]}
                onPress={() => go(`/memory/${encodeURIComponent(m.id)}`)}
                accessibilityRole="button"
                testID={`city-memory-moment-${m.id}`}
              >
                <View style={styles.momentMedia}>
                  {cover ? (
                    <ExpoImage
                      source={{ uri: cover }}
                      style={StyleSheet.absoluteFillObject}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.momentMediaFallback}>
                      <Text style={styles.momentMediaFallbackText}>Story</Text>
                    </View>
                  )}
                  <View style={styles.privatePill}>
                    <Text style={styles.privatePillText}>Private</Text>
                  </View>
                </View>
                <Text style={styles.momentTitle} numberOfLines={2}>
                  {m.title}
                </Text>
                <Text style={styles.momentMeta} numberOfLines={1}>
                  {[m.placeLabel || m.city, m.occurredAt.slice(0, 10)].filter(Boolean).join(" · ")}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* MY PLACES */}
      <SectionHeader
        title="My Places"
        actionLabel={places.length ? "My Spots" : undefined}
        onAction={places.length ? () => go("/mySpots") : undefined}
      />
      {places.length === 0 ? (
        <EmptyRail
          title="No saved places yet"
          body="Heart a spot in Explore — it gathers here. Saving is not the same as visiting."
          cta="Explore places"
          onPress={() => go("/explore")}
          testID="city-memory-places-empty"
        />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          {places.slice(0, 16).map((p) => {
            const img = memoryImageUri(p);
            return (
              <Pressable
                key={p.id}
                style={[styles.placeCard, { width: thumbW }]}
                onPress={() => go("/mySpots")}
                accessibilityRole="button"
                testID={`city-memory-place-${p.id}`}
              >
                <View style={[styles.placeMedia, !img && styles.placeMediaMuted]}>
                  {img ? (
                    <ExpoImage
                      source={{ uri: img }}
                      style={StyleSheet.absoluteFillObject}
                      contentFit="cover"
                    />
                  ) : null}
                </View>
                <Text style={styles.placeTitle} numberOfLines={2}>
                  {p.title}
                </Text>
                <Text style={styles.placeMeta} numberOfLines={1}>
                  {[p.neighborhood, p.city].filter(Boolean).join(" · ") || "Saved"}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* MY PEOPLE */}
      <SectionHeader
        title="My People"
        actionLabel={people.length ? "Following" : undefined}
        onAction={people.length ? () => go("/following") : undefined}
      />
      {people.length === 0 ? (
        <EmptyRail
          title="No followed banDits yet"
          body="Follow a Local banDit you trust — their name and face appear here."
          cta="Meet Local banDits"
          onPress={() => go("/bandits")}
          testID="city-memory-people-empty"
        />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          {people.slice(0, 16).map((b) => {
            const img = memoryImageUri(b);
            const name = humanBanditLabel(b.title);
            return (
              <Pressable
                key={b.id}
                style={styles.personCard}
                onPress={() =>
                  b.entityId
                    ? go(`/bandit/${encodeURIComponent(b.entityId)}`)
                    : go("/following")
                }
                accessibilityRole="button"
                testID={`city-memory-person-${b.id}`}
              >
                <View style={styles.avatar}>
                  {img ? (
                    <ExpoImage
                      source={{ uri: img }}
                      style={StyleSheet.absoluteFillObject}
                      contentFit="cover"
                    />
                  ) : (
                    <Text style={styles.avatarInitial}>{name.slice(0, 1).toUpperCase()}</Text>
                  )}
                </View>
                <Text style={styles.personName} numberOfLines={2}>
                  {name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      {people.length > 0 ? (
        <Text style={styles.countLine}>{pluralCount(people.length, "banDit")}</Text>
      ) : null}

      {/* MY JOURNEYS */}
      <SectionHeader title="My Journeys" />
      {journeys.length === 0 && !model.bottleJourneys.length ? (
        <EmptyRail
          title="Journeys appear as you travel"
          body="Cities from real stays and plans gather here — never invented visits."
          cta="Plan Your Next Trip"
          onPress={onPlanNextTrip}
          testID="city-memory-journeys-empty"
        />
      ) : (
        <View style={styles.journeyList} testID="city-memory-journeys">
          {journeys.map((j) => (
            <View key={j.id} style={styles.journeyRow}>
              <Text style={styles.journeyCity}>{j.title}</Text>
              <Text style={styles.journeyMeta}>{j.subtitle || "In your travel story"}</Text>
            </View>
          ))}
          {model.bottleJourneys.slice(0, 4).map((j) => (
            <View key={j.id} style={styles.journeyRow}>
              <Text style={styles.journeyCity}>{j.title}</Text>
              <Text style={styles.journeyMeta}>{j.subtitle || "Travel in a Bottle"}</Text>
            </View>
          ))}
        </View>
      )}

      {!hasAnyMemory ? (
        <GuestDiscoveryCard
          promptId="home_city_memory"
          eyebrow="Start your journal"
          title="Your journey lives here"
          body="Add a Memory, save a place, or follow a Local banDit — City Memory grows with you."
          cta="Add a Memory"
          href="/memory/add"
        />
      ) : null}

      {/* STILL CONNECTED */}
      <SectionHeader title="Still connected" />
      <View style={styles.linkRow}>
        <LinkChip label="Following" onPress={() => go("/following")} />
        <LinkChip label="Chat" onPress={() => go("/community")} />
        <LinkChip label="My Moments" onPress={() => go("/myMoment")} />
        <LinkChip label="Impact" onPress={() => go("/impact")} />
        <LinkChip label="Experiences" onPress={() => go("/experiences")} />
      </View>

      {/* NEXT JOURNEY */}
      <SectionHeader title="Where to next?" />
      <Pressable
        style={styles.primaryNext}
        onPress={onPlanNextTrip}
        accessibilityRole="button"
        testID="city-memory-plan-next"
      >
        <Text style={styles.primaryNextTitle}>Plan Your Next Trip</Text>
        <Text style={styles.primaryNextDetail}>
          Opens Travel in a Bottle — Mix Sleeping Experiences. Editorial inspiration stays separate
          from live bookable stays.
        </Text>
      </Pressable>
      <Pressable
        style={styles.secondaryNext}
        onPress={() => go("/travelBottle")}
        accessibilityRole="button"
        testID="city-memory-bottle"
      >
        <Text style={styles.secondaryNextTitle}>Travel in a Bottle</Text>
        <Text style={styles.secondaryNextDetail}>Shape the trip while City Memory stays with you.</Text>
      </Pressable>

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

function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function EmptyRail({
  title,
  body,
  cta,
  onPress,
  testID,
}: {
  title: string;
  body: string;
  cta: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <View style={styles.emptyRail} testID={testID}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      <Pressable style={styles.emptyCta} onPress={onPress} accessibilityRole="button">
        <Text style={styles.emptyCtaText}>{cta}</Text>
      </Pressable>
    </View>
  );
}

function LinkChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.linkChip} onPress={onPress} accessibilityRole="button">
      <Text style={styles.linkChipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16, paddingBottom: 28, paddingTop: 4 },
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
    fontFamily: "Georgia",
  },
  lead: {
    fontSize: 15,
    lineHeight: 22,
    color: color.muted,
    marginTop: -4,
    maxWidth: 480,
  },
  addMemoryCta: {
    marginTop: 4,
    backgroundColor: color.ink,
    borderRadius: radius.lg,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  addMemoryCtaTitle: { color: "#FFF", fontSize: 17, fontWeight: "800" },
  addMemoryCtaDetail: { color: "rgba(255,255,255,0.72)", marginTop: 4, fontSize: 13 },
  sectionHead: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: color.ink,
    letterSpacing: -0.3,
    fontFamily: "Georgia",
  },
  sectionAction: { fontSize: 13, fontWeight: "700", color: color.brand },
  rail: { gap: 12, paddingVertical: 4 },
  momentCard: { gap: 6 },
  momentMedia: {
    width: "100%",
    aspectRatio: 4 / 5,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: "#E8E4DC",
  },
  momentMediaFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D9D2C5",
  },
  momentMediaFallbackText: { fontSize: 13, fontWeight: "700", color: "#5A5348" },
  privatePill: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  privatePillText: { fontSize: 10, fontWeight: "800", color: "#222" },
  momentTitle: { fontSize: 14, fontWeight: "700", color: color.ink, lineHeight: 18 },
  momentMeta: { fontSize: 11, color: color.muted },
  placeCard: { gap: 6 },
  placeMedia: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: "#E0DCD3",
  },
  placeMediaMuted: { backgroundColor: "#E8E4DC" },
  placeTitle: { fontSize: 14, fontWeight: "700", color: color.ink },
  placeMeta: { fontSize: 11, color: color.muted },
  personCard: { width: 88, alignItems: "center", gap: 6 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: "hidden",
    backgroundColor: "#DDD7CC",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 22, fontWeight: "800", color: "#5A5348" },
  personName: { fontSize: 12, fontWeight: "700", color: color.ink, textAlign: "center" },
  countLine: { fontSize: 12, color: color.muted, marginTop: -4 },
  journeyList: { gap: 10 },
  journeyRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: "#F3EFE6",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  journeyCity: { fontSize: 16, fontWeight: "800", color: color.ink },
  journeyMeta: { marginTop: 2, fontSize: 12, color: color.muted },
  emptyRail: {
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: "#F3EFE6",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: color.ink },
  emptyBody: { fontSize: 13, lineHeight: 19, color: color.muted },
  emptyCta: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: color.ink,
  },
  emptyCtaText: { color: "#FFF", fontWeight: "700", fontSize: 13 },
  linkRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  linkChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F3EFE6",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  linkChipText: { fontSize: 13, fontWeight: "700", color: color.ink },
  primaryNext: {
    backgroundColor: color.ink,
    borderRadius: radius.lg,
    padding: 18,
  },
  primaryNextTitle: { color: "#FFF", fontSize: 17, fontWeight: "800" },
  primaryNextDetail: { color: "rgba(255,255,255,0.72)", marginTop: 6, fontSize: 13, lineHeight: 18 },
  secondaryNext: {
    borderRadius: radius.lg,
    padding: 16,
    backgroundColor: "#F3EFE6",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  secondaryNextTitle: { fontSize: 15, fontWeight: "800", color: color.ink },
  secondaryNextDetail: { marginTop: 4, fontSize: 12, color: color.muted, lineHeight: 17 },
  connectGhost: { marginTop: 4, paddingVertical: 10 },
  connectGhostText: { color: color.ink, fontWeight: "700", textDecorationLine: "underline" },
});
