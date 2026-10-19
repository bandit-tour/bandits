/**
 * Flow A — Book a hotel (in-app checkout for contracted inventory only).
 */
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { humanDate } from "@/components/BottleDateRangeField";
import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import {
  checkoutHotelBooking,
  fetchHotelBookingAvailability,
  type HotelBookingQuote,
} from "@/lib/guest-workspace/hotelBookingApi";
import { ensureAnonymousSession } from "@/lib/pilotSession";

function eur(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(
    cents / 100,
  );
}

export default function BottleBookHotelScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    slug?: string;
    hotelSlug?: string;
    checkIn?: string;
    checkOut?: string;
    travelers?: string;
    roomId?: string;
  }>();
  const slug =
    (typeof params.slug === "string" && params.slug) ||
    (typeof params.hotelSlug === "string" && params.hotelSlug) ||
    "";
  const checkIn = typeof params.checkIn === "string" ? params.checkIn : "";
  const checkOut = typeof params.checkOut === "string" ? params.checkOut : "";
  const travelers = Math.max(1, Number(params.travelers) || 2);
  const presetRoom = typeof params.roomId === "string" ? params.roomId : "";

  const [email, setEmail] = useState("");
  const [rooms, setRooms] = useState<Array<{ id: string; name: string; totalCents: number | null }>>([]);
  const [roomId, setRoomId] = useState(presetRoom);
  const [quote, setQuote] = useState<HotelBookingQuote | null>(null);
  const [bookable, setBookable] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const screenOptions = useAppBackScreenOptions({
    title: "Book hotel",
    fallback: `/bottleHotel/${slug}` as Href,
    showBack: true,
  });

  useEffect(() => {
    if (!slug || !checkIn || !checkOut) return;
    void fetchHotelBookingAvailability(slug, checkIn, checkOut, travelers).then((res) => {
      if (!res.ok) {
        setReason(res.detail);
        return;
      }
      setBookable(Boolean(res.data.bookable));
      setReason(res.data.reason || null);
      setQuote(res.data.quote || null);
      const list = (res.data.availability?.rooms || []).filter((r) => r.totalCents != null);
      setRooms(list);
      if (!roomId && list[0]) setRoomId(list[0].id);
    });
  }, [slug, checkIn, checkOut, travelers, roomId]);

  const guestEmail = email.trim().toLowerCase();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail) && guestEmail !== "guest@banditour.demo";

  const onBook = async () => {
    if (!bookable || !roomId || !quote || !emailOk) return;
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
      if (!res.ok) {
        setMsg(res.detail);
        return;
      }
      if (res.data.ok) {
        setMsg(`Confirmed · ${res.data.reservationRef || "ref pending"}`);
      } else {
        setMsg(res.data.error || "Could not complete booking");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="bottle-book-hotel">
      <Stack.Screen options={screenOptions} />
      <Text style={styles.kicker}>Book a hotel</Text>
      <Text style={styles.title}>{slug.replace(/-/g, " ")}</Text>
      <Text style={styles.meta}>
        {humanDate(checkIn)} → {humanDate(checkOut)} · {travelers} guests
      </Text>

      {!bookable ? (
        <Text style={styles.warn} testID="bottle-book-unavailable">
          {reason === "nonpartner_or_unpublished"
            ? "This property is browse-only — banDiTour cannot sell rooms without contracted inventory."
            : reason || "Not available to book in banDiTour for these dates."}
        </Text>
      ) : (
        <>
          {rooms.map((r) => (
            <Pressable
              key={r.id}
              style={[styles.room, roomId === r.id && styles.roomOn]}
              onPress={() => setRoomId(r.id)}
              testID={`bottle-book-room-${r.id}`}
            >
              <Text style={styles.roomName}>{r.name}</Text>
              {r.totalCents ? <Text style={styles.roomPrice}>{eur(r.totalCents)} total</Text> : null}
            </Pressable>
          ))}
          {quote ? (
            <View style={styles.quote} testID="bottle-book-quote">
              <Text style={styles.quoteLine}>Total {eur(quote.guestTotalCents)}</Text>
              <Text style={styles.quoteSub}>Service fee {eur(quote.guestServiceFeeCents)} · Pay in banDiTour</Text>
            </View>
          ) : null}
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Email for this booking"
            style={styles.input}
            testID="bottle-book-email"
          />
          <Pressable
            style={[styles.cta, (busy || !emailOk) && styles.ctaDisabled]}
            disabled={busy || !roomId || !quote || !emailOk}
            onPress={() => void onBook()}
            testID="bottle-book-pay"
          >
            <Text style={styles.ctaText}>{busy ? "Booking…" : "Book and pay"}</Text>
          </Pressable>
        </>
      )}
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F5F1" },
  content: { padding: 20, maxWidth: 560, alignSelf: "center", width: "100%" },
  kicker: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8, color: "#8A7A66", textTransform: "uppercase" },
  title: { fontSize: 26, fontWeight: "800", color: "#1A1510", marginVertical: 8 },
  meta: { fontSize: 14, color: "#5C5348", marginBottom: 16 },
  warn: { fontSize: 15, lineHeight: 22, color: "#6B5E4E" },
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
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: "#FFFCF7", fontWeight: "700", fontSize: 15 },
  msg: { marginTop: 16, fontSize: 14, color: "#2C261E" },
});
