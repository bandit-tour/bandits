import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAppState } from "@/contexts/AppStateContext";
import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import { confirmOctopusCheckoutSession } from "@/lib/octopus-concierge";
import { workspaceGet } from "@/lib/workspace/client";

type Batch = {
  entitlementId: string;
  orderId: string;
  startsAt: string;
  expiresAt: string | null;
  requestsIncluded: number;
  requestsRemaining: number;
};

type Pass = {
  entitlementId: string;
  banditId: string;
  orderId: string;
  startsAt: string;
  expiresAt: string | null;
  requestsIncluded: number;
  requestsRemaining: number;
  active: boolean;
  exhausted: boolean;
  expired: boolean;
  batches?: Batch[];
};

type Seller = {
  banditId: string;
  displayName: string;
  octopusVerified: boolean;
  checkoutEnabled: boolean;
  aiOperated?: boolean;
  disclosure?: string;
};

type RequestRow = {
  id: string;
  banditId: string;
  service: string;
  note: string;
  status: string;
  createdAt: string;
};

type InsiderHome = {
  passes?: Pass[];
  sellers?: Seller[];
  requests?: RequestRow[];
  oneRequestEnabled?: boolean;
  error?: string;
};

function routeParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "open";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * Central Your Local Insider dashboard.
 * Provider comes from server entitlements / Verified sellers — never a hardcoded Neo/PLAY/Ioanna default.
 */
