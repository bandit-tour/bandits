/**
 * MIX MY STAY — outdoor discovery, night split, and checkout.
 * Verified Workspace stays are booked only after both calendars quote.
 * Editorial cards and the TEST fixture never become a reservation.
 */
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { humanDate } from "@/components/BottleDateRangeField";
import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import {
  isTestFixtureLabel,
  readBottleBookingHistory,
  rememberBottleBooking,
  type BottleBookingRecord,
} from "@/lib/bottleBookingHistory";
import {
  bottlePlanFromSearchParams,
  bottlePlanParamKey,
  bottlePlanSearchKey,
  hotelProfileQuery,
  mixSearchParams,
  writeBottlePlanSelection,
  type BottleOutdoorPick,
  type BottlePlanSelection,
} from "@/lib/bottlePlanSelection";
import { BOTTLE_MATCHES } from "@/lib/guest-workspace/productWorlds";
import { checkoutMixBooking, quoteMixBooking, type HotelBookingQuote } from "@/lib/guest-workspace/hotelBookingApi";
import type { WorkspaceBottleStay } from "@/lib/guest-workspace/liveBottle";
import { ensureAnonymousSession } from "@/lib/pilotSession";
import { workspaceGet } from "@/lib/workspace/client";

type Phase = "loading" | "empty" | "results" | "error";

type MixQuote = {
  hotel: HotelBookingQuote;
  outdoor: HotelBookingQuote;
  guestTotalCents: number;
  guestServiceFeeCents: number;
};

