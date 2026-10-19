/**
 * Flow B — Travel in a Bottle Mix (hotel + outdoor, single checkout when both legs secure).
 * Search runs once per plan. Book Mix stays closed until both suppliers authorize the dates.
 */
import { Stack, useLocalSearchParams, type Href } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { humanDate } from "@/components/BottleDateRangeField";
import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import {
  bottlePlanFromSearchParams,
  bottlePlanParamKey,
  bottlePlanSearchKey,
  writeBottlePlanSelection,
  type BottlePlanSelection,
} from "@/lib/bottlePlanSelection";
import { fetchLiveBottleStays, type WorkspaceBottleStay } from "@/lib/guest-workspace/liveBottle";
import { checkoutMixBooking, quoteMixBooking, type HotelBookingQuote } from "@/lib/guest-workspace/hotelBookingApi";
import { supabase } from "@/lib/supabase";
import { workspaceGet } from "@/lib/workspace/client";

type MixQuote = {
  hotel: HotelBookingQuote;
  outdoor: HotelBookingQuote;
  guestTotalCents: number;
  guestServiceFeeCents: number;
};

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
  const autorun = readParam(params, "autorun") === "1" || readParam(params, "autorun") === "true";
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

  const [loading, setLoading] = useState(autorun && Boolean(sel));
  const [outdoor, setOutdoor] = useState<WorkspaceBottleStay[]>([]);
  const [pick, setPick] = useState<string | null>(null);
  const [quote, setQuote] = useState<MixQuote | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const selRef = useRef(sel);
  selRef.current = sel;
  const requestSerial = useRef(0);
  const runMixRef = useRef<(plan: BottlePlanSelection) => Promise<void>>(async () => undefined);

  const hotelSlug = sel?.hotelSlug || "";
  const hotelName = sel?.hotelName || "Your hotel";
  const hotelPlaceId = sel?.placeId || hotelSlug || "hotel";
  const bothAuthorized = Boolean(quote?.hotel && quote?.outdoor && pick && hotelSlug);

  const screenOptions = useAppBackScreenOptions({
    title: "Build my mix",
    fallback: sel?.placeId
      ? (`/bottleHotel/place_${encodeURIComponent(sel.placeId)}?checkIn=${sel.checkIn}&checkOut=${sel.checkOut}&travelers=${sel.travelers}` as Href)
      : hotelSlug
        ? (`/bottleHotel/${hotelSlug}?checkIn=${sel?.checkIn}&checkOut=${sel?.checkOut}&travelers=${sel?.travelers}` as Href)
        : ("/travelBottle" as Href),
    showBack: true,
  });

  const runMix = useCallback(async (plan: BottlePlanSelection) => {
    const serial = ++requestSerial.current;
    setLoading(true);
    setErr(null);
    setQuote(null);
    setDone(null);
    try {
      const qs = new URLSearchParams({
        destination: plan.destination,
        checkIn: plan.checkIn,
        checkOut: plan.checkOut,
        travelers: String(plan.travelers),
        hotelName: plan.hotelName || hotelName,
        hotelPlaceId: plan.placeId || hotelPlaceId,
      });
      await workspaceGet(`/api/public/bottle/mix?${qs}`);
      const stays = await fetchLiveBottleStays();
      if (serial !== requestSerial.current) return;
      setOutdoor(stays);
      setPick((current) => (current && stays.some((stay) => stay.id === current) ? current : null));
    } catch (e) {
      if (serial !== requestSerial.current) return;
      setErr(e instanceof Error ? e.message : "Mix failed");
    } finally {
      if (serial === requestSerial.current) setLoading(false);
    }
  }, [hotelName, hotelPlaceId]);

  runMixRef.current = runMix;

  useEffect(() => {
    const plan = selRef.current;
    if (!plan || !searchKey) return;
    writeBottlePlanSelection(plan);
  }, [searchKey]);

  useEffect(() => {
    if (!autorun || !searchKey) return;
    const plan = selRef.current;
    if (!plan) return;
    void runMixRef.current(plan);
  }, [autorun, searchKey]);

  const verifyQuote = async () => {
    if (!sel || verifying) return;
    setQuote(null);
    setDone(null);
    if (!pick || !hotelSlug) {
      setErr(
        `${hotelName} stays on this plan. Book Mix stays closed until both the hotel and an outdoor host authorize these dates.`,
      );
      return;
    }
    setVerifying(true);
    setErr(null);
    try {
      const hotelCheckOutDate = new Date(`${sel.checkIn}T00:00:00Z`);
      hotelCheckOutDate.setUTCDate(hotelCheckOutDate.getUTCDate() + sel.hotelNights);
      const outdoorStart = hotelCheckOutDate.toISOString().slice(0, 10);
      const outdoorEndDate = new Date(`${outdoorStart}T00:00:00Z`);
      outdoorEndDate.setUTCDate(outdoorEndDate.getUTCDate() + sel.outdoorNights);
      const res = await quoteMixBooking({
        hotelSlug,
        hotelCheckIn: sel.checkIn,
        hotelCheckOut: hotelCheckOutDate.toISOString().slice(0, 10),
        outdoorStayId: pick,
        outdoorCheckIn: outdoorStart,
        outdoorCheckOut: outdoorEndDate.toISOString().slice(0, 10),
        travelers: sel.travelers,
      });
      if (!res.ok || !res.data.ok || !res.data.quote?.hotel || !res.data.quote.outdoor) {
        setQuote(null);
        setErr(
          !res.ok
            ? res.detail
            : res.data.error || "Both calendars must be open before Book Mix can continue.",
        );
        return;
      }
      setQuote(res.data.quote);
    } finally {
      setVerifying(false);
    }
  };

  const onCheckout = async () => {
    if (!sel || !pick || !hotelSlug || !quote?.hotel || !quote.outdoor || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const { data } = await supabase.auth.getUser();
      const guestEmail = data.user?.email?.trim().toLowerCase() || "";
      if (!guestEmail || guestEmail === "guest@banditour.demo") {
        setErr("Book Mix stays closed until you are signed in and both suppliers authorize the stay.");
        return;
      }
      const hotelCheckOutDate = new Date(`${sel.checkIn}T00:00:00Z`);
      hotelCheckOutDate.setUTCDate(hotelCheckOutDate.getUTCDate() + sel.hotelNights);
      const outdoorStart = hotelCheckOutDate.toISOString().slice(0, 10);
      const outdoorEndDate = new Date(`${outdoorStart}T00:00:00Z`);
      outdoorEndDate.setUTCDate(outdoorEndDate.getUTCDate() + sel.outdoorNights);
      const res = await checkoutMixBooking({
        hotelSlug,
        hotelCheckIn: sel.checkIn,
        hotelCheckOut: hotelCheckOutDate.toISOString().slice(0, 10),
        outdoorStayId: pick,
        outdoorCheckIn: outdoorStart,
        outdoorCheckOut: outdoorEndDate.toISOString().slice(0, 10),
        travelers: sel.travelers,
        guestEmail,
      });
      if (!res.ok) {
        setErr(res.detail);
        return;
      }
      if (res.data.ok && res.data.reservationRef) setDone(`Mix reserved · ${res.data.reservationRef}`);
      else setErr(res.data.error || res.data.code || "Checkout was not authorized.");
    } finally {
      setBusy(false);
    }
  };

  if (!sel) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={screenOptions} />
        <Text>Add dates and a hotel in Travel in a Bottle first.</Text>
      </View>
    );
  }

  const status = loading
    ? "Checking outdoor stays…"
    : outdoor.length === 0
      ? "No verified outdoor stays for these dates yet."
      : "These outdoor stays are listed only. Book Mix stays closed until both calendars are authorized.";

  return (
    <ScrollView style={styles.screen} testID="bottle-mix-screen">
      <Stack.Screen options={screenOptions} />
      <View style={styles.body}>
        <Text style={styles.kicker}>Travel in a Bottle · Mix</Text>
        <Text style={styles.hotel} testID="bottle-mix-hotel-name">
          {hotelName}
        </Text>
        <Text style={styles.meta} testID="bottle-mix-plan">
          {sel.destination} · {humanDate(sel.checkIn)} → {humanDate(sel.checkOut)} · {sel.hotelNights} hotel +{" "}
          {sel.outdoorNights} outdoor
        </Text>
        <Text style={styles.status} testID="bottle-mix-status">
          {status}
        </Text>

        {outdoor.map((s) => (
          <Pressable
            key={s.id}
            style={[styles.card, pick === s.id && styles.cardOn]}
            onPress={() => {
              setPick(s.id);
              setQuote(null);
              setDone(null);
              setErr(null);
            }}
            testID={`bottle-mix-outdoor-${s.id}`}
          >
            <Text style={styles.cardTitle}>{s.title}</Text>
            <Text style={styles.cardMeta}>{s.location}</Text>
          </Pressable>
        ))}

        <Pressable
          style={styles.ghost}
          disabled={verifying}
          onPress={() => void verifyQuote()}
          testID="bottle-mix-verify"
        >
          <Text style={styles.ghostText}>{verifying ? "Verifying calendars…" : "Verify both calendars"}</Text>
        </Pressable>
        {quote ? (
          <Text style={styles.quote} testID="bottle-mix-quote">
            Pay {Math.round(quote.guestTotalCents / 100)} EUR · service fee {Math.round(quote.guestServiceFeeCents / 100)} EUR
          </Text>
        ) : null}
        <Pressable
          style={[styles.cta, (busy || !bothAuthorized) && styles.ctaOff]}
          disabled={busy || !bothAuthorized}
          onPress={() => void onCheckout()}
          testID="bottle-mix-checkout"
          accessibilityState={{ disabled: busy || !bothAuthorized }}
        >
          <Text style={styles.ctaText}>{busy ? "Booking…" : "Book mix in banDiTour"}</Text>
        </Pressable>
        {err ? (
          <Text style={styles.err} testID="bottle-mix-error">
            {err}
          </Text>
        ) : null}
        {done ? <Text style={styles.ok}>{done}</Text> : null}
        <Pressable
          style={styles.ghost}
          disabled={loading}
          onPress={() => {
            if (sel) void runMix(sel);
          }}
          testID="bottle-mix-refresh"
        >
          <Text style={styles.ghostText}>{loading ? "Checking outdoor stays…" : "Check again"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F5F1" },
  body: { padding: 20, maxWidth: 640, alignSelf: "center", width: "100%" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  kicker: { fontSize: 11, fontWeight: "800", color: "#8A7A66", letterSpacing: 0.8, textTransform: "uppercase" },
  hotel: { fontSize: 28, fontWeight: "800", color: "#1A1510", marginVertical: 8 },
  meta: { fontSize: 14, color: "#5C5348", marginBottom: 12 },
  status: { fontSize: 15, color: "#6B5E4E", marginBottom: 16, lineHeight: 22 },
  card: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#FFFCF7",
    borderWidth: 1,
    borderColor: "#E6DFD3",
    marginBottom: 10,
  },
  cardOn: { borderColor: "#1A1510" },
  cardTitle: { fontSize: 17, fontWeight: "700", color: "#1A1510" },
  cardMeta: { fontSize: 13, color: "#6B5E4E", marginTop: 4 },
  ghost: { paddingVertical: 12, alignItems: "center" },
  ghostText: { fontSize: 15, fontWeight: "600", color: "#3A3228" },
  quote: { fontSize: 16, fontWeight: "700", marginVertical: 8, color: "#1A1510" },
  cta: {
    backgroundColor: "#1A1510",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  ctaOff: { opacity: 0.45 },
  ctaText: { color: "#FFFCF7", fontWeight: "700", fontSize: 15 },
  err: { color: "#8B3A3A", marginTop: 12, lineHeight: 20 },
  ok: { color: "#2C5E4E", marginTop: 12, fontWeight: "600" },
});
