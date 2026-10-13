import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { RatioImage } from "@/components/RatioImage";
import {
  experiencesWithValidCover,
  formatEuro,
  GUEST_EXPERIENCES,
  isValidExperienceImageUrl,
  type GuestExperience,
} from "@/lib/guest-workspace/productWorlds";
import { cardWidthForColumns } from "@/lib/imageRatios";
import { fetchLiveLocalExperiences, mapWorkspaceExperience } from "@/lib/guest-workspace/liveExperiences";
import { color, radius, space } from "@/lib/guestDesign";

const CATEGORIES = [
  "All",
  "Workshops",
  "Nightlife",
  "Art",
  "Fashion",
  "Queer",
  "Food",
  "Music",
] as const;

const GRID_PAD = 16;
const GRID_GAP = 14;

/** Mobile: one full-bleed poster · tablet 2 · desktop 3 — photo-led, not catalog. */
function experienceColumns(width: number): number {
  if (width >= 900) return 3;
  if (width >= 720) return 2;
  return 1;
}

function matchesFilter(exp: GuestExperience, filter: (typeof CATEGORIES)[number]): boolean {
  if (filter === "All") return true;
  if (exp.category === filter) return true;
  const label = (exp.categoryLabel || "").toLowerCase();
  return label.includes(filter.toLowerCase());
}

/**
 * Experiences — bandiTour DNA marketplace.
 * NO VALID IMAGE = DO NOT RENDER THE LISTING (including on load failure).
 */
