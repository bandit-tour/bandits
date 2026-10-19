import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { useRouter, type Href } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import {
  partnerMatchesSmartTravelerFilter,
  SMART_TRAVELER_FILTER_CHIPS,
  type SmartTravelerFilterChip,
  type SmartTravelerPartner,
} from "@/lib/guest-workspace/productWorlds";
import {
  fetchLiveSmartTravelers,
  mergeSmartTravelerCatalog,
  type SmartTravelerCatalogEntry,
} from "@/lib/guest-workspace/liveSmartTraveler";
import { useGuestLifecycle } from "@/lib/guest-lifecycle/useGuestLifecycle";
import { can } from "@/lib/guest-lifecycle/access";
import { color, radius } from "@/lib/guestDesign";
import {
  cardWidthForColumns,
  ImageRatio,
  imageFocusStyle,
  offerMarketplaceColumns,
} from "@/lib/imageRatios";
import { useUpperTabHost } from "@/contexts/UpperTabHostContext";

const GRID_GAP = 14;
const GRID_PAD = 16;

/** City for Workspace query — stay city first; Athens only for PLAY / Athens hotels. */
function resolveSmartTravelerCity(opts: {
  stayCity?: string | null;
  lastCity?: string | null;
  hotelSlug?: string | null;
  hotelName?: string | null;
}): string | undefined {
  const fromStay = (opts.stayCity || opts.lastCity || "").trim();
  if (fromStay) return fromStay;
  const slug = `${opts.hotelSlug || ""} ${opts.hotelName || ""}`.toLowerCase();
  if (slug.includes("play") || slug.includes("athens") || slug.includes("theatrou")) {
    return "Athens";
  }
  return undefined;
}

/**
 * SmartTraveler — discovery marketplace plus participating merchant offers.
 * Editorial catalog always renders; live partners merge in with Partner badges and redemption.
 */
type SmartTravelerScreenProps = {
  tabActive?: boolean;
};

