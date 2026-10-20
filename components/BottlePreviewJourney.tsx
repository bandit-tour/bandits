/**
 * Labeled preview of the Mix booking screens.
 * Never calls checkout, never writes booking history, never shows a price.
 */
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { humanDate } from "@/components/BottleDateRangeField";

export function BottlePreviewJourney({
  hotelName,
  outdoorLabel,
  checkIn,
  checkOut,
  hotelNights,
  outdoorNights,
  travelers,
}: {
  hotelName: string;
  outdoorLabel: string;
  checkIn: string;
  checkOut: string;
  hotelNights: number;
  outdoorNights: number;
  travelers: number;
}) {
  const [guestName, setGuestName] = useState("");
  const [email, setEmail] = useState("");
  const [shown, setShown] = useState(false);
  const nameOk = guestName.trim().length >= 2;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase());
  const ready = Boolean(nameOk && emailOk && checkIn && checkOut);
  const when =
    checkIn && checkOut
      ? `${humanDate(checkIn)} → ${humanDate(checkOut)} · ${hotelNights} hotel + ${outdoorNights} outdoor · ${travelers} guests`
      : "Add dates before previewing this journey.";

  return (
    <View testID="bottle-preview-journey">
      <Text style={styles.kicker}>Book Stay</Text>
      <Text style={styles.body}>Preview only. Payment is off. No reservation is created.</Text>
      <Text style={styles.body}>{when}</Text>
      <TextInput
        value={guestName}
        onChangeText={setGuestName}
        placeholder="Guest name"
        style={styles.input}
        testID="bottle-preview-guest-name"
      />
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email for this preview"
        style={styles.input}
        testID="bottle-preview-email"
      />
      <Pressable
        style={[styles.button, !ready && styles.buttonOff]}
        disabled={!ready}
        onPress={() => setShown(true)}
        testID="bottle-preview-continue"
        accessibilityRole="button"
        accessibilityState={{ disabled: !ready }}
      >
        <Text style={styles.buttonText}>Preview this stay</Text>
      </Pressable>
      {shown ? (
        <View style={styles.confirm} testID="bottle-preview-confirmation">
          <Text style={styles.line}>Preview only</Text>
          <Text style={styles.body}>This is not a real booking.</Text>
          <Text style={styles.body}>
            No card was charged. No supplier reservation was created. Nothing was saved.
          </Text>
          <Text style={styles.line}>{hotelName}</Text>
          <Text style={styles.body}>Outdoor stay: {outdoorLabel}</Text>
          <Text style={styles.body}>{when}</Text>
          <Text style={styles.body}>Guest {guestName.trim()}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#8A7A66",
    marginBottom: 8,
  },
  line: { fontSize: 16, fontWeight: "700", color: "#1A1510", marginBottom: 4 },
  body: { fontSize: 14, lineHeight: 20, color: "#5C5348", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#D4CBBE",
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    backgroundColor: "#FFFCF7",
  },
  button: {
    marginTop: 12,
    backgroundColor: "#1A1510",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonOff: { opacity: 0.45 },
  buttonText: { color: "#FFFCF7", fontWeight: "700", fontSize: 15 },
  confirm: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#EDE7DC",
    borderWidth: 1,
    borderColor: "#1A1510",
  },
});
