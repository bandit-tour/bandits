import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import {
  formatEuro,
  getRelatedShopListings,
  getShopListingById,
  shopListingHasImage,
  shopListingImageUrls,
  type ShopListing,
} from "@/lib/guest-workspace/productWorlds";
import { fetchLiveShopListingDetail, fetchLiveShopListings } from "@/lib/guest-workspace/liveShop";
import {
  distanceLabelFor,
  haversineKm,
  resolveHotelOrigin,
} from "@/lib/guest-workspace/shopGeo";
import { useGuestLifecycle } from "@/lib/guest-lifecycle/useGuestLifecycle";
import { messageShopSeller, reserveShopListing, saveGuestObject } from "@/lib/workspace/actions";

/** Full marketplace product detail — gallery, seller, fulfill, save / message / reserve. */
export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { activeStay } = useGuestLifecycle();
  const seedItem = useMemo(() => (id ? getShopListingById(id) : undefined), [id]);
  const [liveItem, setLiveItem] = useState<ShopListing | null>(null);
  const [liveRelated, setLiveRelated] = useState<ShopListing[]>([]);
  const item = liveItem || seedItem;
  const related = useMemo(() => {
    if (liveRelated.length) return liveRelated.filter((r) => r.id !== id);
    return id ? getRelatedShopListings(id, 6) : [];
  }, [liveRelated, id]);
  const origin = useMemo(
    () =>
      resolveHotelOrigin({
        hotelSlug: activeStay?.hotelSlug,
        hotelName: activeStay?.hotelName,
      }),
    [activeStay?.hotelSlug, activeStay?.hotelName],
  );
  const liveDistance = useMemo(() => {
    if (!item?.lat || !item?.lng) return item?.distanceLabel || "";
    const km = haversineKm(origin, { lat: item.lat, lng: item.lng });
    return distanceLabelFor(km, { originLabel: origin.label });
  }, [item, origin]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [saved, setSaved] = useState(false);
  const [reserved, setReserved] = useState(false);
  const [messageSent, setMessageSent] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [relatedHidden, setRelatedHidden] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    setGalleryIndex(0);
    setSaved(false);
    setReserved(false);
    setMessageSent(false);
    setRelatedHidden(new Set());
    setLiveItem(null);
    if (!id) return;
    void fetchLiveShopListingDetail(id, {
      lat: origin.lat,
      lng: origin.lng,
      originLabel: origin.label,
    }).then((row) => {
      if (row) setLiveItem(row);
    });
    void fetchLiveShopListings({
      lat: origin.lat,
      lng: origin.lng,
      radiusKm: null,
      originLabel: origin.label,
    }).then((r) => setLiveRelated(r.listings.slice(0, 8)));
  }, [id, origin.lat, origin.lng, origin.label]);

  const screenOptions = useAppBackScreenOptions({
    title: item?.title ?? "Listing",
    fallback: "/shop" as Href,
    showBack: true,
  });

  const gallery = item ? shopListingImageUrls(item) : [];
  const heroH = Math.min(420, Math.max(280, width * 0.92));
  const relatedW = Math.min(148, (width - 48) / 2.2);
  const relatedVisible = related.filter(
    (r) => shopListingHasImage(r) && !relatedHidden.has(r.id),
  );

  if (!item || !shopListingHasImage(item)) {
    return (
      <View style={styles.missing}>
        <Stack.Screen options={screenOptions} />
        <Text style={styles.missingText}>Listing not found</Text>
        <Pressable style={styles.backLink} onPress={() => router.replace("/shop" as Href)}>
          <Text style={styles.backLinkText}>Back to banDiShop</Text>
        </Pressable>
      </View>
    );
  }

  const onShare = async () => {
    try {
      await Share.share({
        title: item.title,
        message: `${item.title} Â· ${formatEuro(item.priceCents)} on banDiShop Â· ${item.neighborhood}`,
      });
    } catch {
      /* user cancelled */
    }
  };

  const openRelated = (listingId: string) => {
    router.push(`/product/${listingId}` as Href);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Stack.Screen options={screenOptions} />

        <View style={[styles.gallery, { height: heroH }]}>
          <ExpoImage
            source={{ uri: gallery[galleryIndex] ?? gallery[0] }}
            style={styles.hero}
            contentFit="cover"
            transition={180}
            onError={() => {
              if (galleryIndex + 1 < gallery.length) {
                setGalleryIndex((i) => i + 1);
                return;
              }
              router.replace("/shop" as Href);
            }}
          />
          <View style={styles.galleryActions}>
            <Pressable style={styles.iconBtn} onPress={() => setSaved((s) => !s)} hitSlop={6}>
              <Ionicons
                name={saved ? "heart" : "heart-outline"}
                size={20}
                color={saved ? "#C45C4A" : "#1C1917"}
              />
            </Pressable>
            <Pressable style={styles.iconBtn} onPress={onShare} hitSlop={6}>
              <Ionicons name="share-outline" size={20} color="#1C1917" />
            </Pressable>
          </View>
          {gallery.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.thumbs}
              contentContainerStyle={styles.thumbsContent}
            >
              {gallery.map((uri, i) => (
                <Pressable
                  key={`${uri}_${i}`}
                  onPress={() => setGalleryIndex(i)}
                  style={[styles.thumb, galleryIndex === i && styles.thumbOn]}
                >
                  <ExpoImage source={{ uri }} style={styles.thumbImg} contentFit="cover" />
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </View>

        <View style={styles.panel}>
          <Text style={styles.price}>{formatEuro(item.priceCents)}</Text>
          <Text style={styles.title}>{item.title}</Text>

          {item.badges?.length ? (
            <View style={styles.badgeRow}>
              {item.badges.map((b) => (
                <View key={b} style={styles.badge}>
                  <Text style={styles.badgeText}>{b}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Text style={styles.metaLine}>
            {item.condition} · {item.category} · {liveDistance}
          </Text>

          <Text style={styles.story}>{item.description}</Text>

          <View style={styles.sellerCard}>
            <View style={styles.sellerAvatar}>
              <Text style={styles.sellerInitial}>{item.sellerName.slice(0, 1)}</Text>
            </View>
            <View style={styles.sellerBody}>
              <Text style={styles.sellerName}>{item.shopName}</Text>
              <Text style={styles.sellerMeta}>
                {item.sellerName} · ★ {item.sellerRating.toFixed(1)} · {item.partnerId}
              </Text>
            </View>
          </View>

          <View style={styles.infoBlock}>
            <InfoRow icon="location-outline" label="Distance" value={liveDistance} />
            <InfoRow icon="navigate-outline" label="Pickup address" value={item.pickupAddress} />
            <InfoRow icon="map-outline" label="Neighborhood" value={item.neighborhood} />
            <InfoRow
              icon="cube-outline"
              label="Pickup / delivery"
              value={
                item.fulfillment === "pickup"
                  ? `Pickup only · ${item.fulfillmentNote}`
                  : item.fulfillment === "delivery"
                    ? `Local delivery${item.deliveryRadiusKm ? ` · ${item.deliveryRadiusKm} km` : ""}`
                    : `Pickup + delivery · ${item.fulfillmentNote}`
              }
            />
            <InfoRow icon="shield-checkmark-outline" label="Condition" value={item.condition} />
          </View>

          <View style={styles.availRow}>
            {item.availability.map((a) => (
              <Text key={a} style={styles.availChip}>
                {a}
              </Text>
            ))}
          </View>

          {relatedVisible.length > 0 ? (
            <>
              <Text style={styles.relatedTitle}>More near you</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.relatedRail}
              >
                {relatedVisible.map((r) => (
                  <RelatedListingCard
                    key={r.id}
                    item={r}
                    width={relatedW}
                    onPress={() => openRelated(r.id)}
                    onImagesExhausted={() =>
                      setRelatedHidden((prev) => {
                        if (prev.has(r.id)) return prev;
                        const next = new Set(prev);
                        next.add(r.id);
                        return next;
                      })
                    }
                  />
                ))}
              </ScrollView>
            </>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={styles.footerSecondary}
          disabled={actionBusy}
          onPress={() => {
            if (!item || actionBusy) return;
            setActionBusy(true);
            setActionError(null);
            void messageShopSeller({
              listingId: item.id,
              text: `Hi! Interested in "${item.title}" — can we meet near ${item.pickupArea}?`,
            }).then((r) => {
              setActionBusy(false);
              if (!r.ok) {
                setActionError(r.detail);
                return;
              }
              setMessageSent(true);
            });
          }}
        >
          <Ionicons name="chatbubble-outline" size={18} color="#1C1917" />
          <Text style={styles.footerSecondaryText}>
            {messageSent ? "Message sent" : "Message"}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.footerPrimary, reserved && styles.footerPrimaryDone]}
          disabled={actionBusy || reserved}
          onPress={() => {
            if (!item || reserved || actionBusy) return;
            setActionBusy(true);
            setActionError(null);
            void reserveShopListing({ listingId: item.id }).then((r) => {
              setActionBusy(false);
              if (!r.ok) {
                setActionError(r.detail);
                return;
              }
              setReserved(true);
            });
          }}
        >
          <Text style={styles.footerPrimaryText}>
            {reserved
              ? item.category === "Experiences"
                ? "Reserved"
                : "Reserved Â· pickup"
              : item.category === "Experiences"
                ? "Reserve seats"
                : "Buy / Reserve"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function RelatedListingCard({
  item,
  width,
  onPress,
  onImagesExhausted,
}: {
  item: ShopListing;
  width: number;
  onPress: () => void;
  onImagesExhausted: () => void;
}) {
  const candidates = useMemo(() => shopListingImageUrls(item), [item]);
  const [imageIndex, setImageIndex] = useState(0);
  const uri = candidates[imageIndex];
  if (!uri) return null;

  return (
    <Pressable style={[styles.relatedCard, { width }]} onPress={onPress}>
      <ExpoImage
        source={{ uri }}
        style={[styles.relatedImg, { width, height: width }]}
        contentFit="cover"
        onError={() => {
          if (imageIndex + 1 < candidates.length) {
            setImageIndex((i) => i + 1);
            return;
          }
          onImagesExhausted();
        }}
      />
      <Text style={styles.relatedPrice}>{formatEuro(item.priceCents)}</Text>
      <Text style={styles.relatedName} numberOfLines={2}>
        {item.title}
      </Text>
    </Pressable>
  );
}

function fulfillmentLabel(item: ShopListing): string {
  const mode =
    item.fulfillment === "both"
      ? "Pickup & delivery"
      : item.fulfillment === "delivery"
        ? "Delivery"
        : "Pickup only";
  return `${mode} Â· ${item.fulfillmentNote}`;
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color="#6B6560" style={styles.infoIcon} />
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F4EF" },
  content: { paddingBottom: 110 },
  missing: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F7F4EF",
  },
  missingText: { color: "#6B6560", fontSize: 16 },
  backLink: { marginTop: 14, padding: 10 },
  backLinkText: { fontWeight: "700", color: "#1C1917" },
  gallery: {
    width: "100%",
    backgroundColor: "#E8E2D8",
    position: "relative",
  },
  hero: { width: "100%", height: "100%" },
  galleryActions: {
    position: "absolute",
    top: 14,
    right: 14,
    flexDirection: "row",
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.94)",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbs: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
  },
  thumbsContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  thumbOn: { borderColor: "#FFF" },
  thumbImg: { width: "100%", height: "100%" },
  panel: { paddingHorizontal: 16, paddingTop: 16 },
  price: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1C1917",
    letterSpacing: -0.4,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1C1917",
    marginTop: 6,
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  badge: {
    backgroundColor: "#1C1917",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeText: { fontSize: 11, fontWeight: "700", color: "#FAF7F2" },
  metaLine: { fontSize: 13, color: "#6B6560", marginTop: 10 },
  story: {
    fontSize: 15,
    lineHeight: 22,
    color: "#3F3A36",
    marginTop: 14,
  },
  sellerCard: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#FFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E4DED4",
  },
  sellerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2A4A3A",
    alignItems: "center",
    justifyContent: "center",
  },
  sellerInitial: { color: "#F4F1EA", fontWeight: "800", fontSize: 18 },
  sellerBody: { marginLeft: 12, flex: 1 },
  sellerName: { fontSize: 15, fontWeight: "700", color: "#1C1917" },
  sellerMeta: { fontSize: 12, color: "#6B6560", marginTop: 2 },
  infoBlock: {
    marginTop: 16,
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#FFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E4DED4",
  },
  infoRow: { flexDirection: "row", alignItems: "flex-start" },
  infoIcon: { marginTop: 2, marginRight: 10 },
  infoText: { flex: 1 },
  infoLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B6560",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  infoValue: { fontSize: 14, color: "#1C1917", marginTop: 2, lineHeight: 20 },
  availRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 14,
  },
  availChip: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2A4A3A",
    backgroundColor: "#E4EDE6",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 980,
    overflow: "hidden",
  },
  relatedTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1C1917",
    marginTop: 28,
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  relatedRail: { gap: 12, paddingBottom: 8 },
  relatedCard: {},
  relatedImg: {
    borderRadius: 14,
    backgroundColor: "#E8E2D8",
  },
  relatedPrice: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1C1917",
    marginTop: 6,
  },
  relatedName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#3F3A36",
    marginTop: 2,
    lineHeight: 16,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: "rgba(247,244,239,0.96)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E4DED4",
  },
  footerSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#FFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E4DED4",
  },
  footerSecondaryText: { fontSize: 14, fontWeight: "700", color: "#1C1917" },
  footerPrimary: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#1C1917",
  },
  footerPrimaryDone: { backgroundColor: "#2A4A3A" },
  footerPrimaryText: { fontSize: 15, fontWeight: "800", color: "#FAF7F2" },
});
