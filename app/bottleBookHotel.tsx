/**
 * Flow A — Book Hotel Only.
 * Checkout runs only when Workspace returns a supplier quote for contracted inventory.
 */
import { Image as ExpoImage } from "expo-image";
import { Stack, useLocalSearchParams, type Href } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { humanDate } from "@/components/BottleDateRangeField";
import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import {
  isTestFixtureLabel,
  readBottleBookingHistory,
  rememberBottleBooking,
  type BottleBookingRecord,
} from "@/lib/bottleBookingHistory";
import { hotelProfileQuery } from "@/lib/bottlePlanSelection";
import { fetchAthensHotelDetail } from "@/lib/guest-workspace/athensHotelPlaces";
import {
  checkoutHotelBooking,
  fetchHotelBookingAvailability,
  type HotelBookingQuote,
} from "@/lib/guest-workspace/hotelBookingApi";
import { loadHotelBottleListing, type HotelBottleListing } from "@/lib/guest-workspace/hotelBottleListing";
import { ensureAnonymousSession } from "@/lib/pilotSession";

function eur(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(
    cents / 100,
  );
}

function unavailableCopy(reason: string | null, hasDates: boolean): string {
  if (!hasDates) return "Add dates in the Bottle plan to check the supplier calendar. Checkout is off.";
  if (reason === "nonpartner_or_unpublished" || reason === "no_slug") {
    return "banDiTour cannot sell rooms here yet. This hotel has no contracted inventory. Checkout is off. No reservation was created.";
  }
  if (reason === "no_published_rooms") {
    return "This partner has not published rooms for these dates. Checkout is off.";
  }
  if (reason === "unavailable_or_unpriced") {
    return "No supplier rate is open for these dates. Checkout is off.";
  }
  if (reason === "invalid_dates" || reason === "invalid_stay_length") {
    return "These dates cannot be checked. Checkout is off.";
  }
  return "Not available to book in banDiTour for these dates. Checkout is off. No reservation was created.";
}

