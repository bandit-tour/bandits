import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { Stack, useLocalSearchParams, type Href } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import {
  fetchLiveSmartTravelerDetail,
  smartTravelerRedeemObjectId,
} from "@/lib/guest-workspace/liveSmartTraveler";
import { SMART_TRAVELER_PARTNERS, type SmartTravelerPartner } from "@/lib/guest-workspace/productWorlds";
import { useGuestLifecycle } from "@/lib/guest-lifecycle/useGuestLifecycle";
import { can } from "@/lib/guest-lifecycle/access";
import { color, radius } from "@/lib/guestDesign";
import { ImageRatio, imageFocusStyle } from "@/lib/imageRatios";
import { redeemSmartTravelerBenefit, saveGuestObject } from "@/lib/workspace/actions";

/**
 * Local Find detail — magazine recommendation for a SmartTraveler place.
 * Place first; Unlock Guest Privilege secondary.
 * Live Workspace detail first; DEMO seed only when labeled as editorial sample.
 */
export default function LocalFindDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const { access, isFullStay } = useGuestLifecycle();
  const stayPerks = can(access ?? "PRE_TRIP", "stay_smarttraveler_perks");

  const [place, setPlace] = useState<SmartTravelerPartner | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setActionError(null);
    void fetchLiveSmartTravelerDetail(id).then((live) => {
      if (cancelled) return;
      if (live) {
        setPlace(live);
        setIsDemo(false);
        setLoading(false);
        return;
      }
      const seed = SMART_TRAVELER_PARTNERS.find((p) => p.id === id) ?? null;
      setPlace(seed);
      setIsDemo(Boolean(seed));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const screenOptions = useAppBackScreenOptions({
    title: place?.businessName ?? "Local Find",
    fallback: "/smarttraveler" as Href,
    showBack: true,
  });

  if (loading) {
    return (
      <View style={styles.missing}>
        <Stack.Screen options={screenOptions} />
        <ActivityIndicator color={color.ink} />
        <Text style={[styles.missingText, { marginTop: 12 }]}>Opening this place…</Text>
      </View>
    );
  }

  if (!place) {
    return (
      <View style={styles.missing}>
        <Stack.Screen options={screenOptions} />
        <Text style={styles.missingText}>Place not found</Text>
      </View>
    );
  }

  const gallery = [
    place.imageUrl,
    ...place.gallery.filter((u) => u !== place.imageUrl),
  ];
  const mapQuery = encodeURIComponent(
    `${place.businessName} ${place.location} Athens`,
  );
  const redeemOfferId = smartTravelerRedeemObjectId(place);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={screenOptions} />

      {isDemo ? (
        <View style={styles.demoBanner}>
          <Text style={styles.demoBannerText}>
            Editorial sample — not live partner inventory
          </Text>
        </View>
      ) : null}

      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={styles.galleryScroll}
      >
        {gallery.map((uri) => (
          <View
            key={uri}
            style={[
              styles.galleryFrame,
              { width, aspectRatio: ImageRatio.portrait },
            ]}
          >
            <ExpoImage
              source={{ uri }}
              style={[styles.galleryImage, imageFocusStyle("center")]}
              contentFit="cover"
              transition={160}
            />
          </View>
        ))}
      </ScrollView>

      <View style={styles.body}>
        <Text style={styles.kicker}>
          {place.typeLabel} · {place.neighborhood}
        </Text>
        <Text style={styles.title}>{place.businessName}</Text>
        <Text style={styles.curator}>{place.curator}</Text>
        <Text style={styles.banditLine}>{place.banditLine}</Text>

        <Text style={styles.section}>Why banDit chose it</Text>
        <Text style={styles.prose}>{place.whyVisit}</Text>

        <Text style={styles.section}>Owner / maker</Text>
        <Text style={styles.prose}>{place.story}</Text>

        <Text style={styles.section}>What to look for</Text>
        <Text style={styles.prose}>{place.lookFor}</Text>

        <View style={styles.metaBlock}>
          <Text style={styles.metaLabel}>Neighbourhood</Text>
          <Text style={styles.metaValue}>{place.neighborhood}</Text>
          <Text style={[styles.metaLabel, styles.metaGap]}>Hours</Text>
          <Text style={styles.metaValue}>{place.hours}</Text>
          <Text style={[styles.metaLabel, styles.metaGap]}>Find it</Text>
          <Text style={styles.metaValue}>{place.location}</Text>
        </View>

        <Pressable
          style={styles.mapCta}
          onPress={() =>
            void Linking.openURL(
              `https://www.google.com/maps/search/?api=1&query=${mapQuery}`,
            )
          }
        >
          <Ionicons name="map-outline" size={18} color={color.ink} />
          <Text style={styles.mapCtaText}>Directions</Text>
        </Pressable>

        {place.guestPrivilege ? (
          <View style={styles.privilegeCard}>
            <Text style={styles.privilegeEyebrow}>Guest privilege</Text>
            <Text style={styles.privilegeTitle}>
              {place.guestPrivilege.label}
            </Text>
            <Text style={styles.privilegeDetail}>
              {place.guestPrivilege.detail}
            </Text>
            {!stayPerks ? (
              <Text style={styles.lockHint}>
                Guest privileges unlock during an active hotel stay
                {!isFullStay ? " — activate your stay to unlock this perk." : "."}
              </Text>
            ) : unlocked ? (
              <Text style={styles.unlocked}>
                Ready to show at the door · {place.guestPrivilege.label}
              </Text>
            ) : (
              <Pressable
                style={[styles.unlockCta, actionBusy && styles.ctaDisabled]}
                disabled={actionBusy}
                onPress={() => {
                  if (!place || unlocked || actionBusy) return;
                  setActionBusy(true);
                  setActionError(null);
                  void redeemSmartTravelerBenefit({
                    partnerId: place.id,
                    offerId: redeemOfferId,
                    title: place.guestPrivilege?.label || place.businessName,
                  }).then((r) => {
                    setActionBusy(false);
                    if (!r.ok) {
                      setActionError(r.detail);
                      return;
                    }
                    setUnlocked(true);
                  });
                }}
              >
                <Text style={styles.unlockCtaText}>
                  {actionBusy ? "Unlocking…" : "Unlock Guest Privilege"}
                </Text>
              </Pressable>
            )}
          </View>
        ) : null}

        {actionError ? <Text style={styles.actionError}>{actionError}</Text> : null}

        <Pressable
          style={[styles.saveCta, saved && styles.saveCtaOn, actionBusy && styles.ctaDisabled]}
          disabled={actionBusy}
          onPress={() => {
            if (!place || actionBusy) return;
            setActionBusy(true);
            setActionError(null);
            void saveGuestObject({
              objectType: "smarttraveler_place",
              objectId: place.id,
              title: place.businessName,
              source: "smarttraveler",
              saved,
            }).then((r) => {
              setActionBusy(false);
              if (!r.ok) {
                setActionError(r.detail);
                return;
              }
              setSaved((v) => !v);
            });
          }}
        >
          <Ionicons
            name={saved ? "heart" : "heart-outline"}
            size={18}
            color={saved ? color.brand : color.ink}
          />
          <Text style={[styles.saveCtaText, saved && styles.saveCtaTextOn]}>
            {saved ? "Saved to My Spots" : "Save to My Spots"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surfaceWarm },
  content: { paddingBottom: 56 },
  missing: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: color.surfaceWarm,
  },
  missingText: { color: color.muted, fontSize: 16 },
  demoBanner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.hairline,
  },
  demoBannerText: {
    fontSize: 12,
    fontWeight: "700",
    color: color.muted,
  },
  galleryScroll: { backgroundColor: color.imageFallback },
  galleryFrame: {
    backgroundColor: color.imageFallback,
    overflow: "hidden",
  },
  galleryImage: {
    width: "100%",
    height: "100%",
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  kicker: {
    fontSize: 12,
    fontWeight: "700",
    color: color.muted,
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: color.ink,
    marginTop: 6,
    letterSpacing: -0.3,
  },
  curator: {
    fontSize: 13,
    fontWeight: "700",
    color: color.brand,
    marginTop: 8,
  },
  banditLine: {
    fontSize: 16,
    color: color.inkSoft,
    marginTop: 10,
    lineHeight: 24,
  },
  section: {
    fontSize: 15,
    fontWeight: "800",
    color: color.ink,
    marginTop: 22,
    marginBottom: 8,
  },
  prose: {
    fontSize: 15,
    lineHeight: 23,
    color: color.inkSoft,
  },
  metaBlock: {
    marginTop: 22,
    padding: 16,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: color.muted,
  },
  metaGap: { marginTop: 12 },
  metaValue: {
    fontSize: 14,
    color: color.ink,
    marginTop: 4,
    lineHeight: 20,
  },
  mapCta: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.ink,
    backgroundColor: color.surface,
  },
  mapCtaText: {
    fontSize: 14,
    fontWeight: "700",
    color: color.ink,
  },
  privilegeCard: {
    marginTop: 22,
    padding: 16,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  privilegeEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: color.goldMicro,
  },
  privilegeTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: color.ink,
    marginTop: 6,
  },
  privilegeDetail: {
    fontSize: 14,
    color: color.inkSoft,
    marginTop: 6,
    lineHeight: 20,
  },
  lockHint: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 19,
    color: color.muted,
    fontWeight: "600",
  },
  unlockCta: {
    marginTop: 14,
    alignSelf: "flex-start",
    backgroundColor: color.brand,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  unlockCtaText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  unlocked: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(26,107,60,0.1)",
    color: color.statusGreen,
    fontWeight: "700",
    fontSize: 13,
  },
  actionError: {
    marginTop: 12,
    fontSize: 13,
    color: color.brand,
    fontWeight: "600",
  },
  ctaDisabled: { opacity: 0.6 },
  saveCta: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  saveCtaOn: {
    borderColor: color.brand,
  },
  saveCtaText: {
    fontSize: 14,
    fontWeight: "700",
    color: color.ink,
  },
  saveCtaTextOn: {
    color: color.brand,
  },
});
