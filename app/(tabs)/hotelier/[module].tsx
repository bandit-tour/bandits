import { Image as ExpoImage } from "expo-image";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import { HotelierAccessGate } from "@/components/guest-lifecycle/HotelierAccessGate";
import {
  HOTELIER_MODULES,
  rewritePlaySandboxCopy,
  type HotelierModuleId,
} from "@/lib/guest-workspace/hotelierDashboard";
import { useGuestLifecycle } from "@/lib/guest-lifecycle/useGuestLifecycle";
import { liveHotelDisplayName } from "@/lib/stay/liveHotelIdentity";
import { ImageRatio, imageFocusStyle } from "@/lib/imageRatios";
import { claimHotelOffer, submitHotelRequest } from "@/lib/workspace/actions";

function isModuleId(v: string): v is HotelierModuleId {
  return v in HOTELIER_MODULES;
}

/** Hotelier module (Breakfast, Restaurant, Spa…) — Back → Dashboard. FULL_STAY only. */
export default function HotelierModuleScreen() {
  return (
    <HotelierAccessGate capability="hotel_services">
      <HotelierModuleBody />
    </HotelierAccessGate>
  );
}

function HotelierModuleBody() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { module: raw } = useLocalSearchParams<{ module: string }>();
  const moduleId = String(raw || "");
  const content = isModuleId(moduleId) ? HOTELIER_MODULES[moduleId] : null;
  const [claimed, setClaimed] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimBusy, setClaimBusy] = useState(false);
  const heroW = Math.min(360, Math.max(280, width - 32));
  const heroH = Math.min(240, Math.max(180, Math.round(heroW * 0.75)));

  const { activeStay } = useGuestLifecycle();
  const hotelName = liveHotelDisplayName({
    stayName: activeStay?.hotelName,
    slug: activeStay?.hotelSlug,
  });
  const copyCtx = {
    hotelName,
    roomNumber: activeStay?.roomNumber,
    hotelSlug: activeStay?.hotelSlug,
  };
  const title = content ? rewritePlaySandboxCopy(content.title, copyCtx) : "Service";
  const screenOptions = useAppBackScreenOptions({
    title,
    fallback: "/hotelier" as Href,
    showBack: true,
  });

  const openItem = (title: string, detail: string) => {
    const itemId = encodeURIComponent(title.toLowerCase().replace(/\s+/g, "-").slice(0, 48));
    router.push({
      pathname: "/hotelier/item/[itemId]",
      params: {
        itemId,
        module: moduleId,
        title,
        detail,
      },
    } as any);
  };

  if (!content) {
    return (
      <View style={styles.missing}>
        <Stack.Screen options={screenOptions} />
        <Text style={styles.missingText}>Service not found</Text>
        <Pressable onPress={() => router.replace("/hotelier" as Href)}>
          <Text style={styles.link}>â† Back to Hotelier</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator
      nestedScrollEnabled
    >
      <Stack.Screen options={screenOptions} />
      <View style={[styles.heroWrap, { width: heroW, height: heroH }]}>
        <ExpoImage
          source={{ uri: content.heroImage }}
          style={[styles.hero, imageFocusStyle("center")]}
          contentFit="cover"
        />
      </View>
      <Text style={styles.kicker}>{rewritePlaySandboxCopy(content.kicker, copyCtx)}</Text>
      <Text style={styles.title}>{rewritePlaySandboxCopy(content.title, copyCtx)}</Text>
      <Text style={styles.lead}>{rewritePlaySandboxCopy(content.lead, copyCtx)}</Text>
      <View style={styles.chips}>
        {content.chips.map((c) => (
          <Text key={c} style={styles.chip}>
            {c}
          </Text>
        ))}
      </View>

      {claimError ? <Text style={styles.claimed}>{claimError}</Text> : null}
      {claimed ? <Text style={styles.claimed}>{claimed}</Text> : null}

      {content.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text style={styles.sectionTitle}>{rewritePlaySandboxCopy(section.heading, copyCtx)}</Text>
          {section.items.map((item) => (
            <Pressable
              key={item.title}
              style={styles.row}
              onPress={() =>
                openItem(
                  rewritePlaySandboxCopy(item.title, copyCtx),
                  rewritePlaySandboxCopy(item.detail, copyCtx),
                )
              }
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{rewritePlaySandboxCopy(item.title, copyCtx)}</Text>
                <Text style={styles.rowDetail}>{rewritePlaySandboxCopy(item.detail, copyCtx)}</Text>
              </View>
              <Text style={styles.rowCta}>{item.cta || "Open"}</Text>
            </Pressable>
          ))}
        </View>
      ))}

      <Pressable
        style={styles.primary}
        onPress={() => {
          if (!content || claimed || claimBusy) return;
          setClaimBusy(true);
          setClaimError(null);
          void claimHotelOffer({
            offerId: `${moduleId}:${content.primaryCta}`,
            title: content.primaryCta,
          }).then((r) => {
            setClaimBusy(false);
            if (!r.ok) {
              const detail = String(r.detail || '');
              setClaimError(
                detail ||
                  'This hotel action needs a verified stay. Use Connect My New Stay from More.',
              );
              return;
            }
            setClaimed(`${content.primaryCta} · confirmed`);
          });
        }}
      >
        <Text style={styles.primaryText}>{content.primaryCta}</Text>
      </Pressable>
      {claimError ? (
        <Pressable
          style={styles.secondary}
          onPress={() => router.push('/reactivateStay' as Href)}
          accessibilityRole="button"
          testID="hotel-module-connect-stay"
        >
          <Text style={styles.secondaryText}>Connect My New Stay</Text>
        </Pressable>
      ) : content.secondaryCta ? (
        <Pressable
          style={styles.secondary}
          disabled={claimBusy}
          onPress={() => {
            if (claimBusy) return;
            setClaimBusy(true);
            setClaimError(null);
            void submitHotelRequest({
              requestType: moduleId,
              title: content.secondaryCta,
              objectId: `${moduleId}:secondary`,
            }).then((r) => {
              setClaimBusy(false);
              if (!r.ok) {
                setClaimError(
                  String(r.detail || '') ||
                    'Hotel request needs a verified stay and Workspace. Use Connect My New Stay.',
                );
                return;
              }
              setClaimed(`${content.secondaryCta} · confirmed`);
            });
          }}
          accessibilityRole="button"
          testID="hotel-module-secondary-cta"
        >
          <Text style={styles.secondaryText}>{content.secondaryCta}</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0F0E0C" },
  content: { paddingBottom: 48, paddingTop: 12 },
  heroWrap: {
    marginHorizontal: 16,
    maxWidth: 360,
    maxHeight: 240,
    aspectRatio: ImageRatio.landscape,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#2A2620",
    alignSelf: "flex-start",
  },
  hero: { width: "100%", height: "100%" },
  kicker: {
    marginTop: 16,
    marginHorizontal: 16,
    fontSize: 12,
    fontWeight: "800",
    color: "rgba(240,215,160,0.85)",
    textTransform: "uppercase",
  },
  title: { marginHorizontal: 16, fontSize: 28, fontWeight: "800", color: "#F7F2E8", marginTop: 4 },
  lead: {
    marginHorizontal: 16,
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(247,242,232,0.7)",
    marginTop: 8,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, margin: 16 },
  chip: {
    backgroundColor: "rgba(240,215,160,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "700",
    color: "#F0D7A0",
    overflow: "hidden",
  },
  claimed: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(240,215,160,0.14)",
    color: "#F0D7A0",
    fontWeight: "700",
  },
  section: { marginHorizontal: 16, marginTop: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#F7F2E8", marginBottom: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1814",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(240,215,160,0.1)",
  },
  rowTitle: { fontSize: 15, fontWeight: "800", color: "#F7F2E8" },
  rowDetail: { fontSize: 13, color: "rgba(247,242,232,0.55)", marginTop: 4 },
  rowCta: { fontSize: 13, fontWeight: "800", color: "#F0D7A0" },
  primary: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: "#F0D7A0",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryText: { color: "#0A0908", fontWeight: "800", fontSize: 15 },
  secondary: { marginHorizontal: 16, marginTop: 10, paddingVertical: 12, alignItems: "center" },
  secondaryText: { color: "#F0D7A0", fontWeight: "700" },
  missing: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  missingText: { fontSize: 16, color: "rgba(247,242,232,0.6)", marginBottom: 12 },
  link: { color: "#F0D7A0", fontWeight: "700", fontSize: 16 },
});
