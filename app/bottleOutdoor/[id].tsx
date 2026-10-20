/**
 * Outdoor property profile for Travel in a Bottle.
 * Verified stays show supplier fields only. Samples stay labeled previews.
 */
import { Image as ExpoImage } from "expo-image";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { BottleJourneySteps } from "@/components/BottleJourneySteps";
import { humanDate } from "@/components/BottleDateRangeField";
import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import {
  bottlePlanFromSearchParams,
  bottlePlanParamKey,
  mixSearchParams,
  writeBottlePlanSelection,
  type BottleOutdoorPick,
  type BottlePlanSelection,
} from "@/lib/bottlePlanSelection";
import { conceptJourneyLine, getBottleMatchById } from "@/lib/guest-workspace/productWorlds";
import type { WorkspaceBottleStay } from "@/lib/guest-workspace/liveBottle";
import { workspaceGet } from "@/lib/workspace/client";

type DemoRow = { id: string; title?: string; location?: string; labelled?: string };

function euros(cents: number) {
  return `€${Math.round(cents / 100)}`;
}

export default function BottleOutdoorProfileScreen() {
  const router = useRouter();
  const raw = useLocalSearchParams();
  const params = raw as Record<string, string | string[] | undefined>;
  const id = typeof raw.id === "string" ? raw.id : "";
  const paramKey = bottlePlanParamKey(params);
  const plan = useMemo(() => {
    const [
      destination,
      checkIn,
      checkOut,
      travelers,
      hotelNights,
      outdoorNights,
      placeId,
      hotelSlug,
      hotelName,
      outdoorKind,
      outdoorId,
    ] = paramKey.split("\u001f");
    return bottlePlanFromSearchParams({
      destination,
      checkIn,
      checkOut,
      travelers,
      hotelNights,
      outdoorNights,
      placeId,
      hotelSlug,
      hotelName,
      outdoorKind,
      outdoorId,
    });
  }, [paramKey]);

  const kind: BottleOutdoorPick["kind"] =
    plan?.outdoorPick?.kind ||
    (id === "bottle-test-fixture" ? "test" : getBottleMatchById(id) ? "inspiration" : "verified");
  const sample = getBottleMatchById(id);
  const [stay, setStay] = useState<WorkspaceBottleStay | null>(null);
  const [demo, setDemo] = useState<DemoRow | null>(null);
  const [loaded, setLoaded] = useState(kind !== "verified" && kind !== "demo");
  const [zoom, setZoom] = useState<string | null>(null);

  useEffect(() => {
    if (kind !== "verified" && kind !== "demo") return;
    let alive = true;
    void workspaceGet<{ stays?: WorkspaceBottleStay[]; demoStays?: DemoRow[]; stay?: WorkspaceBottleStay | null }>(
      `/api/public/bottle/stays?id=${encodeURIComponent(id)}`,
    ).then((res) => {
      if (!alive) return;
      if (res.ok) {
        const verified = (res.data.stays || []).find((row) => row.id === id) || (res.data.stay?.id === id ? res.data.stay : null);
        setStay(verified && (!verified.source || verified.source === "provider_record") ? verified : null);
        setDemo((res.data.demoStays || []).find((row) => row.id === id) || null);
      }
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [id, kind]);

  const backToMix = () => {
    if (!plan?.hotelName) {
      router.replace("/travelBottle" as Href);
      return;
    }
    const next: BottlePlanSelection = { ...plan, outdoorPick: { kind, id } };
    writeBottlePlanSelection(next);
    router.replace(`/bottleMix?${new URLSearchParams(mixSearchParams(next)).toString()}` as Href);
  };

  const screenOptions = useAppBackScreenOptions({
    title: "Outdoor stay",
    fallback: plan?.hotelName
      ? (`/bottleMix?${new URLSearchParams(mixSearchParams({ ...plan, outdoorPick: { kind, id } })).toString()}` as Href)
      : ("/travelBottle" as Href),
    showBack: true,
  });

  const title =
    kind === "test"
      ? "Concept"
      : kind === "inspiration"
        ? sample?.second.name || "Concept"
        : kind === "demo"
          ? demo?.title || "Concept"
          : stay?.title || "Outdoor stay";
  const photos =
    kind === "inspiration"
      ? [sample?.second.imageUrl, ...(sample?.second.gallery || [])].filter((url): url is string => Boolean(url && /^https?:\/\//i.test(url)))
      : kind === "verified"
        ? [stay?.coverPhoto, ...(stay?.photos || [])].filter((url): url is string => Boolean(url && /^https?:\/\//i.test(url)))
        : [];
  const reviewJourney = () => {
    if (!plan?.hotelName) return;
    const next: BottlePlanSelection = { ...plan, outdoorPick: { kind, id } };
    writeBottlePlanSelection(next);
    const qs = new URLSearchParams(mixSearchParams(next));
    qs.set("stage", "review");
    router.push(`/bottleMix?${qs.toString()}` as Href);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body} testID="bottle-outdoor-profile">
      <Stack.Screen options={screenOptions} />
      <BottleJourneySteps active={2} />
      <Pressable onPress={backToMix} testID="bottle-outdoor-back" accessibilityRole="button">
        <Text style={styles.back}>Back to Outdoor Stays</Text>
      </Pressable>
      {plan?.hotelName ? (
        <Text style={styles.plan} testID="bottle-outdoor-plan">
          {plan.hotelName}
          {plan.checkIn && plan.checkOut
            ? ` · ${humanDate(plan.checkIn)} → ${humanDate(plan.checkOut)} · ${plan.hotelNights} hotel + ${plan.outdoorNights} outdoor`
            : ""}
        </Text>
      ) : null}
      <Text style={styles.title} testID="bottle-outdoor-name">
        {title}
      </Text>
      <Text style={styles.badge} testID="bottle-outdoor-sample-label">
        {kind === "verified" ? "Verified outdoor stay" : "Concept · not bookable"}
      </Text>

      {photos.length ? (
        <View testID="bottle-outdoor-gallery">
          {photos.map((uri, index) => (
            <Pressable key={uri} onPress={() => setZoom(uri)} accessibilityRole="button">
              <ExpoImage source={{ uri }} style={index === 0 ? styles.photoLead : styles.photo} contentFit="cover" />
            </Pressable>
          ))}
          {kind !== "verified" ? (
            <Text style={styles.bodyCopy}>Concept imagery. Not photographs of a host property.</Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.bodyCopy}>No photo is published for this concept.</Text>
      )}

      {kind === "inspiration" && sample ? (
        <View testID="bottle-outdoor-details">
          <Text style={styles.bodyCopy} testID="bottle-outdoor-story">
            {conceptJourneyLine({
              hotelName: plan?.hotelName,
              hotelNights: plan?.hotelNights,
              outdoorNights: plan?.outdoorNights,
              concept: sample.second.type || "second sleep",
            })}
          </Text>
          {sample.second.location ? <Text style={styles.bodyCopy}>{sample.second.location}</Text> : null}
          {sample.second.type ? <Text style={styles.bodyCopy}>{sample.second.type}</Text> : null}
          {sample.second.attributes?.length ? (
            <Text style={styles.bodyCopy}>{sample.second.attributes.join(" · ")}</Text>
          ) : null}
          <Text style={styles.bodyCopy}>No supplier calendar or price. This concept cannot be booked.</Text>
        </View>
      ) : null}

      {kind === "verified" ? (
        <View testID="bottle-outdoor-details">
          {!loaded ? <Text style={styles.bodyCopy}>Loading the supplier listing…</Text> : null}
          {loaded && !stay ? (
            <Text style={styles.bodyCopy}>This stay is not in the verified outdoor catalog.</Text>
          ) : null}
          {stay ? (
            <>
              {stay.description ? (
                <>
                  <Text style={styles.section}>Description</Text>
                  <Text style={styles.bodyCopy}>{stay.description}</Text>
                </>
              ) : null}
              <Text style={styles.section}>Sleeping arrangement</Text>
              <Text style={styles.bodyCopy}>{stay.natureType || "Outdoor stay"}</Text>
              {stay.amenities?.length ? (
                <>
                  <Text style={styles.section}>Amenities</Text>
                  {stay.amenities.map((item) => (
                    <Text key={item} style={styles.bodyCopy}>
                      {item}
                    </Text>
                  ))}
                </>
              ) : null}
              {stay.maxGuests ? (
                <>
                  <Text style={styles.section}>Capacity</Text>
                  <Text style={styles.bodyCopy}>{stay.maxGuests} guests</Text>
                </>
              ) : null}
              {stay.location ? (
                <>
                  <Text style={styles.section}>Location</Text>
                  <Text style={styles.bodyCopy}>{stay.location}</Text>
                  <Text style={styles.bodyCopy}>A map pin appears when the supplier publishes coordinates.</Text>
                </>
              ) : null}
              {stay.hostName ? (
                <>
                  <Text style={styles.section}>Host</Text>
                  <Text style={styles.bodyCopy}>{stay.hostName}</Text>
                </>
              ) : null}
              {stay.cancellation ? (
                <>
                  <Text style={styles.section}>Policy</Text>
                  <Text style={styles.bodyCopy}>{stay.cancellation}</Text>
                </>
              ) : null}
              <Text style={styles.section}>Calendar and price</Text>
              {stay.availableDates?.length ? (
                <Text style={styles.bodyCopy}>
                  {stay.availableDates.length} supplier-approved nights
                  {stay.priceCentsPerNight > 0 ? ` · ${euros(stay.priceCentsPerNight)} / night` : ""}
                </Text>
              ) : (
                <Text style={styles.bodyCopy}>No supplier calendar is published for this listing.</Text>
              )}
              <Pressable style={styles.button} onPress={reviewJourney} testID="bottle-outdoor-review" accessibilityRole="button">
                <Text style={styles.buttonText}>Review Journey</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      ) : null}

      {kind !== "verified" && plan?.hotelName ? (
        <Pressable style={styles.button} onPress={reviewJourney} testID="bottle-outdoor-review" accessibilityRole="button">
          <Text style={styles.buttonText}>Review Journey</Text>
        </Pressable>
      ) : null}

      {zoom ? (
        <Modal visible animationType="fade" onRequestClose={() => setZoom(null)}>
          <View style={styles.lightbox}>
            <Pressable onPress={() => setZoom(null)} style={styles.lightboxBar}>
              <Text style={styles.lightboxBack}>← Back</Text>
            </Pressable>
            <ExpoImage source={{ uri: zoom }} style={styles.lightboxImage} contentFit="contain" />
          </View>
        </Modal>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F5F1" },
  body: { padding: 20, paddingBottom: 48, maxWidth: 720, alignSelf: "center", width: "100%" },
  back: { fontSize: 16, fontWeight: "700", color: "#1A1510", marginBottom: 12 },
  plan: { fontSize: 14, color: "#5C5348", marginBottom: 8 },
  title: { fontSize: 28, fontWeight: "800", color: "#1A1510", marginBottom: 6 },
  badge: { fontSize: 13, fontWeight: "700", color: "#6B5E4E", marginBottom: 12 },
  section: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#8A7A66",
    marginTop: 14,
    marginBottom: 6,
  },
  bodyCopy: { fontSize: 15, lineHeight: 22, color: "#2C261E", marginBottom: 4 },
  photoLead: { width: "100%", height: 320, borderRadius: 16, marginBottom: 10, backgroundColor: "#E8E2D8" },
  photo: { width: "100%", height: 180, borderRadius: 16, marginBottom: 10, backgroundColor: "#E8E2D8" },
  button: {
    marginTop: 16,
    backgroundColor: "#1A1510",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { color: "#FFFCF7", fontWeight: "700", fontSize: 15 },
  lightbox: { flex: 1, backgroundColor: "#0E0C0A" },
  lightboxBar: { paddingTop: Platform.OS === "web" ? 16 : 48, paddingHorizontal: 16, paddingBottom: 12 },
  lightboxBack: { color: "#F7F5F1", fontSize: 16, fontWeight: "700" },
  lightboxImage: { flex: 1, margin: 12 },
});
