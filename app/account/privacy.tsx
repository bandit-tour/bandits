import { Stack, type Href } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";

/** Privacy — dedicated, not Settings dump. */
export default function PrivacyScreen() {
  const [shareStay, setShareStay] = useState(true);
  const [localFriendVisible, setLocalFriendVisible] = useState(true);
  const [analytics, setAnalytics] = useState(true);
  const screenOptions = useAppBackScreenOptions({
    title: "Privacy",
    fallback: "/menu" as Href,
    showBack: true,
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={screenOptions} />
      <Text style={styles.lead}>Control what hotels, Local Friends, and banDiTour can see.</Text>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Share stay status with hotel</Text>
          <Text style={styles.sub}>Room, checkout, and requests</Text>
        </View>
        <Switch value={shareStay} onValueChange={setShareStay} />
      </View>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Visible to Local Friend</Text>
          <Text style={styles.sub}>Name & current city for matching</Text>
        </View>
        <Switch value={localFriendVisible} onValueChange={setLocalFriendVisible} />
      </View>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Product analytics</Text>
          <Text style={styles.sub}>Helps improve journeys — no sale of data</Text>
        </View>
        <Switch value={analytics} onValueChange={setAnalytics} />
      </View>

      <Pressable style={styles.link}>
        <Text style={styles.linkText}>Download my data</Text>
      </Pressable>
      <Pressable style={styles.link}>
        <Text style={styles.linkText}>Request account deletion</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F6F4F0" },
  content: { padding: 16, paddingBottom: 48, maxWidth: 560, width: "100%", alignSelf: "center" },
  lead: { fontSize: 14, color: "#666", lineHeight: 20, marginBottom: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  label: { fontSize: 14, fontWeight: "700", color: "#1A1A1A" },
  sub: { fontSize: 12, color: "#777", marginTop: 3 },
  link: { paddingVertical: 14 },
  linkText: { color: "#0a7ea4", fontWeight: "700", fontSize: 14 },
});
