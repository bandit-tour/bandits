import { Stack, type Href } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import {
  GUEST_LANGUAGES,
  getGuestLanguageSync,
  loadGuestLanguage,
  setGuestLanguage,
  type GuestLanguageCode,
} from "@/lib/guestLanguage";

/** Dedicated language selector — not a Settings dump. */
export default function LanguageScreen() {
  const [code, setCode] = useState<GuestLanguageCode>(getGuestLanguageSync());
  const [saved, setSaved] = useState(false);
  const screenOptions = useAppBackScreenOptions({
    title: "Language",
    fallback: "/menu" as Href,
    showBack: true,
  });

  useEffect(() => {
    void loadGuestLanguage().then(setCode);
  }, []);

  const onSelect = async (next: GuestLanguageCode) => {
    setCode(next);
    await setGuestLanguage(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={screenOptions} />
      <Text style={styles.lead}>
        Choose how bandiTour speaks to you. Preference is saved on this device.
      </Text>
      {GUEST_LANGUAGES.map((lang) => {
        const on = code === lang.code;
        return (
          <Pressable
            key={lang.code}
            style={[styles.row, on && styles.rowOn]}
            onPress={() => void onSelect(lang.code)}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, on && styles.labelOn]}>{lang.label}</Text>
              <Text style={[styles.native, on && styles.nativeOn]}>{lang.nativeLabel}</Text>
            </View>
            {on ? <Text style={styles.check}>✓</Text> : null}
          </Pressable>
        );
      })}
      <Text style={styles.future}>More languages coming soon.</Text>
      {saved ? <Text style={styles.saved}>Language saved</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F6F4F0" },
  content: { padding: 16, paddingBottom: 48, maxWidth: 560, width: "100%", alignSelf: "center" },
  lead: { fontSize: 14, color: "#666", lineHeight: 20, marginBottom: 18 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  rowOn: { borderColor: "#1C1814", backgroundColor: "#1C1814" },
  label: { fontSize: 17, fontWeight: "800", color: "#1A1A1A" },
  labelOn: { color: "#FFF" },
  native: { fontSize: 14, color: "#777", marginTop: 3 },
  nativeOn: { color: "rgba(240,215,160,0.9)" },
  check: { fontSize: 20, fontWeight: "800", color: "#F0D7A0" },
  future: { marginTop: 12, fontSize: 12, color: "#999", textAlign: "center" },
  saved: {
    marginTop: 14,
    textAlign: "center",
    fontWeight: "700",
    color: "#3D6B4F",
    fontSize: 13,
  },
});