export function ExperiencesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<(typeof CATEGORIES)[number]>("All");
  const [saved, setSaved] = useState<Set<string>>(() => new Set());
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());

  const [live, setLive] = useState<GuestExperience[]>([]);
  const [liveError, setLiveError] = useState<string | null>(null);

  useEffect(() => {
    void fetchLiveLocalExperiences().then((rows) => {
      const mapped = rows.map(mapWorkspaceExperience).filter(Boolean) as GuestExperience[];
      setLive(mapped);
      if (!rows.length) setLiveError("No published provider experiences yet.");
    });
  }, []);

  const columns = experienceColumns(width);
  const cardW = cardWidthForColumns(width, columns, GRID_PAD, GRID_GAP);
  const isMobile = width < 720;

  const seeded = useMemo(() => experiencesWithValidCover(GUEST_EXPERIENCES), []);

  const featured = useMemo(
    () =>
      live.filter((e) => !failedImages.has(e.id)).slice(0, 3),
    [live, failedImages],
  );

  const rows = useMemo(() => {
    const base = live.filter((e) => matchesFilter(e, filter) && !failedImages.has(e.id));
    return base;
  }, [filter, live, failedImages]);

  const demoRows = useMemo(
    () => (live.length ? [] : seeded.filter((e) => !failedImages.has(e.id))),
    [live.length, seeded, failedImages],
  );

  const open = (id: string) => router.push(`/experience/${id}` as Href);

  const toggleSave = (id: string) => {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const markImageFailed = (id: string) => {
    setFailedImages((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.titleStrip}>
        <Text style={styles.kicker}>Impossible to Google</Text>
        <Text style={styles.title}>Experiences</Text>
        <Text style={styles.lead}>
          Unexpected · local · creative · slightly underground — not a tourism brochure.
        </Text>
        {liveError && !live.length ? (
          <Text style={[styles.lead, { marginTop: 8 }]}>{liveError}</Text>
        ) : live.length ? (
          <Text style={[styles.lead, { marginTop: 8 }]}>
            Hosted by locals near you — book the ones that feel right.
          </Text>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {CATEGORIES.map((c) => (
          <Pressable
            key={c}
            testID={`exp-filter-${c}`}
            style={[styles.chip, filter === c && styles.chipOn]}
            onPress={() => setFilter(c)}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === c }}
            accessibilityLabel={`Filter ${c}`}
          >
            <Text style={[styles.chipText, filter === c && styles.chipTextOn]}>{c}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {isMobile && filter === "All" && featured.length > 0 ? (
        <View style={styles.carouselSection}>
          <Text style={styles.carouselLabel}>Tonight & this week</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselRow}
            decelerationRate="fast"
            snapToInterval={Math.min(width * 0.72, 280) + 12}
          >
            {featured.map((exp) => (
              <ExperienceMarketplaceCard
                key={`feat_${exp.id}`}
                exp={exp}
                width={Math.min(width * 0.72, 280)}
                saved={saved.has(exp.id)}
                onPress={() => open(exp.id)}
                onToggleSave={() => toggleSave(exp.id)}
                onImageFailed={() => markImageFailed(exp.id)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.resultMeta}>
        <Text style={styles.resultCount}>
          {rows.length} {rows.length === 1 ? "experience" : "experiences"}
          {filter !== "All" ? ` · ${filter}` : ""}
        </Text>
      </View>

      <View style={[styles.grid, { gap: GRID_GAP }]}>
        {rows.map((exp) => (
          <ExperienceMarketplaceCard
            key={exp.id}
            exp={exp}
            width={cardW}
            saved={saved.has(exp.id)}
            onPress={() => open(exp.id)}
            onToggleSave={() => toggleSave(exp.id)}
            onImageFailed={() => markImageFailed(exp.id)}
          />
        ))}
      </View>

      {rows.length === 0 ? (
        <Text style={styles.empty}>Nothing in this category yet — try another filter.</Text>
      ) : null}
    </ScrollView>
  );
}

/**
 * Portrait 4:5 marketplace card.
 * If the cover fails at runtime, the entire listing unmounts — no blank rectangle.
 */
function ExperienceMarketplaceCard({
  exp,
  width,
  saved,
  onPress,
  onToggleSave,
  onImageFailed,
}: {
  exp: GuestExperience;
  width: number;
  saved: boolean;
  onPress: () => void;
  onToggleSave: () => void;
  onImageFailed: () => void;
}) {
  const [coverFailed, setCoverFailed] = useState(false);

  if (!isValidExperienceImageUrl(exp.imageUrl) || coverFailed) return null;

  const categoryLine = exp.categoryLabel || exp.category;

  return (
    <Pressable
      style={[styles.card, { width }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${exp.title}, ${formatEuro(exp.priceCents)}`}
    >
      <RatioImage
        uri={exp.imageUrl}
        ratio="portrait"
        focus="center-top"
        style={styles.image}
        onError={() => {
          setCoverFailed(true);
          onImageFailed();
        }}
      >
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeText} numberOfLines={1}>
            {categoryLine}
          </Text>
        </View>
        {exp.availableToday ? (
          <View style={styles.todayBadge}>
            <Text style={styles.todayBadgeText}>Today</Text>
          </View>
        ) : null}
        <Pressable
          style={styles.heartBtn}
          onPress={(e) => {
            e.stopPropagation?.();
            onToggleSave();
          }}
          hitSlop={8}
          accessibilityLabel={saved ? "Unsave" : "Save"}
        >
          <Ionicons
            name={saved ? "heart" : "heart-outline"}
            size={18}
            color={saved ? color.brand : color.muted}
          />
        </Pressable>
      </RatioImage>

      <View style={styles.body}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {exp.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {exp.host}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {exp.duration} · {exp.area}
        </Text>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={12} color={color.ink} />
          <Text style={styles.rating}>{exp.rating.toFixed(2)}</Text>
        </View>
        <View style={styles.footer}>
          <Text style={styles.price}>{formatEuro(exp.priceCents)}</Text>
          <Text style={styles.cta}>Book</Text>
        </View>
      </View>
    </Pressable>
  );
}

/** Route entry — listing UI is hosted by UpperTabScreens for instant tab switch. */
export default function ExperiencesRoute() {
  return null;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0B0B0B" },
  content: { paddingBottom: 48 },
  titleStrip: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: "#0B0B0B",
  },
  kicker: {
    fontSize: 11,
    fontWeight: "700",
    color: color.brand,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  title: { fontSize: 28, fontWeight: "700", color: "#FFFFFF", marginTop: 4, fontFamily: "Georgia" },
  lead: { fontSize: 14, color: "#A0A0A0", marginTop: 6, lineHeight: 20 },
  chips: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  chipOn: { backgroundColor: color.brand, borderColor: color.brand },
  chipText: { fontSize: 13, fontWeight: "600", color: "#C0C0C0" },
  chipTextOn: { color: "#FFF" },
  carouselSection: { marginBottom: 8 },
  carouselLabel: {
    paddingHorizontal: GRID_PAD,
    marginBottom: 10,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#888",
  },
  carouselRow: { paddingHorizontal: GRID_PAD, gap: 12, paddingBottom: 4 },
  resultMeta: { paddingHorizontal: GRID_PAD, marginBottom: 10 },
  resultCount: { fontSize: 12, fontWeight: "600", color: "#888" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: GRID_PAD,
  },
  card: { marginBottom: space.md },
  image: { borderRadius: 0 },
  categoryBadge: {
    position: "absolute",
    left: 10,
    bottom: 10,
    maxWidth: "78%",
    backgroundColor: "rgba(0,0,0,0.72)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: 0.2,
  },
  todayBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: color.brand,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  todayBadgeText: { fontSize: 10, fontWeight: "800", color: "#FFF" },
  heartBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  body: { paddingTop: 10, paddingHorizontal: 2, paddingBottom: 4 },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    lineHeight: 24,
    fontFamily: "Georgia",
  },
  meta: { fontSize: 12, color: "#9A9A9A", marginTop: 3 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  rating: { fontSize: 12, fontWeight: "700", color: "#E0E0E0" },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  price: { fontSize: 15, fontWeight: "800", color: "#FFFFFF" },
  cta: { fontSize: 13, fontWeight: "800", color: color.brand },
  empty: {
    paddingHorizontal: 16,
    fontSize: 13,
    color: "#888",
    marginTop: 8,
  },
});
