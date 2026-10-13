/**
 * BETWEEN TRIPS / CITY MEMORY HOME
 * Must NOT show Room / Breakfast / Late checkout / Hotel services / Ask reception.
 */

import { useRouter, type Href } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { HotelCheckoutInvite } from "@/components/guest-lifecycle/HotelCheckoutInvite";
import type { AfterTripHomeModel } from "@/lib/guest-lifecycle/city-memory";
import type { GuestLifecycleState } from "@/lib/guest-lifecycle/types";

type Props = {
  model: AfterTripHomeModel;
  state: GuestLifecycleState;
  onPlanNextTrip: () => void;
  onReactivate: () => void;
  compact?: boolean;
};

export function AfterTripHome({ model, state, onPlanNextTrip, onReactivate, compact }: Props) {
  const router = useRouter();
  const go = (href: string) => router.push(href as Href);

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Text style={styles.kicker}>
        {state === "NEXT_TRIP_PLANNING" ? "Next trip planning" : "Between trips"}
      </Text>
      <Text style={styles.title}>{model.memoryTitle}</Text>
      <Text style={styles.lead}>
        Your account stays alive. Hotel services pause until you Connect My New Stay with a verified
        booking.
      </Text>

      <HotelCheckoutInvite hotelName={model.memoryTitle} />

      <View style={styles.ctaRow}>
        <Pressable style={styles.ctaPrimary} onPress={onPlanNextTrip} accessibilityRole="button">
          <Text style={styles.ctaPrimaryText}>Plan Your Next Trip</Text>
        </Pressable>
        <Pressable style={styles.ctaSecondary} onPress={onReactivate} accessibilityRole="button">
          <Text style={styles.ctaSecondaryText}>Connect My New Stay</Text>
        </Pressable>
      </View>

      <Section title="Saved Places" empty="Places you save will live here for months.">
        {model.savedPlaces.slice(0, 6).map((m) => (
          <Row key={m.id} title={m.title} detail={m.subtitle || m.city} onPress={() => go("/mySpots")} />
        ))}
        {model.savedPlaces.length > 0 ? (
          <LinkRow label="Open My Spots" onPress={() => go("/mySpots")} />
        ) : null}
      </Section>

      <Section title="My Spots" empty="Spots from this trip stay in your memory.">
        {model.mySpots.slice(0, 6).map((m) => (
          <Row key={m.id} title={m.title} detail={m.neighborhood || m.category || m.city} onPress={() => go("/mySpots")} />
        ))}
      </Section>

      <Section title="Followed banDits" empty="Follows continue after checkout — FOLLOW ≠ SAVE.">
        {model.followedBandits.slice(0, 6).map((m) => (
          <Row key={m.id} title={m.title} detail="Still following" onPress={() => go("/following")} />
        ))}
        <LinkRow label="Open Following" onPress={() => go("/following")} />
      </Section>

      <Section title="Places You Loved" empty="Taste graph builds from what you loved.">
        {model.placesLoved.slice(0, 6).map((m) => (
          <Row key={m.id} title={m.title} detail={m.category || m.city} onPress={() => go("/explore")} />
        ))}
      </Section>

      <Section title="Smart Discovery" empty="Cross-city picks from your taste — not a noisy feed.">
        {model.discoveryPicks.map((d) => (
          <Row key={d.id} title={d.title} detail={d.detail} onPress={() => go(d.href)} />
        ))}
      </Section>

      <Section title="Similar Neighborhoods / Cities">
        {model.similarCities.map((c) => (
          <Row key={c.id} title={c.title} detail={c.detail} onPress={() => go("/explore")} />
        ))}
      </Section>

      <Section title="Travel in a Bottle">
        <Row
          title="Build the next journey"
          detail="Works while planning — not late checkout"
          onPress={() => go("/travelBottle")}
        />
      </Section>

      <Section title="Next destination ideas">
        {model.nextTripIdeas.map((n) => (
          <Row
            key={n.id}
            title={n.title}
            detail={n.detail}
            onPress={() => (n.id === "bottle" ? go("/travelBottle") : onPlanNextTrip())}
          />
        ))}
      </Section>
    </View>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty?: string;
  children?: React.ReactNode;
}) {
  const kids = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {kids.length === 0 && empty ? <Text style={styles.empty}>{empty}</Text> : kids}
    </View>
  );
}

function Row({
  title,
  detail,
  onPress,
}: {
  title: string;
  detail?: string | null;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole={onPress ? "button" : undefined}>
      <Text style={styles.rowTitle}>{title}</Text>
      {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
    </Pressable>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.linkRow} accessibilityRole="button">
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 18,
    paddingBottom: 24,
    paddingTop: 8,
    backgroundColor: "#F7F4EE",
    borderRadius: 16,
    paddingHorizontal: 4,
  },
  wrapCompact: { paddingTop: 8 },
  kicker: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#5A4A2E",
    fontWeight: "700",
  },
  title: { fontSize: 28, fontWeight: "800", color: "#121212", letterSpacing: -0.5 },
  lead: { fontSize: 15, lineHeight: 22, color: "#333333", maxWidth: 520 },
  ctaRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  ctaPrimary: {
    backgroundColor: "#0A7EA4",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  ctaPrimaryText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
  ctaSecondary: {
    borderWidth: 1.5,
    borderColor: "#0A7EA4",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  ctaSecondaryText: { color: "#0A7EA4", fontWeight: "700", fontSize: 14 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: "#121212" },
  empty: { fontSize: 13, color: "#555555", lineHeight: 18 },
  row: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#D9D2C5",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  rowTitle: { fontSize: 15, fontWeight: "600", color: "#121212" },
  rowDetail: { fontSize: 13, color: "#444444", marginTop: 2 },
  linkRow: { paddingVertical: 8 },
  linkText: { fontSize: 14, fontWeight: "700", color: "#0A7EA4" },
});