/** Editorial outdoor frames already in the Bottle catalog. Not hosts, prices, or availability. */
const OUTDOOR_INSPIRATION = BOTTLE_MATCHES.map((match) => ({
  id: match.id,
  title: match.second.name,
  location: match.second.location,
  type: match.second.type || "Outdoor stay",
  imageUrl: match.second.imageUrl,
})).filter((row) => /^https?:\/\//i.test(row.imageUrl));

const TEST_FIXTURE_ID = "bottle-test-fixture";

function eur(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(
    cents / 100,
  );
}

function stayNights(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const start = Date.parse(`${checkIn}T00:00:00Z`);
  const end = Date.parse(`${checkOut}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / 86400000);
}

function legDates(sel: BottlePlanSelection) {
  const hotelOut = new Date(`${sel.checkIn}T00:00:00Z`);
  hotelOut.setUTCDate(hotelOut.getUTCDate() + sel.hotelNights);
  const outdoorIn = hotelOut.toISOString().slice(0, 10);
  const outdoorOut = new Date(`${outdoorIn}T00:00:00Z`);
  outdoorOut.setUTCDate(outdoorOut.getUTCDate() + sel.outdoorNights);
  return {
    hotelCheckIn: sel.checkIn,
    hotelCheckOut: hotelOut.toISOString().slice(0, 10),
    outdoorCheckIn: outdoorIn,
    outdoorCheckOut: outdoorOut.toISOString().slice(0, 10),
  };
}

export default function BottleMixScreen() {
  const router = useRouter();
  const rawParams = useLocalSearchParams();
  const params = rawParams as Record<string, string | string[] | undefined>;
  const paramKey = bottlePlanParamKey(params);
  const sel = useMemo(() => {
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
  const searchKey = sel ? bottlePlanSearchKey(sel) : "";
  const pick = sel?.outdoorPick || null;

  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<Phase>(sel ? "loading" : "empty");
  const [stays, setStays] = useState<WorkspaceBottleStay[]>([]);
  const [demos, setDemos] = useState<Array<{ id: string; title?: string; location?: string; labelled?: string }>>([]);
  const [quote, setQuote] = useState<MixQuote | null>(null);
  const [quoteReason, setQuoteReason] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [email, setEmail] = useState("");
  const [history, setHistory] = useState<BottleBookingRecord[]>([]);
  const selRef = useRef<BottlePlanSelection | null>(sel);
  selRef.current = sel;
  const requestSerial = useRef(0);

  const hotelSlug = sel?.hotelSlug || "";
  const hotelName = sel?.hotelName || "";
  const selectedStay = pick?.kind === "verified" ? stays.find((stay) => stay.id === pick.id) || null : null;
  const selectedInspiration =
    pick?.kind === "inspiration" ? OUTDOOR_INSPIRATION.find((row) => row.id === pick.id) || null : null;

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
    setHistory(readBottleBookingHistory());
  }, [note]);

  useEffect(() => {
    const plan = selRef.current;
    if (!plan || !searchKey) return;
    writeBottlePlanSelection(plan);
  }, [searchKey, pick?.kind, pick?.id]);

  useEffect(() => {
    const plan = selRef.current;
    if (!plan || !searchKey) return;
    const serial = ++requestSerial.current;
    let cancelled = false;
    setPhase("loading");
    setNote(null);
    const dated = Boolean(plan.checkIn && plan.checkOut);
    const qs = new URLSearchParams({
      destination: plan.destination || "Athens",
      travelers: String(plan.travelers),
    });
    if (dated) {
      qs.set("checkIn", plan.checkIn);
      qs.set("checkOut", plan.checkOut);
    }
    void workspaceGet<{
      ok?: boolean;
      stays?: WorkspaceBottleStay[];
      demoStays?: Array<{ id: string; title?: string; location?: string; labelled?: string }>;
    }>(
      dated ? `/api/public/bottle/stays?${qs.toString()}` : "/api/public/bottle/stays",
    ).then((res) => {
      if (cancelled || serial !== requestSerial.current) return;
      if (!res.ok || res.data.ok === false) {
        setStays([]);
        setDemos([]);
        setPhase("error");
        return;
      }
      const rows = (res.data.stays || []).filter((stay) => !stay.source || stay.source === "provider_record");
      setStays(rows);
      setDemos(res.data.demoStays || []);
      setPhase(rows.length ? "results" : "empty");
    });
    return () => {
      cancelled = true;
    };
  }, [searchKey, attempt]);

  useEffect(() => {
    const plan = selRef.current;
    if (!plan || pick?.kind !== "verified" || !hotelSlug || !plan.checkIn || !plan.checkOut || !selectedStay) {
      setAuthorized(false);
      setQuote(null);
      setChecking(false);
      if (pick?.kind === "verified" && !selectedStay && phase !== "loading") {
        setQuoteReason("That verified stay is not in the current outdoor list. Checkout is off.");
      } else {
        setQuoteReason(null);
      }
      return;
    }
    let cancelled = false;
    setChecking(true);
    setAuthorized(false);
    setQuote(null);
    setQuoteReason(null);
    const legs = legDates(plan);
    void quoteMixBooking({
      hotelSlug,
      hotelCheckIn: legs.hotelCheckIn,
      hotelCheckOut: legs.hotelCheckOut,
      outdoorStayId: selectedStay.id,
      outdoorCheckIn: legs.outdoorCheckIn,
      outdoorCheckOut: legs.outdoorCheckOut,
      travelers: plan.travelers,
    }).then((res) => {
      if (cancelled) return;
      setChecking(false);
      const payload = res.ok ? res.data : null;
      const ready = Boolean(payload?.ok && payload.quote?.hotel && payload.quote.outdoor);
      setAuthorized(ready);
      setQuote(ready && payload?.quote ? payload.quote : null);
      if (!ready) {
        const reason = payload?.error || (!res.ok ? res.detail : "") || "calendars_not_open";
        setQuoteReason(
          reason === "hotel_not_bookable" || reason === "HOTEL_NOT_BOOKABLE"
            ? "The hotel calendar is not open for these nights. Checkout is off."
            : reason === "outdoor_unavailable" || reason === "OUTDOOR_UNAVAILABLE" || reason === "outdoor_dates_conflict"
              ? "The outdoor calendar is not open for these nights. Checkout is off."
              : "Both calendars are not open for these nights. Checkout is off.",
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [hotelSlug, phase, pick?.kind, pick?.id, selectedStay, searchKey]);

  const persist = (next: BottlePlanSelection) => {
    writeBottlePlanSelection(next);
    router.replace(`/bottleMix?${new URLSearchParams(mixSearchParams(next)).toString()}` as Href);
  };

  const choose = (outdoorPick: BottleOutdoorPick) => {
    if (!sel) return;
    persist({ ...sel, outdoorPick });
  };

  const shiftNights = (delta: number) => {
    if (!sel) return;
    const total = stayNights(sel.checkIn, sel.checkOut);
    if (total < 2) return;
    const hotelNights = Math.min(total - 1, Math.max(1, sel.hotelNights + delta));
    persist({ ...sel, hotelNights, outdoorNights: total - hotelNights });
  };

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase());
  const nameOk = guestName.trim().length >= 2;
  const canPay = Boolean(authorized && quote && selectedStay && emailOk && nameOk && !busy);

  const onBook = async () => {
    if (!canPay || !sel || !selectedStay || pick?.kind !== "verified") return;
    setBusy(true);
    setNote(null);
    try {
      await ensureAnonymousSession();
      const guestEmail = email.trim().toLowerCase();
      const legs = legDates(sel);
      const res = await checkoutMixBooking({
        hotelSlug,
        hotelCheckIn: legs.hotelCheckIn,
        hotelCheckOut: legs.hotelCheckOut,
        outdoorStayId: selectedStay.id,
        outdoorCheckIn: legs.outdoorCheckIn,
        outdoorCheckOut: legs.outdoorCheckOut,
        travelers: sel.travelers,
        guestEmail,
        guestName: guestName.trim(),
      });
      if (!res.ok || !res.data.ok) {
        setNote(res.ok ? res.data.error || "Mix checkout did not complete. No booking was confirmed." : res.detail);
        return;
      }
      const payload = res.data as {
        reservationRef?: string;
        hotelBooking?: { reservationRef?: string };
        outdoorBookingId?: string;
      };
      const reservationRef = payload.reservationRef || payload.hotelBooking?.reservationRef || payload.outdoorBookingId || "";
      if (!reservationRef) {
        setNote("Checkout did not return a reservation reference. No booking was confirmed.");
        return;
      }
      const testFixture = isTestFixtureLabel(selectedStay.title) || isTestFixtureLabel(hotelName);
      const row: BottleBookingRecord = {
        id: reservationRef,
        flow: "mix",
        hotelName,
        outdoorTitle: selectedStay.title,
        checkIn: sel.checkIn,
        checkOut: sel.checkOut,
        travelers: sel.travelers,
        totalCents: quote?.guestTotalCents ?? null,
        reservationRef,
        testFixture,
        guestName: guestName.trim(),
        createdAt: new Date().toISOString(),
      };
      setHistory(rememberBottleBooking(row));
      setNote(
        testFixture
          ? `TEST reservation recorded · ${reservationRef}. This is not a genuine guest stay.`
          : `Confirmed · ${reservationRef}`,
      );
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

  const totalNights = stayNights(sel.checkIn, sel.checkOut);
  const legs = sel.checkIn && sel.checkOut ? legDates(sel) : null;
  const outdoorTitle =
    selectedStay?.title ||
    selectedInspiration?.title ||
    (pick?.kind === "test" ? "TEST FIXTURE" : "Choose an outdoor stay");
  const checkoutBlock = pick
    ? pick.kind === "inspiration"
      ? "Sample inspiration is not bookable. Checkout is off. No reservation will be created."
      : pick.kind === "test"
        ? "TEST FIXTURE — not a host, calendar, or price. Checkout is off. No reservation will be created."
        : !sel.checkIn || !sel.checkOut
          ? "Add dates to check both calendars. Checkout is off."
          : !hotelSlug
            ? "This hotel has no contracted calendar, so both stays cannot be reserved together. Checkout is off."
            : checking
              ? "Checking the hotel calendar and the outdoor calendar…"
              : authorized
                ? null
                : quoteReason || "Both calendars are not open. Checkout is off."
    : "Select an outdoor stay to continue. Checkout stays off until both calendars are verified.";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body} testID="bottle-mix-screen">
      <Stack.Screen options={screenOptions} />
      <Text style={styles.hotel} testID="bottle-mix-hotel-name">
        {hotelName}
      </Text>
      <Text style={styles.meta} testID="bottle-mix-plan">
        {sel.checkIn && sel.checkOut
          ? `${humanDate(sel.checkIn)} → ${humanDate(sel.checkOut)} · ${sel.hotelNights} hotel + ${sel.outdoorNights} outdoor · ${sel.travelers} guests`
          : `${sel.travelers} guests · add dates to split nights`}
      </Text>

      <View style={styles.summary} testID="bottle-mix-summary">
        <Text style={styles.summaryLine}>
          {sel.hotelNights} nights at {hotelName} · {outdoorTitle}
        </Text>
        {legs ? (
          <Text style={styles.cardMeta}>
            Hotel {humanDate(legs.hotelCheckIn)} → {humanDate(legs.hotelCheckOut)} · Outdoor {humanDate(legs.outdoorCheckIn)} →{" "}
            {humanDate(legs.outdoorCheckOut)}
          </Text>
        ) : null}
      </View>

      {totalNights >= 2 ? (
        <View style={styles.split} testID="bottle-mix-night-split">
          <Text style={styles.section}>Night split</Text>
          <View style={styles.splitRow}>
            <Pressable style={styles.step} onPress={() => shiftNights(-1)} testID="bottle-mix-hotel-nights-dec" accessibilityRole="button">
              <Text style={styles.stepText}>−</Text>
            </Pressable>
            <Text style={styles.splitCount}>
              {sel.hotelNights} hotel · {sel.outdoorNights} outdoor
            </Text>
            <Pressable style={styles.step} onPress={() => shiftNights(1)} testID="bottle-mix-hotel-nights-inc" accessibilityRole="button">
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Text style={styles.cardMeta}>A night split needs at least two nights. The outdoor catalog is still open.</Text>
      )}

      <Text style={styles.section}>Verified outdoor stays</Text>
      {phase === "loading" ? <Text style={styles.status}>Checking verified outdoor stays…</Text> : null}
      {phase === "error" ? (
        <Text style={styles.status} testID="bottle-mix-status">
          We couldn’t check outdoor stays. Inspiration below is not a booking.
        </Text>
      ) : null}
      {phase === "empty" ? (
        <Text style={styles.status} testID="bottle-mix-status">
          No verified outdoor host has published nights for this search. Bookings are not available until a host does.
          The designs below are sample inspiration, not stays you can reserve.
        </Text>
      ) : null}
      {phase === "results" ? (
        <View testID="bottle-mix-verified">
          {stays.map((stay) => {
            const selected = pick?.kind === "verified" && pick.id === stay.id;
            return (
              <Pressable
                key={stay.id}
                style={[styles.card, selected && styles.cardOn]}
                onPress={() => choose({ kind: "verified", id: stay.id })}
                testID={`bottle-mix-outdoor-${stay.id}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                {stay.coverPhoto ? <Image source={{ uri: stay.coverPhoto }} style={styles.photo} /> : null}
                <Text style={styles.cardTitle}>{stay.title}</Text>
                {stay.location ? <Text style={styles.cardMeta}>{stay.location}</Text> : null}
                <Text style={styles.verified}>Verified stay</Text>
                {stay.priceCentsPerNight > 0 ? (
                  <Text style={styles.cardMeta}>{`€${Math.round(stay.priceCentsPerNight / 100)} / night`}</Text>
                ) : (
                  <Text style={styles.cardMeta}>Supplier price appears after both calendars confirm.</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {demos.length ? (
        <View testID="bottle-mix-demo">
          <Text style={styles.section}>Workspace demo seeds</Text>
          <Text style={styles.cardMeta}>These records are labelled demo. They are not verified hosts and cannot be reserved.</Text>
          {demos.map((demo) => (
            <View key={demo.id} style={styles.card}>
              <Text style={styles.cardTitle}>{demo.title || demo.id}</Text>
              {demo.location ? <Text style={styles.cardMeta}>{demo.location}</Text> : null}
              <Text style={styles.inspiration}>{demo.labelled || "DEMO — not production inventory"}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Text style={styles.section}>Sample inspiration</Text>
      <Text style={styles.cardMeta}>
        Editorial designs from Travel in a Bottle. Not hosts, calendars, or prices.
      </Text>
      <View testID="bottle-mix-inspiration">
        {OUTDOOR_INSPIRATION.map((row) => {
          const selected = pick?.kind === "inspiration" && pick.id === row.id;
          return (
            <Pressable
              key={row.id}
              style={[styles.card, selected && styles.cardOn]}
              onPress={() => choose({ kind: "inspiration", id: row.id })}
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

      <Pressable
        style={[styles.card, styles.testCard, pick?.kind === "test" && styles.cardOn]}
        onPress={() => choose({ kind: "test", id: TEST_FIXTURE_ID })}
        testID="bottle-outdoor-test-fixture"
        accessibilityRole="button"
        accessibilityState={{ selected: pick?.kind === "test" }}
      >
        <Text style={styles.cardTitle}>TEST FIXTURE</Text>
        <Text style={styles.cardMeta}>
          Isolated screen check only. This is not a host, a calendar, or a price, and it cannot become a reservation.
        </Text>
      </Pressable>

      {phase === "error" ? (
        <Pressable style={styles.retry} onPress={() => setAttempt((n) => n + 1)} testID="bottle-mix-retry" accessibilityRole="button">
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      ) : null}

      {pick ? (
        <View style={styles.summary} testID="bottle-mix-booking">
          <Text style={styles.section}>Reservation summary</Text>
          <Text style={styles.summaryLine}>{hotelName}</Text>
          <Text style={styles.cardMeta}>
            {sel.hotelNights} hotel nights · {sel.outdoorNights} outdoor nights · {sel.travelers} guests
          </Text>
          <Text style={styles.cardMeta}>{outdoorTitle}</Text>
          {authorized && quote ? (
            <View testID="bottle-mix-total">
              <Text style={styles.summaryLine}>Total {eur(quote.guestTotalCents)}</Text>
              <Text style={styles.cardMeta}>Service fee {eur(quote.guestServiceFeeCents)}</Text>
              {selectedStay?.cancellation ? <Text style={styles.cardMeta}>{selectedStay.cancellation}</Text> : (
                <Text style={styles.cardMeta}>Cancellation terms appear when the supplier publishes them.</Text>
              )}
            </View>
          ) : (
            <Text style={styles.status} testID="bottle-mix-checkout-reason">
              {checkoutBlock}
            </Text>
          )}
          {authorized ? (
            <>
              <TextInput
                value={guestName}
                onChangeText={setGuestName}
                placeholder="Guest name"
                style={styles.input}
                testID="bottle-mix-guest-name"
              />
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="Email for this booking"
                style={styles.input}
                testID="bottle-mix-email"
              />
            </>
          ) : null}
          <Pressable
            style={[styles.book, !canPay && styles.bookOff]}
            disabled={!canPay}
            onPress={() => void onBook()}
            testID="bottle-mix-checkout"
            accessibilityRole="button"
            accessibilityState={{ disabled: !canPay }}
          >
            <Text style={styles.bookText}>{busy ? "Booking…" : "Book mix"}</Text>
          </Pressable>
        </View>
      ) : null}

      {note ? (
        <Text style={styles.note} testID="bottle-mix-confirmed">
          {note}
        </Text>
      ) : null}

      <View testID="bottle-booking-history">
        <Text style={styles.section}>Booking history</Text>
        {history.length === 0 ? (
          <Text style={styles.cardMeta}>No confirmed Bottle reservations on this device.</Text>
        ) : (
          history.map((row) => (
            <View key={row.reservationRef} style={styles.card}>
              <Text style={styles.cardTitle}>
                {row.testFixture ? "TEST reservation" : "Confirmed"} · {row.reservationRef}
              </Text>
              <Text style={styles.cardMeta}>
                {row.hotelName}
                {row.outdoorTitle ? ` · ${row.outdoorTitle}` : ""} · {row.flow}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F5F1" },
  body: { padding: 20, paddingBottom: 48, maxWidth: 640, alignSelf: "center", width: "100%" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#F7F5F1" },
  hotel: { fontSize: 28, fontWeight: "800", color: "#1A1510", marginBottom: 8 },
  meta: { fontSize: 15, color: "#5C5348", marginBottom: 18 },
  status: { fontSize: 16, lineHeight: 22, color: "#3A3228", marginBottom: 12 },
  summary: { marginBottom: 16 },
  summaryLine: { fontSize: 16, lineHeight: 22, color: "#1A1510", fontWeight: "700", marginBottom: 6 },
  section: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#8A7A66",
    marginTop: 8,
    marginBottom: 8,
  },
  split: { marginBottom: 12 },
  splitRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  splitCount: { fontSize: 16, fontWeight: "700", color: "#1A1510" },
  step: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#1A1510",
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { fontSize: 18, fontWeight: "700", color: "#1A1510" },
  verified: { fontSize: 13, fontWeight: "700", color: "#1A1510", paddingHorizontal: 14, paddingBottom: 8 },
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
  testCard: { padding: 14, backgroundColor: "#EDE7DC" },
  photo: { width: "100%", height: 220, backgroundColor: "#E8E2D8" },
  cardOn: { borderColor: "#1A1510", borderWidth: 2 },
  cardTitle: { fontSize: 17, fontWeight: "700", color: "#1A1510", paddingHorizontal: 14, paddingTop: 14 },
  cardMeta: { fontSize: 13, lineHeight: 18, color: "#6B5E4E", paddingHorizontal: 14, paddingBottom: 8 },
  retry: {
    marginTop: 8,
    marginBottom: 12,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#1A1510",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  retryText: { fontSize: 15, fontWeight: "700", color: "#1A1510" },
  input: {
    borderWidth: 1,
    borderColor: "#D4CBBE",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "#FFFCF7",
    marginHorizontal: 0,
  },
  book: {
    marginTop: 8,
    backgroundColor: "#1A1510",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  bookOff: { opacity: 0.45 },
  bookText: { color: "#FFFCF7", fontWeight: "700", fontSize: 15 },
  note: { color: "#1A1510", marginTop: 12, lineHeight: 20, fontWeight: "700" },
});