export default function BottleBookHotelScreen() {
  const params = useLocalSearchParams<{
    slug?: string;
    hotelSlug?: string;
    hotelName?: string;
    placeId?: string;
    checkIn?: string;
    checkOut?: string;
    travelers?: string;
    roomId?: string;
    destination?: string;
  }>();
  const slug =
    (typeof params.slug === "string" && params.slug) ||
    (typeof params.hotelSlug === "string" && params.hotelSlug) ||
    "";
  const placeId = typeof params.placeId === "string" ? params.placeId : "";
  const checkIn = typeof params.checkIn === "string" ? params.checkIn : "";
  const checkOut = typeof params.checkOut === "string" ? params.checkOut : "";
  const travelers = Math.max(1, Number(params.travelers) || 2);
  const presetRoom = typeof params.roomId === "string" ? params.roomId : "";
  const passedName = typeof params.hotelName === "string" ? params.hotelName : "";

  const [email, setEmail] = useState("");
  const [guestName, setGuestName] = useState("");
  const [listing, setListing] = useState<HotelBottleListing | null>(null);
  const [placePhoto, setPlacePhoto] = useState<string | null>(null);
  const [placeName, setPlaceName] = useState("");
  const [rooms, setRooms] = useState<Array<{ id: string; name: string; totalCents: number | null }>>([]);
  const [roomId, setRoomId] = useState(presetRoom);
  const [quote, setQuote] = useState<HotelBookingQuote | null>(null);
  const [bookable, setBookable] = useState(false);
  const [reason, setReason] = useState<string | null>(slug ? null : "no_slug");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<BottleBookingRecord[]>([]);

  const hotelName = placeName || listing?.displayName || passedName || (slug ? slug.replace(/-/g, " ") : "Hotel");
  const backQuery = hotelProfileQuery({
    destination: typeof params.destination === "string" ? params.destination : "Athens",
    checkIn,
    checkOut,
    travelers,
    hotelNights: 1,
    outdoorNights: 1,
    hotelName,
  });
  const screenOptions = useAppBackScreenOptions({
    title: "Book hotel",
    fallback: (placeId
      ? `/bottleHotel/place_${encodeURIComponent(placeId)}?${backQuery}`
      : `/bottleHotel/${slug || "hotel"}?${backQuery}`) as Href,
    showBack: true,
  });

  useEffect(() => {
    setHistory(readBottleBookingHistory());
  }, [msg]);

  useEffect(() => {
    if (!slug) return;
    void loadHotelBottleListing(slug, { allowPlayFallback: false }).then(setListing);
  }, [slug]);

  useEffect(() => {
    if (!placeId) return;
    void fetchAthensHotelDetail(placeId).then((res) => {
      if (!res.hotel) return;
      setPlaceName(res.hotel.name);
      setPlacePhoto(res.hotel.photoUrls[0] || null);
    });
  }, [placeId]);

  useEffect(() => {
    let alive = true;
    if (!slug || !checkIn || !checkOut) {
      if (!slug) setReason("no_slug");
      else if (!checkIn || !checkOut) setReason("invalid_dates");
      setBookable(false);
      setQuote(null);
      return () => {
        alive = false;
      };
    }
    void fetchHotelBookingAvailability(slug, checkIn, checkOut, travelers, roomId || undefined).then((res) => {
      if (!alive) return;
      if (!res.ok) {
        setBookable(false);
        setReason(res.detail);
        setQuote(null);
        return;
      }
      setBookable(Boolean(res.data.bookable));
      setReason(res.data.reason || null);
      setQuote(res.data.quote || null);
      const list = res.data.availability?.rooms || [];
      setRooms(list);
      if (!roomId && list[0]) setRoomId(list[0].id);
    });
    return () => {
      alive = false;
    };
  }, [slug, checkIn, checkOut, travelers, roomId]);

  const guestEmail = email.trim().toLowerCase();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail);
  const nameOk = guestName.trim().length >= 2;
  const selected = rooms.find((room) => room.id === roomId) || null;
  const testRoom = isTestFixtureLabel(selected?.name) || isTestFixtureLabel(hotelName);
  const photo =
    placePhoto ||
    listing?.remoteGalleryUrls[0] ||
    listing?.roomTypes.find((room) => room.id === roomId)?.photoUrls[0] ||
    null;
  const canPay = Boolean(bookable && quote && roomId && emailOk && nameOk && !busy);

  const onBook = async () => {
    if (!canPay || !quote || !roomId) return;
    setBusy(true);
    setMsg(null);
    try {
      await ensureAnonymousSession();
      const res = await checkoutHotelBooking({
        hotelSlug: slug,
        roomId,
        checkIn,
        checkOut,
        travelers,
        guestEmail,
      });
      if (!res.ok || !res.data.ok || !res.data.reservationRef) {
        setMsg(res.ok ? res.data.error || "Could not complete booking. No reservation was created." : res.detail);
        return;
      }
      const row: BottleBookingRecord = {
        id: res.data.reservationRef,
        flow: "hotel",
        hotelName,
        checkIn,
        checkOut,
        travelers,
        totalCents: quote.guestTotalCents,
        reservationRef: res.data.reservationRef,
        testFixture: testRoom,
        guestName: guestName.trim(),
        createdAt: new Date().toISOString(),
      };
      setHistory(rememberBottleBooking(row));
      setMsg(
        testRoom
          ? `TEST reservation recorded · ${res.data.reservationRef}. This is not a genuine guest stay.`
          : `Confirmed · ${res.data.reservationRef}`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="bottle-book-hotel">
      <Stack.Screen options={screenOptions} />
      <Text style={styles.kicker}>Book Hotel Only</Text>
      <Text style={styles.title} testID="bottle-book-hotel-name">
        {hotelName}
      </Text>
      {photo ? <ExpoImage source={{ uri: photo }} style={styles.photo} contentFit="cover" /> : null}
      <Text style={styles.meta} testID="bottle-book-dates">
        {checkIn && checkOut ? `${humanDate(checkIn)} → ${humanDate(checkOut)}` : "Dates not set"} · {travelers} guests
      </Text>

      {!bookable || !quote ? (
        <Text style={styles.warn} testID="bottle-book-unavailable">
          {unavailableCopy(reason, Boolean(checkIn && checkOut))}
        </Text>
      ) : (
        <View testID="bottle-book-summary">
          {rooms.map((room) => (
            <Pressable
              key={room.id}
              style={[styles.room, roomId === room.id && styles.roomOn]}
              onPress={() => setRoomId(room.id)}
              testID={`bottle-book-room-${room.id}`}
            >
              <Text style={styles.roomName}>{room.name}</Text>
              {isTestFixtureLabel(room.name) ? (
                <Text style={styles.roomPrice}>TEST FIXTURE — not a genuine reservation</Text>
              ) : null}
              {room.totalCents ? <Text style={styles.roomPrice}>{eur(room.totalCents)} supplier total</Text> : (
                <Text style={styles.roomPrice}>No supplier rate for these dates</Text>
              )}
            </Pressable>
          ))}
          <View style={styles.quote} testID="bottle-book-quote">
            <Text style={styles.quoteLine}>Total {eur(quote.guestTotalCents)}</Text>
            <Text style={styles.quoteSub}>Service fee {eur(quote.guestServiceFeeCents)} · Pay in banDiTour</Text>
            <Text style={styles.quoteSub}>Taxes are included here only when the supplier publishes them in the rate.</Text>
          </View>
          {listing?.policies?.length ? (
            <View testID="bottle-book-policy">
              {listing.policies.map((policy) => (
                <Text key={policy} style={styles.policy}>
                  {policy}
                </Text>
              ))}
            </View>
          ) : (
            <Text style={styles.policy} testID="bottle-book-policy">
              Cancellation terms appear when the supplier publishes them.
            </Text>
          )}
          <TextInput
            value={guestName}
            onChangeText={setGuestName}
            placeholder="Guest name"
            style={styles.input}
            testID="bottle-book-name"
          />
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Email for this booking"
            style={styles.input}
            testID="bottle-book-email"
          />
        </View>
      )}

      <Pressable
        style={[styles.cta, !canPay && styles.ctaDisabled]}
        disabled={!canPay}
        onPress={() => void onBook()}
        testID="bottle-book-pay"
        accessibilityRole="button"
        accessibilityState={{ disabled: !canPay }}
      >
        <Text style={styles.ctaText}>{busy ? "Booking…" : "Book and pay"}</Text>
      </Pressable>
      {msg ? (
        <Text style={styles.msg} testID="bottle-book-confirmed">
          {msg}
        </Text>
      ) : null}

      <View testID="bottle-booking-history">
        <Text style={styles.kicker}>Booking history</Text>
        {history.length === 0 ? <Text style={styles.policy}>No confirmed Bottle reservations on this device.</Text> : null}
        {history.map((row) => (
          <View key={row.reservationRef} style={styles.room}>
            <Text style={styles.roomName}>
              {row.testFixture ? "TEST reservation" : "Confirmed"} · {row.reservationRef}
            </Text>
            <Text style={styles.roomPrice}>
              {row.hotelName}
              {row.outdoorTitle ? ` · ${row.outdoorTitle}` : ""}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F5F1" },
  content: { padding: 20, maxWidth: 560, alignSelf: "center", width: "100%", paddingBottom: 48 },
  kicker: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "#8A7A66",
    textTransform: "uppercase",
    marginTop: 12,
  },
  title: { fontSize: 26, fontWeight: "800", color: "#1A1510", marginVertical: 8 },
  photo: { width: "100%", height: 220, borderRadius: 16, backgroundColor: "#E8E2D8", marginBottom: 12 },
  meta: { fontSize: 14, color: "#5C5348", marginBottom: 16 },
  warn: { fontSize: 15, lineHeight: 22, color: "#6B5E4E", marginBottom: 16 },
  room: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E6DFD3",
    marginBottom: 8,
    backgroundColor: "#FFFCF7",
  },
  roomOn: { borderColor: "#1A1510" },
  roomName: { fontSize: 16, fontWeight: "700", color: "#1A1510" },
  roomPrice: { fontSize: 14, color: "#5C5348", marginTop: 4 },
  quote: { marginVertical: 16, padding: 12, borderRadius: 12, backgroundColor: "#EDE7DC" },
  quoteLine: { fontSize: 18, fontWeight: "800", color: "#1A1510" },
  quoteSub: { fontSize: 13, color: "#5C5348", marginTop: 4 },
  policy: { fontSize: 14, lineHeight: 20, color: "#5C5348", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#D4CBBE",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "#FFFCF7",
  },
  cta: {
    backgroundColor: "#1A1510",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { color: "#FFFCF7", fontWeight: "700", fontSize: 15 },
  msg: { marginTop: 16, fontSize: 14, color: "#2C261E", fontWeight: "700" },
});