export default function LocalInsiderHome() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    stripe_checkout?: string | string[];
    session_id?: string | string[];
  }>();
  const stripeFlag = routeParam(params.stripe_checkout);
  const sessionId = routeParam(params.session_id);
  const { getCurrentUser, activeIdentity } = useAppState();
  const screenOptions = useAppBackScreenOptions({
    title: "Your Local Insider",
    fallback: "/profile" as Href,
    showBack: true,
  });
  const [email, setEmail] = useState<string | null>(null);
  const [home, setHome] = useState<InsiderHome | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (guestEmail: string) => {
    const result = await workspaceGet<InsiderHome>(
      "/api/bandit/premium?view=local-insider",
      guestEmail,
    );
    if (!result.ok) {
      setHome(null);
      setNotice(result.detail);
      return;
    }
    setHome(result.data);
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const user = await getCurrentUser().catch(() => null);
      const guestEmail = String(
        (user as { email?: string } | null)?.email || activeIdentity?.userId || "",
      )
        .trim()
        .toLowerCase();
      if (!alive) return;
      if (!guestEmail.includes("@")) {
        setEmail(null);
        setLoading(false);
        setNotice("Sign in to see Your Local Insider.");
        return;
      }
      setEmail(guestEmail);
      if (stripeFlag === "cancel") {
        setNotice(
          "Payment was not completed. No Stay Pass was added. You can try again with a verified Local banDit.",
        );
      }
      if (stripeFlag === "success" && sessionId) {
        setNotice("Confirming your Stay Pass payment…");
        const confirmed = await confirmOctopusCheckoutSession({
          sessionId,
          banditId: "",
          guestEmail,
        });
        if (!alive) return;
        if (!confirmed.ok) {
          setNotice(
            /order_not_found/i.test(confirmed.detail)
              ? "Payment confirmation could not find the order. No second charge was made. Open the provider and tap Already paid."
              : confirmed.detail,
          );
        } else {
          setNotice("Payment confirmed. Your Stay Pass is ready.");
        }
      }
      await load(guestEmail);
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [activeIdentity?.userId, getCurrentUser, load, sessionId, stripeFlag]);

  const passes = home?.passes || [];
  const sellers = (home?.sellers || []).filter(
    (s) => s.checkoutEnabled && (s.octopusVerified || s.aiOperated === true),
  );
  const requests = home?.requests || [];
  const active = passes.filter((p) => p.active && p.requestsRemaining > 0);
  const depleted = passes.filter((p) => !p.expired && p.requestsRemaining <= 0);
  const expired = passes.filter((p) => p.expired);
  const openPass = active[0] || null;

  const sellerName = (banditId: string) =>
    sellers.find((s) => s.banditId === banditId)?.displayName || "Your Local banDit";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="local-insider-home">
      <Stack.Screen options={screenOptions} />
      <Text style={styles.kicker}>YOUR LOCAL INSIDER</Text>
      <Text style={styles.title}>Octopus Concierge</Text>
      <Text style={styles.lead}>
        Stay Pass is €19 for 5 requests over 7 days. Each purchase is its own pack.
      </Text>

      {loading ? <ActivityIndicator color="#1C1814" style={{ marginTop: 24 }} /> : null}
      {notice ? (
        <Text style={styles.notice} testID="local-insider-notice">
          {notice}
        </Text>
      ) : null}

      {openPass ? (
        <View style={styles.card} testID="local-insider-active-pass">
          <Text style={styles.cardKicker}>Active Stay Pass</Text>
          <Text style={[styles.cardTitle, styles.onDark]}>{sellerName(openPass.banditId)}</Text>
          <Text style={styles.onDarkMeta} testID="local-insider-remaining">
            {`${openPass.requestsRemaining} request${openPass.requestsRemaining === 1 ? "" : "s"} left`}
          </Text>
          <Text style={styles.onDarkMeta}>{`Earliest pack expires ${formatWhen(openPass.expiresAt)}.`}</Text>
          {(openPass.batches || []).map((batch) => (
            <Text key={batch.entitlementId} style={styles.batch}>
              {`${batch.requestsRemaining} of ${batch.requestsIncluded} until ${formatWhen(batch.expiresAt)}`}
            </Text>
          ))}
          <Pressable
            style={styles.primary}
            onPress={() => router.push(`/premium/${encodeURIComponent(openPass.banditId)}` as Href)}
            testID="local-insider-open-pass"
          >
            <Text style={styles.primaryText}>Open this Stay Pass</Text>
          </Pressable>
        </View>
      ) : null}

      {depleted.map((pass) => (
        <View key={pass.entitlementId} style={styles.card} testID="local-insider-depleted">
          <Text style={[styles.cardTitle, styles.onDark]}>{sellerName(pass.banditId)}</Text>
          <Text style={styles.onDarkMeta}>No requests left on the open packs.</Text>
          <Pressable
            style={styles.primary}
            onPress={() => router.push(`/premium/${encodeURIComponent(pass.banditId)}` as Href)}
          >
            <Text style={styles.primaryText}>Add 5 requests · €19</Text>
          </Pressable>
        </View>
      ))}

      {expired.map((pass) => (
        <View key={pass.entitlementId} style={styles.lightCard}>
          <Text style={styles.cardTitle}>{`${sellerName(pass.banditId)} · Stay Pass ended`}</Text>
          <Pressable
            style={styles.secondary}
            onPress={() => router.push(`/premium/${encodeURIComponent(pass.banditId)}` as Href)}
          >
            <Text style={styles.secondaryText}>Renew with this Local banDit</Text>
          </Pressable>
        </View>
      ))}

      {!loading && !openPass ? (
        <View testID="local-insider-sellers">
          <Text style={styles.section}>
            {expired.length || depleted.length
              ? "Or choose another verified Local banDit"
              : "Verified Local banDits"}
          </Text>
          {sellers.length === 0 ? (
            <Text style={styles.meta}>
              No Local banDit is available for Stay Pass right now.
            </Text>
          ) : (
            sellers.map((seller) => (
              <Pressable
                key={seller.banditId}
                style={styles.seller}
                onPress={() => router.push(`/premium/${encodeURIComponent(seller.banditId)}` as Href)}
                testID={`local-insider-seller-${seller.banditId}`}
              >
                <Text style={styles.cardTitle}>{seller.displayName}</Text>
                <Text style={styles.meta}>Stay Pass · €19 · 5 requests · 7 days</Text>
                {seller.aiOperated ? (
                  <Text style={styles.meta}>Digital local guide · not a person on call</Text>
                ) : null}
              </Pressable>
            ))
          )}
        </View>
      ) : null}

      <Text style={styles.section}>Requests</Text>
      {requests.length === 0 ? (
        <Text style={styles.meta}>No concierge requests yet.</Text>
      ) : (
        requests.map((row) => (
          <View key={row.id} style={styles.request} testID={`local-insider-request-${row.id}`}>
            <Text style={styles.cardTitle}>{row.service || "Request"}</Text>
            <Text style={styles.meta}>{row.status}</Text>
            <Text style={styles.note} numberOfLines={2}>
              {row.note}
            </Text>
          </View>
        ))
      )}

      {email ? (
        <Pressable style={styles.secondary} onPress={() => void load(email)} testID="local-insider-refresh">
          <Text style={styles.secondaryText}>Refresh</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F6F4F0" },
  content: { padding: 20, paddingBottom: 48, maxWidth: 640, width: "100%", alignSelf: "center" },
  kicker: { fontSize: 11, fontWeight: "800", letterSpacing: 1.1, color: "#8A7F72" },
  title: { fontSize: 28, fontWeight: "800", color: "#1C1814", marginTop: 6 },
  lead: { fontSize: 15, color: "#5C5348", marginTop: 8, lineHeight: 21 },
  notice: { marginTop: 16, color: "#6B5A3A", fontSize: 14, lineHeight: 20 },
  section: {
    marginTop: 22,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "#6B5A3A",
    textTransform: "uppercase",
  },
  card: { marginTop: 16, backgroundColor: "#1C1814", borderRadius: 18, padding: 16 },
  lightCard: { marginTop: 16, backgroundColor: "#FFF", borderRadius: 18, padding: 16 },
  cardKicker: { color: "#F0D7A0", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  cardTitle: { color: "#1C1814", fontSize: 18, fontWeight: "800", marginTop: 4 },
  onDark: { color: "#FFFFFF" },
  onDarkMeta: { color: "rgba(255,255,255,0.72)", fontSize: 14, marginTop: 6, lineHeight: 20 },
  meta: { color: "#5C5348", fontSize: 14, marginTop: 6, lineHeight: 20 },
  batch: { color: "#F0D7A0", fontSize: 13, marginTop: 4 },
  note: { color: "#5C5348", fontSize: 13, marginTop: 4 },
  primary: {
    marginTop: 14,
    backgroundColor: "#F0D7A0",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryText: { color: "#1C1814", fontWeight: "800" },
  secondary: { marginTop: 12, alignItems: "center", paddingVertical: 10 },
  secondaryText: { color: "#1C1814", fontWeight: "700" },
  seller: { backgroundColor: "#FFF", borderRadius: 14, padding: 14, marginBottom: 8 },
  request: { backgroundColor: "#FFF", borderRadius: 14, padding: 14, marginBottom: 8 },
});
