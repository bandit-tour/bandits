/**
 * Outdoor results for Travel in a Bottle.
 * Availability is checked once per plan. Booking stays closed until both suppliers authorize it.
 */
import { Stack, useLocalSearchParams, type Href } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { humanDate } from "@/components/BottleDateRangeField";
import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import { BOTTLE_MATCHES } from "@/lib/guest-workspace/productWorlds";
import {
  bottlePlanFromSearchParams,
  bottlePlanParamKey,
  bottlePlanSearchKey,
  hotelProfileQuery,
  writeBottlePlanSelection,
  type BottlePlanSelection,
} from "@/lib/bottlePlanSelection";
import { quoteMixBooking } from "@/lib/guest-workspace/hotelBookingApi";
import type { WorkspaceBottleStay } from "@/lib/guest-workspace/liveBottle";
import { supabase } from "@/lib/supabase";
import { workspaceGet } from "@/lib/workspace/client";

type Phase = "loading" | "empty" | "results" | "error";

/** Editorial outdoor frames already in the Bottle catalog. Not hosts, prices, or availability. */
const OUTDOOR_INSPIRATION = BOTTLE_MATCHES.map((match) => ({
  id: match.id,
  title: match.second.name,
  location: match.second.location,
  type: match.second.type || "Outdoor stay",
  imageUrl: match.second.imageUrl,
})).filter((row) => /^https?:\/\//i.test(row.imageUrl));

function readParam(raw: Record<string, string | string[] | undefined>, key: string): string {
  const value = raw[key];
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
}

export default function BottleMixScreen() {
  const rawParams = useLocalSearchParams();
  const params = rawParams as Record<string, string | string[] | undefined>;
  const paramKey = bottlePlanParamKey(params);
  const sel = useMemo(() => {
    const [destination, checkIn, checkOut, travelers, hotelNights, outdoorNights, placeId, hotelSlug, hotelName] =
      paramKey.split("\u001f");
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
    });
  }, [paramKey]);
  const searchKey = sel ? bottlePlanSearchKey(sel) : "";

  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<Phase>(sel ? "loading" : "empty");
  const [stays, setStays] = useState<WorkspaceBottleStay[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const preview = OUTDOOR_INSPIRATION.find((row) => row.id === previewId) || null;
  const selRef = useRef<BottlePlanSelection | null>(sel);
  selRef.current = sel;
  const requestSerial = useRef(0);

  const hotelSlug = sel?.hotelSlug || "";
  const hotelName = sel?.hotelName || "";

  const screenOptions = useAppBackScreenOptions({
    title: hotelName || "Your stay",
    fallback: sel?.placeId
      ? (`/bottleHotel/place_${encodeURIComponent(sel.placeId)}?${hotelProfileQuery(sel)}` as Href)
      : hotelSlug
        ? (`/bottleHotel/${hotelSlug}?${hotelProfileQuery(sel!)}` as Href)
        : ("/travelBottle" as Href),
    showBack: true,
  });

  useEffect(() => {
    const plan = selRef.current;
    if (!plan || !searchKey) return;
    writeBottlePlanSelection(plan);
  }, [searchKey]);

  useEffect(() => {
    const plan = selRef.current;
    if (!plan || !searchKey) return;
    const serial = ++requestSerial.current;
    let cancelled = false;
    setPhase("loading");
    setAuthorized(false);
    setNote(null);
    const qs = new URLSearchParams({
      destination: plan.destination,
      checkIn: plan.checkIn,
      checkOut: plan.checkOut,
      travelers: String(plan.travelers),
    });
    void workspaceGet<{ ok?: boolean; stays?: WorkspaceBottleStay[] }>(
      `/api/public/bottle/stays?${qs.toString()}`,
    ).then((res) => {
      if (cancelled || serial !== requestSerial.current) return;
      if (!res.ok || res.data.ok === false) {
        setStays([]);
        setPhase("error");
        return;
      }
      const rows = (res.data.stays || []).filter((stay) => !stay.source || stay.source === "provider_record");
      setStays(rows);
      setPhase(rows.length ? "results" : "empty");
    });
    return () => {
      cancelled = true;
    };
  }, [searchKey, attempt]);

  useEffect(() => {
    const plan = selRef.current;
    if (!plan || !hotelSlug || phase !== "results" || !stays[0]) return;
    let cancelled = false;
    const stay = stays[0];
    const hotelCheckOutDate = new Date(`${plan.checkIn}T00:00:00Z`);
    hotelCheckOutDate.setUTCDate(hotelCheckOutDate.getUTCDate() + plan.hotelNights);
    const outdoorStart = hotelCheckOutDate.toISOString().slice(0, 10);
    const outdoorEndDate = new Date(`${outdoorStart}T00:00:00Z`);
    outdoorEndDate.setUTCDate(outdoorEndDate.getUTCDate() + plan.outdoorNights);
    void quoteMixBooking({
      hotelSlug,
      hotelCheckIn: plan.checkIn,
      hotelCheckOut: hotelCheckOutDate.toISOString().slice(0, 10),
      outdoorStayId: stay.id,
      outdoorCheckIn: outdoorStart,
      outdoorCheckOut: outdoorEndDate.toISOString().slice(0, 10),
      travelers: plan.travelers,
    }).then((res) => {
      if (cancelled) return;
      setAuthorized(Boolean(res.ok && res.data.ok && res.data.quote?.hotel && res.data.quote.outdoor));
    });
    return () => {
      cancelled = true;
    };
  }, [hotelSlug, phase, stays]);

  const onBook = async () => {
    if (!authorized || !sel || !hotelSlug || !stays[0] || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const { data } = await supabase.auth.getUser();
      const guestEmail = data.user?.email?.trim().toLowerCase() || "";
      if (!guestEmail || guestEmail === "guest@banditour.demo") {
        setNote("Booking stays closed until you are signed in and both stays are reserved.");
        return;
      }
      setNote("Booking stays closed until both stays are reserved.");
    } finally {
      setBusy(false);
    }
  };

  if (!sel || !hotelName) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={screenOptions} />
        <Text style={styles.status}>Choose a hotel in Travel in a Bottle first.</Text>
      </View>
    );
  }

  const status =
    phase === "loading"
      ? "Checking outdoor stays…"
      : phase === "error"
        ? "We couldn’t check outdoor stays."
        : "Outdoor stays coming soon.";

  return (
    <ScrollView style={styles.screen} testID="bottle-mix-screen">
      <Stack.Screen options={screenOptions} />
      <View style={styles.body}>
        <Text style={styles.hotel} testID="bottle-mix-hotel-name">
          {hotelName}
        </Text>
        <Text style={styles.meta} testID="bottle-mix-plan">
          {humanDate(sel.checkIn)} → {humanDate(sel.checkOut)} · {sel.hotelNights} hotel + {sel.outdoorNights} outdoor
        </Text>

        <View style={styles.summary} testID="bottle-mix-summary">
          <Text style={styles.summaryLine}>
            {sel.hotelNights} nights at {hotelName}
            {phase === "results" && stays[0]
              ? ` · ${stays[0].title}`
              : preview
                ? ` · ${preview.title}`
                : ` · ${sel.outdoorNights} outdoor`}
          </Text>
          {phase === "results" ? (
            <Text style={styles.verified}>Verified stay</Text>
          ) : (
            <Text style={styles.status} testID="bottle-mix-status">
              {status}
            </Text>
          )}
        </View>

        {phase === "results"
          ? stays.map((stay) => (
              <View key={stay.id} style={styles.card} testID={`bottle-mix-outdoor-${stay.id}`}>
                {stay.coverPhoto ? <Image source={{ uri: stay.coverPhoto }} style={styles.photo} /> : null}
                <Text style={styles.cardTitle}>{stay.title}</Text>
                {stay.location ? <Text style={styles.cardMeta}>{stay.location}</Text> : null}
                {stay.priceCentsPerNight > 0 ? (
                  <Text style={styles.cardMeta}>{`€${Math.round(stay.priceCentsPerNight / 100)} / night`}</Text>
                ) : null}
              </View>
            ))
          : (
            <View testID="bottle-mix-inspiration">
              {OUTDOOR_INSPIRATION.map((row) => {
                const selected = row.id === previewId;
                return (
                  <Pressable
                    key={row.id}
                    style={[styles.card, selected && styles.cardOn]}
                    onPress={() => setPreviewId(row.id)}
                    testID={`bottle-outdoor-inspiration-${row.id}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Image source={{ uri: row.imageUrl }} style={styles.photo} />
                    <Text style={styles.cardTitle}>{row.title}</Text>
                    <Text style={styles.cardMeta}>
                      {row.type} · {row.location}
                    </Text>
                    <Text style={styles.inspiration}>Inspiration · not bookable</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

        {phase === "error" ? (
          <Pressable
            style={styles.retry}
            onPress={() => setAttempt((n) => n + 1)}
            testID="bottle-mix-retry"
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        ) : null}

        {phase === "results" ? (
          <Pressable
            style={[styles.book, !authorized && styles.bookOff]}
            disabled={!authorized || busy}
            onPress={() => void onBook()}
            testID="bottle-mix-checkout"
            accessibilityState={{ disabled: !authorized || busy }}
          >
            <Text style={styles.bookText}>Book mix</Text>
          </Pressable>
        ) : null}
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F5F1" },
  body: { padding: 20, maxWidth: 640, alignSelf: "center", width: "100%" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  hotel: { fontSize: 28, fontWeight: "800", color: "#1A1510", marginBottom: 8 },
  meta: { fontSize: 15, color: "#5C5348", marginBottom: 18 },
  status: { fontSize: 16, lineHeight: 22, color: "#3A3228" },
  summary: { marginBottom: 16 },
  summaryLine: { fontSize: 16, lineHeight: 22, color: "#1A1510", fontWeight: "700", marginBottom: 6 },
  verified: { fontSize: 13, fontWeight: "700", color: "#1A1510" },
  inspiration: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: "#6B5E4E",
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  card: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#FFFCF7",
    borderWidth: 1,
    borderColor: "#E6DFD3",
    marginBottom: 12,
  },
  photo: { width: "100%", height: 220 },
  cardOn: { borderColor: "#1A1510", borderWidth: 2 },
  cardTitle: { fontSize: 17, fontWeight: "700", color: "#1A1510", padding: 14 },
  cardMeta: { fontSize: 13, color: "#6B5E4E", paddingHorizontal: 14, paddingBottom: 14 },
  retry: {
    marginTop: 18,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#1A1510",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  retryText: { fontSize: 15, fontWeight: "700", color: "#1A1510" },
  book: {
    marginTop: 16,
    backgroundColor: "#C8C2B8",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  bookOff: { opacity: 0.55 },
  bookText: { color: "#FFFCF7", fontWeight: "700", fontSize: 15 },
  note: { color: "#6B5E4E", marginTop: 12, lineHeight: 20 },
});
