import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { useRouter, type Href } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import {
  BANDISHOP_LISTINGS,
  formatEuro,
  SHOP_CATEGORY_CHIPS,
  shopListingHasImage,
  shopListingImageUrls,
  type ShopCategoryChip,
  type ShopListing,
} from "@/lib/guest-workspace/productWorlds";
import { fetchLiveShopListings } from "@/lib/guest-workspace/liveShop";
import {
  athensCityOrigin,
  distanceLabelFor,
  haversineKm,
  originCustomerLabel,
  resolveHotelOrigin,
  SHOP_MANUAL_ORIGINS,
  SHOP_RADIUS_BANDS_KM,
  type ShopRadiusKm,
  type TravelerOrigin,
  withinRadius,
} from "@/lib/guest-workspace/shopGeo";
import { getPilotCurrentLocation } from "@/lib/currentLocation";
import { useGuestLifecycle } from "@/lib/guest-lifecycle/useGuestLifecycle";
import { cardWidthForColumns, shopMarketplaceColumns } from "@/lib/imageRatios";

const GRID_GAP = 12;
const GRID_PAD = 16;

type PlaceMode = "near" | "hotel" | "athens";

function matchesCategory(item: ShopListing, cat: ShopCategoryChip): boolean {
  if (cat === "All") return true;
  return item.category === cat;
}

type Listed = ShopListing & { distanceKm: number; liveDistanceLabel: string };

/**
 * banDiShop — cool things near me.
 * Visual identity preserved; location modes use real coords only.
 */