export function SmartTravelerScreen({ tabActive = true }: SmartTravelerScreenProps = {}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { access, isFullStay, activeStay, snap } = useGuestLifecycle();
  const stayPerks = can(access ?? "PRE_TRIP", "stay_smarttraveler_perks");
  const [filter, setFilter] = useState<SmartTravelerFilterChip>("All");
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());

  const [live, setLive] = useState<SmartTravelerPartner[]>([]);
  const [liveLoaded, setLiveLoaded] = useState(false);
  /** Editorial catalog paints immediately; live inventory merges in when ready. */
  const [loading, setLoading] = useState(false);

  const city = resolveSmartTravelerCity({
    stayCity: activeStay?.city,
    lastCity: snap?.lifecycle?.lastCity,
    hotelSlug: activeStay?.hotelSlug || snap?.lifecycle?.lastHotelSlug,
    hotelName: activeStay?.hotelName || snap?.lifecycle?.lastHotelName,
  });

  useEffect(() => {
    if (!tabActive) return;
    let cancelled = false;
    void fetchLiveSmartTravelers({ city }).then((result) => {
      if (cancelled) return;
      setLive(result.ok ? result.partners : []);
      setLiveLoaded(true);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [city, tabActive]);

  const cols = offerMarketplaceColumns(width);
  const cardW = cardWidthForColumns(width, cols, GRID_PAD, GRID_GAP);

  const catalog = useMemo(() => mergeSmartTravelerCatalog(live), [live]);
  const partnerCount = live.length;

  const finds = useMemo(() => {
    const base =
      filter === "All"
        ? catalog
        : catalog.filter((p) => partnerMatchesSmartTravelerFilter(p, filter));
    return base;
  }, [filter, catalog]);

  const open = (id: string) => router.push(`/localFind/${id}` as Href);

  const toggleSave = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>SmartTraveler</Text>
        <Text style={styles.tagline}>Discover the local. Enjoy the unexpected.</Text>
        <Text style={styles.subtitleSecondary}>
          Independent boutiques, creative spaces, hidden gems and neighborhood favorites —
          handpicked for curious travelers. Explore the city and unlock exclusive offers from
          participating local businesses.
        </Text>
        {liveLoaded && partnerCount === 0 ? (
          <Text style={styles.subtitleSecondary} testID="st-merchant-join-hint">
            No participating offers published near you yet — editorial picks below are discovery
            only. Businesses join via banditour-workspace.vercel.app/join → SmartTraveler.
          </Text>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {SMART_TRAVELER_FILTER_CHIPS.map((chip) => {
          const on = filter === chip;
          return (
            <Pressable
              key={chip}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => setFilter(chip)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              testID={`st-filter-${chip}`}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {chip === "All" ? "All" : chip.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.sectionRow}>
        <Text style={styles.section}>Local Finds</Text>
        <Text style={styles.sectionCount} testID="st-find-count">
          {loading ? "…" : finds.length}
        </Text>
      </View>
      {partnerCount > 0 ? (
        <Text style={styles.sectionHint} testID="st-partner-count">
          {partnerCount} participating offer{partnerCount === 1 ? "" : "s"} · editorial picks labeled
        </Text>
      ) : null}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={color.ink} />
          <Text style={styles.empty}>Finding local recommendations…</Text>
        </View>
      ) : finds.length === 0 ? (
        <Text style={styles.empty}>
          {filter === "All"
            ? "No local finds published near you yet."
            : "No local finds in this category yet."}
        </Text>
      ) : (
        <View style={[styles.grid, { gap: GRID_GAP }]}>
          {finds.map((place) => (
            <LocalFindCard
              key={place.id}
              place={place}
              width={cardW}
              saved={savedIds.has(place.id)}
              onOpen={() => open(place.id)}
              onToggleSave={() => toggleSave(place.id)}
              editorial={place.isEditorial}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function LocalFindCard({
  place,
  width,
  saved,
  onOpen,
  onToggleSave,
  editorial,
}: {
  place: SmartTravelerCatalogEntry;
  width: number;
  saved: boolean;
  onOpen: () => void;
  onToggleSave: () => void;
  editorial?: boolean;
}) {
  const imageH = Math.max(200, Math.min(320, width));
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { width },
        pressed && styles.cardPressed,
      ]}
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${place.businessName} · ${place.neighborhood}`}
      testID={`st-card-${place.id}`}
    >
      <View
        style={[
          styles.imageWrap,
          { minHeight: imageH, aspectRatio: ImageRatio.square },
        ]}
      >
        <ExpoImage
          source={{ uri: place.imageUrl }}
          style={[styles.cardImage, imageFocusStyle("center")]}
          contentFit="cover"
          transition={160}
        />
        <Pressable
          style={styles.heart}
          onPress={(e) => {
            e.stopPropagation?.();
            onToggleSave();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={saved ? "Remove from My Spots" : "Save to My Spots"}
        >
          <Ionicons
            name={saved ? "heart" : "heart-outline"}
            size={20}
            color={saved ? color.brand : "#FFFFFF"}
          />
        </Pressable>
        <View style={styles.perkBadge}>
          <Text style={styles.perkBadgeText} numberOfLines={1}>
            {editorial ? "Editorial" : "Partner"}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={2}>
          {place.businessName}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {place.typeLabel} · {place.neighborhood}
        </Text>
        <Text style={styles.banditLine} numberOfLines={2}>
          {place.banditLine}
        </Text>
        <Text style={styles.curator} numberOfLines={1}>
          {place.curator}
        </Text>
        {editorial ? (
          <Text style={styles.privilege} numberOfLines={2}>
            Editorial · discovery only
          </Text>
        ) : place.guestPrivilege ? (
          <Text style={styles.privilege} numberOfLines={2}>
            Participating offer: {place.guestPrivilege.label}
          </Text>
        ) : null}
        <Text style={styles.couponHint} numberOfLines={1}>
          {editorial ? "Preview inside profile" : "Coupon inside profile"}
        </Text>
      </View>
    </Pressable>
  );
}

/** Route entry — listing UI is hosted by UpperTabScreens when the rail is active. */
export default function SmartTravelerRoute() {
  const { enabled } = useUpperTabHost();
  if (enabled) return null;
  return <SmartTravelerScreen />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surfaceWarm },
  content: { paddingBottom: 48 },
  header: {
    paddingHorizontal: GRID_PAD,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.hairline,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: color.ink,
    letterSpacing: -0.3,
  },
  tagline: {
    fontSize: 16,
    fontWeight: "700",
    color: color.inkSoft,
    marginTop: 6,
    lineHeight: 22,
  },
  subtitleSecondary: {
    fontSize: 13,
    fontWeight: "500",
    color: color.muted,
    marginTop: 8,
    lineHeight: 19,
  },
  lead: {
    fontSize: 13,
    color: color.muted,
    marginTop: 8,
    lineHeight: 19,
  },
  chips: {
    paddingHorizontal: GRID_PAD,
    paddingVertical: 14,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  chipOn: {
    backgroundColor: color.ink,
    borderColor: color.ink,
  },
  chipText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: color.inkSoft,
  },
  chipTextOn: { color: "#FFFFFF" },
  sectionRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: GRID_PAD,
    marginBottom: 12,
  },
  section: { fontSize: 16, fontWeight: "800", color: color.ink },
  sectionCount: { fontSize: 12, fontWeight: "700", color: color.muted },
  sectionHint: {
    paddingHorizontal: GRID_PAD,
    marginTop: -6,
    marginBottom: 10,
    fontSize: 12,
    fontWeight: "600",
    color: color.muted,
    lineHeight: 17,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: GRID_PAD,
  },
  loadingBox: {
    paddingHorizontal: GRID_PAD,
    paddingTop: 8,
    gap: 10,
    alignItems: "flex-start",
  },
  empty: {
    paddingHorizontal: GRID_PAD,
    fontSize: 13,
    color: color.muted,
  },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.xl,
    overflow: "hidden",
    marginBottom: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  cardPressed: { opacity: 0.94, transform: [{ scale: 0.985 }] },
  imageWrap: {
    width: "100%",
    backgroundColor: color.imageFallback,
    overflow: "hidden",
  },
  cardImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  heart: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(17,17,17,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  perkBadge: {
    position: "absolute",
    bottom: 10,
    left: 10,
    backgroundColor: "rgba(17,17,17,0.82)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    maxWidth: "72%",
  },
  perkBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: color.goldMicro,
  },
  cardBody: {
    padding: 12,
    minHeight: 128,
  },
  cardName: {
    fontSize: 17,
    fontWeight: "800",
    color: color.ink,
    lineHeight: 22,
  },
  meta: {
    fontSize: 12,
    fontWeight: "600",
    color: color.muted,
    marginTop: 4,
  },
  banditLine: {
    fontSize: 13,
    color: color.inkSoft,
    marginTop: 8,
    lineHeight: 18,
  },
  curator: {
    fontSize: 11,
    fontWeight: "700",
    color: color.brand,
    marginTop: 8,
    letterSpacing: 0.2,
  },
  privilege: {
    fontSize: 12,
    color: color.muted,
    marginTop: 8,
    lineHeight: 16,
  },
  couponHint: {
    fontSize: 11,
    fontWeight: "700",
    color: color.muted,
    marginTop: 10,
    letterSpacing: 0.2,
  },
});
