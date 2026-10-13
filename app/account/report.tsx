import { Stack, type Href } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";

const TOPICS = ["App bug", "Payment", "Hotel stay", "Local Friend", "Bottle / journey", "Other"] as const;

/** Report a problem — support ticket. */
export default function ReportProblemScreen() {
  const [topic, setTopic] = useState<(typeof TOPICS)[number]>("App bug");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);
  const screenOptions = useAppBackScreenOptions({
    title: "Report a problem",
    fallback: "/menu" as Href,
    showBack: true,
  });

  const submit = () => {
    if (!body.trim()) return;
    setSent(true);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={screenOptions} />
      <Text style={styles.lead}>
        Tell us what went wrong. Tickets go to bandiTour support — hotel reception is under Contact
        Hotel.
      </Text>

      <Text style={styles.section}>Topic</Text>
      <View style={styles.chips}>
        {TOPICS.map((t) => (
          <Pressable
            key={t}
            style={[styles.chip, topic === t && styles.chipOn]}
            onPress={() => setTopic(t)}
          >
            <Text style={[styles.chipText, topic === t && styles.chipTextOn]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>Details</Text>
      <TextInput
        style={styles.input}
        multiline
        placeholder="What happened? Include the screen and what you expected."
        placeholderTextColor="#999"
        value={body}
        onChangeText={setBody}
        textAlignVertical="top"
      />

      <Pressable
        style={[styles.primary, !body.trim() && styles.primaryDisabled]}
        disabled={!body.trim() || sent}
        onPress={submit}
      >
        <Text style={styles.primaryText}>{sent ? "Ticket submitted" : "Submit ticket"}</Text>
      </Pressable>
      {sent ? (
        <Text style={styles.confirm}>
          Ticket #{topic.slice(0, 3).toUpperCase()}-402 received. We’ll follow up by email.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F6F4F0" },
  content: { padding: 16, paddingBottom: 48, maxWidth: 560, width: "100%", alignSelf: "center" },
  lead: { fontSize: 14, color: "#666", lineHeight: 20, marginBottom: 16 },
  section: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6B5A3A",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 10,
    marginTop: 8,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  chipOn: { backgroundColor: "#1C1814" },
  chipText: { fontSize: 13, fontWeight: "700", color: "#555" },
  chipTextOn: { color: "#F0D7A0" },
  input: {
    minHeight: 140,
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    color: "#1A1A1A",
    marginBottom: 16,
  },
  primary: {
    backgroundColor: "#1C1814",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryDisabled: { opacity: 0.45 },
  primaryText: { color: "#F0D7A0", fontWeight: "800", fontSize: 15 },
  confirm: { marginTop: 14, textAlign: "center", color: "#3D6B4F", fontWeight: "600", fontSize: 13 },
});