export function ShopScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { isFullStay, activeStay } = useGuestLifecycle();
  const [cat, setCat] = useState<ShopCategoryChip>("All");
  const [query, setQuery] = useState("");
  const [placeMode, setPlaceMode] = useState<PlaceMode>(isFullStay ? "hotel" : "athens");
  const [radiusKm, setRadiusKm] = useState<ShopRadiusKm>(5);
  const [mapMode, setMapMode] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());
  const [pickupOnly, setPickupOnly] = useState(true);
  const [guestDealOnly, setGuestDealOnly] = useState(false);
  const [imageFailedIds, setImageFailedIds] = useState<Set<string>>(() => new Set());
  const [liveListings, setLiveListings] = useState<ShopListing[]>([]);
  const [liveReady, setLiveReady] = useState(false);

  const [deviceOrigin, setDeviceOrigin] = useState<TravelerOrigin | null>(null);
  const [manualOrigin, setManualOrigin] = useState<TravelerOrigin | null>(null);
  const [locBusy, setLocBusy] = useState(false);
  const [locHint, setLocHint] = useState<string | null>(null);
  const [manualPickerOpen, setManualPickerOpen] = useState(false);

  const hotelOrigin = useMemo(
    () =>
      resolveHotelOrigin({
        hotelSlug: activeStay?.hotelSlug,
        hotelName: activeStay?.hotelName || (isFullStay ? "Your hotel" : null),
      }),
    [activeStay?.hotelSlug, activeStay?.hotelName, isFullStay],
  );

  const origin: TravelerOrigin = useMemo(() => {
    if (placeMode === "near") {
      return deviceOrigin || manualOrigin || athensCityOrigin();
    }
    if (placeMode === "hotel") return hotelOrigin;
    return athensCityOrigin();
  }, [placeMode, deviceOrigin, manualOrigin, hotelOrigin]);

  const applyNearMe = useCallback(async () => {
    setPlaceMode("near");
    setLocBusy(true);
    setLocHint(null);
    const pos = await getPilotCurrentLocation();
    setLocBusy(false);
    if (pos) {
      setDeviceOrigin({
        lat: pos.lat,
        lng: pos.lng,
        mode: "device",
        label: "You",
        precise: true,
      });
      setManualOrigin(null);
      setManualPickerOpen(false);
      return;
    }
    setDeviceOrigin(null);
    setManualPickerOpen(true);
    setLocHint("Location unavailable — choose an area below.");
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLiveReady(false);
    void fetchLiveShopListings({
      lat: origin.lat,
      lng: origin.lng,
      radiusKm: placeMode === "athens" ? null : radiusKm,
      originLabel: origin.label,
    }).then((result) => {
      if (cancelled) return;
      setLiveListings(result.listings);
      setLiveReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [origin.lat, origin.lng, origin.label, placeMode, radiusKm]);

  const columns = shopMarketplaceColumns(width);
  const cardW = cardWidthForColumns(width, columns, GRID_PAD, GRID_GAP);

  const catalog = useMemo(() => {
    if (liveListings.length) return liveListings;
    if (!liveReady) return [] as ShopListing[];
    // DEMO seed only when Workspace has no published partner inventory.
    return BANDISHOP_LISTINGS;
  }, [liveListings, liveReady]);

  const usingDemoFallback = liveReady && liveListings.length === 0;

  const listed: Listed[] = useMemo(() => {
    return catalog
      .filter(shopListingHasImage)
      .filter((item) => !imageFailedIds.has(item.id))
      .map((item) => {
        const distanceKm = haversineKm(origin, { lat: item.lat, lng: item.lng });
        return {
          ...item,
          distanceKm,
          liveDistanceLabel: distanceLabelFor(distanceKm, {
            originLabel: origin.mode === "city" ? undefined : origin.label,
          }),
        };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [catalog, origin, imageFailedIds]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return listed.filter((item) => {
      if (!matchesCategory(item, cat)) return false;
      if (placeMode !== "athens" && !withinRadius(item.distanceKm, radiusKm)) return false;
      if (pickupOnly && item.fulfillment === "delivery") return false;
      if (guestDealOnly && !item.badges?.includes("Guest deal")) return false;
      if (!q) return true;
      const hay = [
        item.title,
        item.description,
        item.category,
        item.neighborhood,
        item.sellerName,
        item.shopName,
        item.pickupAddress,
        ...(item.badges ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [listed, cat, query, placeMode, radiusKm, pickupOnly, guestDealOnly]);

  const hideListingForMissingImage = (id: string) => {
    setImageFailedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const open = (id: string) => router.push(`/product/${id}` as Href);

  const toggleSave = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectManual = (pick: TravelerOrigin) => {
    setManualOrigin(pick);
    setDeviceOrigin(null);
    setPlaceMode("near");
    setManualPickerOpen(false);
    setLocHint(null);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.top}>
        <Text style={styles.brand}>banDiShop</Text>
        <Text style={styles.lead}>Cool things near me — local pickup, real distance</Text>
        <Text style={styles.originLine} testID="shop-origin">
          {originCustomerLabel(origin)}
        </Text>
        {usingDemoFallback ? (
          <Text style={styles.demoLine} testID="shop-preview-label">
            Preview only — not open to buy yet
          </Text>
        ) : null}
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color="#6B6B6B" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search makers, vintage, art…"
          placeholderTextColor="#9A9A9A"
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <View style={styles.modeRow}>
        <Pressable
          style={[styles.modeChip, placeMode === "near" && styles.modeChipOn]}
          onPress={() => void applyNearMe()}
          accessibilityRole="button"
          accessibilityLabel="Near me"
          testID="shop-mode-near"
        >
          <Text style={[styles.modeChipText, placeMode === "near" && styles.modeChipTextOn]}>
            Near me
          </Text>
        </Pressable>
        <Pressable
          style={[styles.modeChip, placeMode === "hotel" && styles.modeChipOn]}
          onPress={() => {
            setPlaceMode("hotel");
            setManualPickerOpen(false);
            setLocHint(null);
          }}
          accessibilityRole="button"
          accessibilityLabel="From my hotel"
          testID="shop-mode-hotel"
        >
          <Text style={[styles.modeChipText, placeMode === "hotel" && styles.modeChipTextOn]}>
            From my hotel
          </Text>
        </Pressable>
        <Pressable
          style={[styles.modeChip, placeMode === "athens" && styles.modeChipOn]}
          onPress={() => {
            setPlaceMode("athens");
            setManualPickerOpen(false);
            setLocHint(null);
          }}
          accessibilityRole="button"
          accessibilityLabel="All Athens"
          testID="shop-mode-athens"
        >
          <Text style={[styles.modeChipText, placeMode === "athens" && styles.modeChipTextOn]}>
            All Athens
          </Text>
        </Pressable>
        <Pressable
          style={[styles.modeChip, mapMode && styles.modeChipOn]}
          onPress={() => setMapMode((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel="Map"
        >
          <Text style={[styles.modeChipText, mapMode && styles.modeChipTextOn]}>Map</Text>
        </Pressable>
        <Pressable style={styles.modeChip} onPress={() => setFiltersOpen((v) => !v)}>
          <Text style={styles.modeChipText}>Filters</Text>
        </Pressable>
      </View>

      {locBusy ? (
        <View style={styles.locBusyRow}>
          <ActivityIndicator color="#111" />
          <Text style={styles.locHint}>Finding your location…</Text>
        </View>
      ) : null}
      {locHint ? <Text style={styles.locHint}>{locHint}</Text> : null}

      {manualPickerOpen ? (
        <View style={styles.manualBox} testID="shop-manual-location">
          <Text style={styles.manualTitle}>Choose an area</Text>
          <Text style={styles.manualSub}>
            We won’t use your hotel location unless you pick From my hotel.
          </Text>
          <View style={styles.manualChips}>
            {SHOP_MANUAL_ORIGINS.map((pick) => {
              const on = manualOrigin?.label === pick.label && placeMode === "near";
              return (
                <Pressable
                  key={pick.label}
                  style={[styles.manualChip, on && styles.manualChipOn]}
                  onPress={() => selectManual(pick)}
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${pick.label}`}
                >
                  <Text style={[styles.manualChipText, on && styles.manualChipTextOn]}>
                    {pick.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {placeMode !== "athens" ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.radiusRow}
        >
          {SHOP_RADIUS_BANDS_KM.map((km) => {
            const on = radiusKm === km;
            return (
              <Pressable
                key={km}
                style={[styles.radiusChip, on && styles.radiusChipOn]}
                onPress={() => setRadiusKm(km)}
                accessibilityRole="button"
                accessibilityLabel={`${km} kilometer radius`}
                testID={`shop-radius-${km}`}
              >
                <Text style={[styles.radiusChipText, on && styles.radiusChipTextOn]}>
                  {km} km
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {filtersOpen ? (
        <View style={styles.filters}>
          <Pressable
            style={[styles.filterToggle, pickupOnly && styles.filterToggleOn]}
            onPress={() => setPickupOnly((v) => !v)}
          >
            <Text style={styles.filterToggleText}>Pickup only</Text>
          </Pressable>
          <Pressable
            style={[styles.filterToggle, guestDealOnly && styles.filterToggleOn]}
            onPress={() => setGuestDealOnly((v) => !v)}
          >
            <Text style={styles.filterToggleText}>Guest deal</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cats}
      >
        {SHOP_CATEGORY_CHIPS.map((chip) => {
          const on = cat === chip;
          return (
            <Pressable
              key={chip}
              style={[styles.cat, on && styles.catOn]}
              onPress={() => setCat(chip)}
            >
              <Text style={[styles.catText, on && styles.catTextOn]}>{chip}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.count} testID="shop-result-count">
        {rows.length} {rows.length === 1 ? "find" : "finds"}
        {placeMode === "athens" ? " · Athens" : ` · within ${radiusKm} km`}
        {" · closest first"}
      </Text>

      {mapMode ? (
        <View style={styles.mapPanel} testID="shop-map">
          <Text style={styles.mapTitle}>Pickup pins</Text>
          <Text style={styles.mapHint}>{originCustomerLabel(origin)} · tap a row for details</Text>
          {rows.slice(0, 12).map((item) => (
            <Pressable
              key={item.id}
              style={styles.mapRow}
              onPress={() => open(item.id)}
              accessibilityRole="button"
            >
              <View style={styles.mapDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.mapRowTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.mapRowMeta} numberOfLines={1}>
                  {item.liveDistanceLabel} · {item.pickupAddress}
                </Text>
              </View>
              <Text style={styles.mapRowPrice}>{formatEuro(item.priceCents)}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={[styles.grid, { gap: GRID_GAP }]}>
          {rows.map((item) => {
            const uri = shopListingImageUrls(item)[0];
            return (
              <Pressable
                key={item.id}
                style={[styles.card, { width: cardW }]}
                onPress={() => open(item.id)}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}, ${item.liveDistanceLabel}`}
                testID={`shop-card-${item.id}`}
              >
                <ExpoImage
                  source={{ uri }}
                  style={styles.cardImage}
                  contentFit="cover"
                  onError={() => hideListingForMissingImage(item.id)}
                />
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {item.liveDistanceLabel}
                </Text>
                <Text style={styles.cardSeller} numberOfLines={1}>
                  {item.shopName} · {item.fulfillment === "delivery" ? "Delivery" : "Pickup"}
                  {usingDemoFallback ? " · Preview" : ""}
                </Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.cardPrice}>{formatEuro(item.priceCents)}</Text>
                  <Pressable
                    hitSlop={8}
                    onPress={() => toggleSave(item.id)}
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name={savedIds.has(item.id) ? "heart" : "heart-outline"}
                      size={18}
                      color="#E03131"
                    />
                  </Pressable>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {rows.length === 0 && liveReady ? (
        <Text style={styles.empty}>
          {placeMode === "athens"
            ? "Nothing to show right now. Try another search."
            : `Nothing within ${radiusKm} km. Expand the radius or try All Athens.`}
        </Text>
      ) : null}
    </ScrollView>
  );
}

/** Route entry — listing UI is hosted by UpperTabScreens for instant tab switch. */
export default function ShopRoute() {
  return null;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { paddingBottom: 48 },
  top: { paddingHorizontal: GRID_PAD, paddingTop: 12 },
  brand: { fontSize: 28, fontWeight: "800", color: "#111", fontFamily: "Caros" },
  lead: { marginTop: 4, fontSize: 14, color: "#6B6B6B" },
  originLine: { marginTop: 8, fontSize: 13, fontWeight: "600", color: "#333" },
  demoLine: { marginTop: 6, fontSize: 12, fontWeight: "600", color: "#8A6A3A" },
  searchRow: {
    marginTop: 14,
    marginHorizontal: GRID_PAD,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E8E8E8",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: "#111", padding: 0 },
  modeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: GRID_PAD,
    marginTop: 12,
  },
  modeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modeChipOn: { backgroundColor: "#111", borderColor: "#111" },
  modeChipText: { fontSize: 13, fontWeight: "700", color: "#111" },
  modeChipTextOn: { color: "#FFF" },
  locBusyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: GRID_PAD,
    marginTop: 10,
  },
  locHint: {
    marginTop: 8,
    marginHorizontal: GRID_PAD,
    fontSize: 12,
    color: "#6B6B6B",
    lineHeight: 18,
  },
  manualBox: {
    marginTop: 10,
    marginHorizontal: GRID_PAD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    padding: 12,
    backgroundColor: "#FAFAFA",
  },
  manualTitle: { fontSize: 14, fontWeight: "800", color: "#111" },
  manualSub: { marginTop: 4, fontSize: 12, color: "#6B6B6B", lineHeight: 17, marginBottom: 10 },
  manualChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  manualChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#FFF",
  },
  manualChipOn: { backgroundColor: "#111", borderColor: "#111" },
  manualChipText: { fontSize: 12, fontWeight: "700", color: "#333" },
  manualChipTextOn: { color: "#FFF" },
  radiusRow: { paddingHorizontal: GRID_PAD, gap: 8, marginTop: 10 },
  radiusChip: {
    borderRadius: 999,
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  radiusChipOn: { backgroundColor: "#E03131" },
  radiusChipText: { fontSize: 12, fontWeight: "700", color: "#333" },
  radiusChipTextOn: { color: "#FFF" },
  filters: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: GRID_PAD,
    marginTop: 10,
  },
  filterToggle: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  filterToggleOn: { backgroundColor: "#FFF0F0", borderColor: "#E03131" },
  filterToggleText: { fontSize: 12, fontWeight: "700", color: "#111" },
  cats: { paddingHorizontal: GRID_PAD, gap: 8, marginTop: 12 },
  cat: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#F5F5F5",
  },
  catOn: { backgroundColor: "#111" },
  catText: { fontSize: 12, fontWeight: "700", color: "#333" },
  catTextOn: { color: "#FFF" },
  count: {
    marginTop: 14,
    marginHorizontal: GRID_PAD,
    fontSize: 12,
    fontWeight: "600",
    color: "#6B6B6B",
  },
  grid: {
    marginTop: 12,
    paddingHorizontal: GRID_PAD,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  card: { marginBottom: 4 },
  cardImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: "#1A1A1A",
  },
  cardTitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "700",
    color: "#111",
    minHeight: 36,
  },
  cardMeta: { marginTop: 2, fontSize: 12, fontWeight: "600", color: "#E03131" },
  cardSeller: { marginTop: 2, fontSize: 11, color: "#6B6B6B" },
  cardFooter: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardPrice: { fontSize: 14, fontWeight: "800", color: "#111" },
  mapPanel: {
    marginTop: 12,
    marginHorizontal: GRID_PAD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    padding: 14,
    backgroundColor: "#FAFAFA",
  },
  mapTitle: { fontSize: 16, fontWeight: "800", color: "#111" },
  mapHint: { marginTop: 4, fontSize: 12, color: "#6B6B6B", marginBottom: 10 },
  mapRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E8E8E8",
  },
  mapDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#E03131",
  },
  mapRowTitle: { fontSize: 14, fontWeight: "700", color: "#111" },
  mapRowMeta: { marginTop: 2, fontSize: 11, color: "#6B6B6B" },
  mapRowPrice: { fontSize: 13, fontWeight: "800", color: "#111" },
  empty: {
    marginTop: 24,
    marginHorizontal: GRID_PAD,
    fontSize: 14,
    color: "#6B6B6B",
    lineHeight: 20,
  },
});
