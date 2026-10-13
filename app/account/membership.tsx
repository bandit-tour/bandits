import { Stack, useRouter, type Href } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAppState } from "@/contexts/AppStateContext";
import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import {
  OCTOPUS_CONCIERGE_OFFER,
  resolveOctopusConciergeEntitlement,
  startOctopusConciergeCheckout,
  type OctopusEntitlement,
} from "@/lib/octopus-concierge";
import { LOCAL_FRIENDS } from "@/lib/guest-workspace/profileMemory";

const INCLUDED = [
  "Octopus Concierge — restaurants, tickets, taxis, transfers",
  "Priority Local Friend matching",
  "Hotel late-checkout & offer priority",
  "Premium SmartTraveler perks",
  "Travel in a Bottle premium journeys",
];

/**
 * Premium Membership — NOT Impact.
 * Unsubscribed → sales → payment → unlock.
 * Subscribed → membership management.
 */
export default function MembershipScreen() {
  const router = useRouter();
  const { activeIdentity, getCurrentUser } = useAppState();
  const screenOptions = useAppBackScreenOptions({
    title: "Premium Membership",
    fallback: "/menu" as Href,
    showBack: true,
  });
  const banditId = LOCAL_FRIENDS[0]?.id ?? "local-friend";
  const [entitlement, setEntitlement] = useState<OctopusEntitlement | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const user = await getCurrentUser().catch(() => null);
      const guestId = activeIdentity?.userId ?? user?.id ?? null;
      const ent = await resolveOctopusConciergeEntitlement({ guestId, banditId });
      if (alive) setEntitlement(ent);
    })();
    return () => {
      alive = false;
    };
  }, [activeIdentity?.userId, banditId, getCurrentUser]);

  const active = entitlement?.entitled === true && entitlement.state === "active";

  const onUpgrade = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const user = await getCurrentUser().catch(() => null);
      const guestId = activeIdentity?.userId ?? user?.id ?? null;
      const result = await startOctopusConciergeCheckout({
        guestId,
        banditId,
        successPath: "/account/membership",
        cancelPath: "/account/membership",
      });
      if (result.ok) {
        if (result.paymentConfirmed) {
          setMsg("Payment confirmed — Concierge unlocked.");
        } else {
          setMsg("Checkout ready — complete payment to unlock.");
        }
        router.push(`/premium/${encodeURIComponent(banditId)}` as Href);
      } else {
        setMsg(result.detail ?? "Checkout unavailable. Open Octopus Concierge to continue.");
        router.push(`/premium/${encodeURIComponent(banditId)}` as Href);
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not start checkout");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={screenOptions} />

      <View style={[styles.hero, active ? styles.heroActive : styles.heroSales]}>
        <Text style={styles.kicker}>{active ? "Your membership" : "Unlock Premium"}</Text>
        <Text style={styles.title}>
          {active ? "Premium Guest · active" : OCTOPUS_CONCIERGE_OFFER.title}
        </Text>
        <Text style={styles.lead}>
          {active
            ? "Manage Octopus Concierge access, billing, and renewals."
            : OCTOPUS_CONCIERGE_OFFER.valueLine}
        </Text>
        <Text style={styles.price}>
          {OCTOPUS_CONCIERGE_OFFER.priceLabel}{" "}
          <Text style={styles.pricePeriod}>{OCTOPUS_CONCIERGE_OFFER.periodLabel}</Text>
        </Text>
      </View>

      <Text style={styles.section}>Included services</Text>
      {INCLUDED.map((line) => (
        <View key={line} style={styles.row}>
          <Text style={styles.bullet}>✓</Text>
          <Text style={styles.rowText}>{line}</Text>
        </View>
      ))}

      {active ? (
        <>
          <Text style={styles.section}>Billing</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Renews with your stay cycle</Text>
            <Text style={styles.cardSub}>
              Status: {entitlement?.state}
              {entitlement?.expiresAt ? ` · until ${entitlement.expiresAt}` : ""}
            </Text>
            <Text style={styles.cardSub}>{entitlement?.detail}</Text>
          </View>
          <Pressable
            style={styles.primary}
            onPress={() => router.push(`/premium/${encodeURIComponent(banditId)}` as Href)}
          >
            <Text style={styles.primaryText}>Open Octopus Concierge</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => router.push("/account/payments" as Href)}>
            <Text style={styles.secondaryText}>Payment methods & invoices</Text>
          </Pressable>
          <Pressable
            style={styles.ghost}
            onPress={() => setMsg("Cancel anytime via Payments · support will confirm.")}
          >
            <Text style={styles.ghostText}>Cancel renewal</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Pressable style={styles.primary} disabled={busy} onPress={() => void onUpgrade()}>
            <Text style={styles.primaryText}>
              {busy ? "Opening checkout…" : `Upgrade · ${OCTOPUS_CONCIERGE_OFFER.priceLabel}`}
            </Text>
          </Pressable>
          <Pressable
            style={styles.secondary}
            onPress={() => router.push(`/premium/${encodeURIComponent(banditId)}` as Href)}
          >
            <Text style={styles.secondaryText}>See Octopus Concierge details</Text>
          </Pressable>
        </>
      )}

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F6F4F0" },
  content: { padding: 16, paddingBottom: 48, maxWidth: 640, width: "100%", alignSelf: "center" },
  hero: { borderRadius: 20, padding: 20, marginBottom: 20 },
  heroSales: { backgroundColor: "#1C1814" },
  heroActive: { backgroundColor: "#243028" },
  kicker: {
    fontSize: 11,
    fontWeight: "800",
    color: "rgba(240,215,160,0.9)",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: { fontSize: 24, fontWeight: "800", color: "#FFF", marginTop: 8 },
  lead: { fontSize: 14, color: "rgba(255,255,255,0.72)", marginTop: 10, lineHeight: 20 },
  price: { fontSize: 28, fontWeight: "800", color: "#F0D7A0", marginTop: 16 },
  pricePeriod: { fontSize: 14, fontWeight: "600", color: "rgba(240,215,160,0.75)" },
  section: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6B5A3A",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 10,
    marginTop: 8,
  },
  row: { flexDirection: "row", gap: 10, marginBottom: 10, paddingHorizontal: 4 },
  bullet: { color: "#3D6B4F", fontWeight: "800", fontSize: 15 },
  rowText: { flex: 1, fontSize: 14, color: "#1A1A1A", lineHeight: 20 },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: { fontSize: 15, fontWeight: "800", color: "#1A1A1A" },
  cardSub: { fontSize: 13, color: "#666", marginTop: 6, lineHeight: 18 },
  primary: {
    backgroundColor: "#1C1814",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  primaryText: { color: "#F0D7A0", fontWeight: "800", fontSize: 15 },
  secondary: { paddingVertical: 14, alignItems: "center" },
  secondaryText: { color: "#E03131", fontWeight: "700", fontSize: 14 },
  ghost: { paddingVertical: 10, alignItems: "center" },
  ghostText: { color: "#888", fontWeight: "600", fontSize: 13 },
  msg: { marginTop: 12, textAlign: "center", color: "#6B5A3A", fontSize: 13 },
});
