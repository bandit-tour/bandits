import { Stack, useLocalSearchParams, type Href } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { Image as ExpoImage } from "expo-image";

import { getBanditById } from "@/app/services/bandits";
import LocalBanditOctopusIcon from "@/components/LocalBanditOctopusIcon";
import { useAppState } from "@/contexts/AppStateContext";
import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import { color, radius } from "@/lib/guestDesign";
import {
  OCTOPUS_CONCIERGE_OFFER,
  OCTOPUS_CONCIERGE_PRODUCT_LAW,
  assertConciergeOpsAllowed,
  createConciergeTaskStub,
  fetchConciergeTrack,
  guestFacingConciergeStatus,
  isSubstantiveConciergeNote,
  mergeTrackIntoTasks,
  resolveConciergeOperatorType,
  confirmOctopusCheckoutSession,
  resolveOctopusConciergeEntitlement,
  startOctopusConciergeCheckout,
  submitConciergeRequestToWorkspace,
  type ConciergeOperatorResolution,
  type ConciergeTask,
  type OctopusEntitlement,
} from "@/lib/octopus-concierge";
import { routeParamString } from "@/lib/routeParams";
import { CHECKOUT_UI_WALL_MS } from "@/lib/workspace/client";
import {
  fetchBanditPremiumVisibility,
  type BanditPremiumVisibility,
} from "@/lib/guest-app/premium-visibility";

const RECOVERABLE_CHECKOUT_TIMEOUT =
  "Checkout timed out. No charge completed — try Unlock again.";

/** Compact premium service grid — icon + title + one-line explanation. */
const BENEFIT_CARDS = [
  {
    id: "restaurant",
    emoji: "🍽",
    title: "Restaurant reservations",
    line: "Tables booked for you — not just recommendations.",
  },
  {
    id: "concerts",
    emoji: "🎫",
    title: "Concerts / shows / nightlife",
    line: "Tickets and entry handled end-to-end.",
  },
  {
    id: "taxi",
    emoji: "🚕",
    title: "Taxi & airport transfer",
    line: "Rides and transfers arranged on time.",
  },
  {
    id: "wolt",
    emoji: "🛵",
    title: "Wolt / food delivery",
    line: "Food ordered and tracked for you.",
  },
  {
    id: "delivery",
    emoji: "📦",
    title: "Local deliveries",
    line: "Packages and errands coordinated locally.",
  },
  {
    id: "tickets",
    emoji: "🎟",
    title: "Tickets",
    line: "Events secured without the queue.",
  },
  {
    id: "tables",
    emoji: "✦",
    title: "Hard-to-get tables",
    line: "The places that usually say no.",
  },
  {
    id: "special",
    emoji: "✨",
    title: "Special requests",
    line: "Anything else — asked once, handled.",
  },
] as const;

const BOOK_ACTIONS = [
  { id: "restaurant", emoji: "🍽", title: "Reserve a Restaurant", service: "Restaurant reservations" },
  { id: "concert", emoji: "🎫", title: "Get Concert / Show Tickets", service: "Concerts / shows" },
  { id: "taxi", emoji: "🚕", title: "Book a Taxi", service: "Taxi" },
  { id: "airport", emoji: "✈️", title: "Arrange Airport Transfer", service: "Airport transfer" },
  { id: "wolt", emoji: "🛵", title: "Order Wolt / Delivery", service: "Wolt / food delivery" },
  { id: "nightlife", emoji: "🍸", title: "Reserve Nightlife", service: "Nightlife" },
  { id: "tickets", emoji: "🎟", title: "Find Tickets", service: "Tickets" },
  { id: "tables", emoji: "✦", title: "Hard-to-get Table", service: "Hard-to-get tables" },
  { id: "delivery", emoji: "📦", title: "Local Delivery", service: "Local deliveries" },
  { id: "special", emoji: "✨", title: "Special Request", service: "Special requests" },
] as const;

/**
 * Octopus Concierge entry.
 * BEFORE entitlement ACTIVE â†’ white/red/coral sales + €29 Commerce checkout only.
 * AFTER payment confirms ACTIVE â†’ Concierge OS (Ask + quick actions + requests).
 */
export default function PremiumConciergeScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    paid?: string | string[];
    order?: string | string[];
    stripe_checkout?: string | string[];
    session_id?: string | string[];
  }>();
  const id = routeParamString(params.id);
  const stripeCheckoutFlag = routeParamString(params.stripe_checkout);
  const stripeSessionFromUrl = routeParamString(params.session_id);
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, 560);
  const isDesktop = width >= 720;
  const gap = 10;
  const cardWidth = isDesktop ? (contentWidth - 40 - gap) / 2 : contentWidth - 40;

  const { getCurrentUser, activeIdentity } = useAppState();
  const [guestId, setGuestId] = useState<string | null>(activeIdentity?.userId ?? null);
  const [guestEmail, setGuestEmail] = useState<string | null>(null);
  const [identityReady, setIdentityReady] = useState(false);

  const [banditName, setBanditName] = useState<string>("Local banDit");
  const [banditPortrait, setBanditPortrait] = useState<string | null>(null);
  const [loadingBandit, setLoadingBandit] = useState(Boolean(id));
  const [banditAuthorized, setBanditAuthorized] = useState<boolean | null>(null);
  const [visibility, setVisibility] = useState<BanditPremiumVisibility | null>(null);
  const [operatorResolution, setOperatorResolution] = useState<ConciergeOperatorResolution | null>(
    null,
  );
  const [entitlement, setEntitlement] = useState<OctopusEntitlement | null>(null);
  const [entitlementLoading, setEntitlementLoading] = useState(true);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutMsg, setCheckoutMsg] = useState<string | null>(null);
  const [claimingPaid, setClaimingPaid] = useState(false);
  const [trackHydration, setTrackHydration] = useState<"idle" | "ok" | "missing">("idle");

  const [askText, setAskText] = useState("");
  const [tasks, setTasks] = useState<ConciergeTask[]>([]);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [sentMsg, setSentMsg] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const first = useMemo(
    () => banditName.trim().split(/\s+/)[0] || "your banDit",
    [banditName],
  );

  const entitled = entitlement ? assertConciergeOpsAllowed(entitlement) : false;

  const salesHeader = useAppBackScreenOptions({
    title: "Your Local Insider",
    fallback: "/bandits" as Href,
    escapeShortcuts: true,
    headerTintColor: color.ink,
    headerStyle: { backgroundColor: color.surface },
  });

  const opsHeader = useAppBackScreenOptions({
    title: "Your Local Insider",
    fallback: "/bandits" as Href,
    escapeShortcuts: true,
    headerTintColor: color.ink,
    headerStyle: { backgroundColor: color.surface },
  });

  useEffect(() => {
    let cancelled = false;
    if (!id) {
      setBanditAuthorized(false);
      setOperatorResolution(null);
      return;
    }
    void fetchBanditPremiumVisibility(id, guestEmail).then((v) => {
      if (cancelled) return;
      setVisibility(v);
      // Sales surface follows visibility; checkout alone requires commerceOperational.
      setBanditAuthorized(v.showPremiumInsights === true);
      // Operator type from Workspace fields only — never from name/portrait.
      setOperatorResolution(
        resolveConciergeOperatorType({
          visibility: v,
          banditFirstName: banditName.trim().split(/\s+/)[0] || "your banDit",
        }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [id, guestEmail, banditName]);

  useEffect(() => {
    let cancelled = false;
    setIdentityReady(false);
    (async () => {
      const fromIdentity = activeIdentity?.userId ? String(activeIdentity.userId).trim() : "";
      if (fromIdentity) {
        if (!cancelled) setGuestId(fromIdentity);
      }
      const u = await getCurrentUser();
      if (cancelled) return;
      if (!fromIdentity) setGuestId(u?.id ? String(u.id).trim() : null);
      const email = (u as { email?: string } | null)?.email;
      setGuestEmail(email ? String(email).trim() : null);
      setIdentityReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeIdentity?.userId, getCurrentUser]);

  const refreshEntitlement = useCallback(async () => {
    if (!id || !identityReady) {
      if (!id) {
        setEntitlement(null);
        setEntitlementLoading(false);
      }
      return;
    }
    setEntitlementLoading(true);
    try {
      const next = await resolveOctopusConciergeEntitlement({
        guestId,
        banditId: id,
        guestEmail,
        stayId: "current_stay",
      });
      setEntitlement(next);
    } finally {
      setEntitlementLoading(false);
    }
  }, [guestEmail, guestId, id, identityReady]);

  useEffect(() => {
    if (!id) {
      setLoadingBandit(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const bandit = await getBanditById(id);
        if (cancelled) return;
        const name = String(bandit?.name ?? "").trim();
        if (name) setBanditName(name);
        let portrait: string | null = null;
        for (const u of [bandit?.image_url, bandit?.face_image_url]) {
          const t = String(u || "").trim();
          if (t.startsWith("http://") || t.startsWith("https://")) {
            portrait = t;
            break;
          }
        }
        setBanditPortrait(portrait);
      } catch {
        /* keep default */
      } finally {
        if (!cancelled) setLoadingBandit(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    void refreshEntitlement();
  }, [refreshEntitlement]);

  /** Return from checkout.stripe.com success URL — confirm session, then open Concierge OS. */
  useEffect(() => {
    if (
      !id ||
      stripeCheckoutFlag !== "success" ||
      !stripeSessionFromUrl ||
      claimingPaid ||
      !guestEmail
    ) {
      return;
    }
    let cancelled = false;
    (async () => {
      setClaimingPaid(true);
      setCheckoutMsg("Payment confirmed — unlocking Concierge…");
      try {
        const confirmed = await confirmOctopusCheckoutSession({
          sessionId: stripeSessionFromUrl,
          banditId: id,
          guestEmail,
        });
        if (!cancelled && !confirmed.ok) {
          setCheckoutMsg(confirmed.detail);
        }
        if (!cancelled) await refreshEntitlement();
      } finally {
        if (!cancelled) setClaimingPaid(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [claimingPaid, guestEmail, id, refreshEntitlement, stripeCheckoutFlag, stripeSessionFromUrl]);

  const onUnlock = async () => {
    if (!id || checkoutBusy) return;
    if (!guestEmail) {
      setCheckoutMsg("Sign in to unlock Your Local Insider.");
      return;
    }
    // Eligibility gate — never leave Unlock stuck on Confirming for ineligible sellers.
    if (!visibility?.showPremiumInsights || !visibility.commerceOperational) {
      setCheckoutMsg(
        "Your Local Insider isn't available with this Local banDit yet. City Guide and Ask Me stay free.",
      );
      setBanditAuthorized(false);
      return;
    }
    setCheckoutBusy(true);
    setCheckoutMsg("Opening Stripe Checkout…");
    let settled = false;
    const wall = setTimeout(() => {
      if (settled) return;
      settled = true;
      setCheckoutBusy(false);
      setCheckoutMsg(RECOVERABLE_CHECKOUT_TIMEOUT);
    }, CHECKOUT_UI_WALL_MS);
    try {
      const result = await startOctopusConciergeCheckout({
        guestId,
        banditId: id,
        guestEmail,
        stayId: "current_stay",
        successPath: `/premium/${encodeURIComponent(id)}`,
        cancelPath: `/premium/${encodeURIComponent(id)}`,
      });
      if (settled) return;
      if (!result.ok) {
        setCheckoutMsg(result.detail);
        return;
      }
      if (result.paymentConfirmed) {
        setCheckoutMsg("Stay Pass already active — refreshing access…");
        if (settled) return;
        await refreshEntitlement();
        return;
      }
      const checkoutUrl =
        "checkoutUrl" in result && typeof result.checkoutUrl === "string" ? result.checkoutUrl : "";
      if (!checkoutUrl || !/checkout\.stripe\.com/i.test(checkoutUrl)) {
        setCheckoutMsg(
          checkoutUrl
            ? "Checkout did not return Stripe — try again or contact support."
            : "Checkout did not return a payment URL — try Unlock again.",
        );
        return;
      }
      setCheckoutMsg("Redirecting to Stripe Checkout…");
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.location.assign(checkoutUrl);
        return;
      }
      const { Linking } = await import("react-native");
      await Linking.openURL(checkoutUrl);
    } catch (e) {
      if (settled) return;
      setCheckoutMsg(
        e instanceof Error
          ? e.message
          : "Checkout failed. No charge completed — try Unlock again.",
      );
    } finally {
      if (!settled) {
        settled = true;
        setCheckoutBusy(false);
      }
      clearTimeout(wall);
    }
  };

  /** Hydrate Active / Status / Completed from Workspace view=track (bounded poll). */
  const refreshTrack = useCallback(async () => {
    if (!id || !guestEmail || !entitled) return;
    const track = await fetchConciergeTrack({ banditId: id, guestEmail });
    if (!track.ok) {
      setTrackHydration("missing");
      return;
    }
    setTrackHydration("ok");
    const guestKey = guestId || guestEmail;
    setTasks((prev) =>
      mergeTrackIntoTasks(prev, track.requests, banditName, guestKey, id),
    );
  }, [banditName, entitled, guestEmail, guestId, id]);

  useEffect(() => {
    if (!entitled || !id || !guestEmail) return;
    let cancelled = false;
    void refreshTrack();
    // Minimal poll so provider replies appear without inventing a second entitlement system.
    const timer = setInterval(() => {
      if (!cancelled) void refreshTrack();
    }, 12_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [entitled, guestEmail, id, refreshTrack]);

  const submitAsk = (serviceLabel = "Special requests") => {
    if (submittingRef.current) return;
    if (!entitlement || !assertConciergeOpsAllowed(entitlement)) return;
    if (!guestEmail) {
      setSentMsg("Sign in required to send a concierge request.");
      return;
    }
    if (
      typeof entitlement.requestsRemaining === "number" &&
      entitlement.requestsRemaining <= 0
    ) {
      setSentMsg("Stay Pass allowance used up for this stay — renew to send more requests.");
      return;
    }
    const t = askText.trim();
    const substantive = isSubstantiveConciergeNote(t, [
      ...BOOK_ACTIONS.map((a) => a.title),
      ...BOOK_ACTIONS.map((a) => a.service),
      activeAction || "",
      serviceLabel,
    ]);
    if (!substantive.ok) {
      setSentMsg(
        substantive.reason === "prefix_only" || substantive.reason === "empty"
          ? "Add request details before sending — this does not use a Stay Pass request."
          : "Add a bit more detail so your banDit can act — this does not use a Stay Pass request.",
      );
      setTimeout(() => setSentMsg(null), 4500);
      return;
    }
    const task = createConciergeTaskStub(entitlement, {
      request: t,
      banditDisplayName: banditName,
    });
    if (!task) return;
    const clientRequestId = `crq_${task.id}`;
    submittingRef.current = true;
    setTasks((prev) => [task, ...prev]);
    setAskText("");
    const handling =
      operatorResolution && !operatorResolution.canGuestTrustHumanClaim
        ? `${operatorResolution.guestLabel} · request received`
        : OCTOPUS_CONCIERGE_PRODUCT_LAW.guestVoice.handling(first);
    setSentMsg(handling);
    void submitConciergeRequestToWorkspace({
      banditId: id,
      service: serviceLabel,
      note: t,
      guestEmail,
      guestId: entitlement.guestId,
      clientRequestId,
    }).then((r) => {
      submittingRef.current = false;
      if (!r.ok) {
        // Roll back optimistic local task — do not pretend fulfillment started.
        setTasks((prev) => prev.filter((x) => x.id !== task.id));
        setSentMsg(
          r.code === "premium_required"
            ? "Premium required — unlock Your Local Insider to send requests."
            : r.code === "validation"
              ? r.detail
              : `Could not send · ${r.detail}`,
        );
        void refreshEntitlement();
        return;
      }
      // Bind local stub to Workspace request id so view=track merges correctly.
      setTasks((prev) =>
        prev.map((x) => (x.id === task.id ? { ...x, id: r.requestId, status: "assigned_to_bandit" } : x)),
      );
      if (typeof r.requestsRemaining === "number") {
        const remaining = r.requestsRemaining;
        setEntitlement((prev) =>
          prev ? { ...prev, requestsRemaining: remaining } : prev,
        );
        setSentMsg(`${handling} · #${r.requestId} · ${remaining} left`);
      } else {
        setSentMsg(`${handling} · #${r.requestId}`);
      }
      // Always re-read Commerce so the count matches durable remaining after confirmation.
      void refreshEntitlement();
      void refreshTrack();
    }).catch(() => {
      submittingRef.current = false;
    });
    setTimeout(() => setSentMsg(null), 4500);
  };

  const startAction = (action: (typeof BOOK_ACTIONS)[number]) => {
    if (!entitlement || !assertConciergeOpsAllowed(entitlement)) return;
    setActiveAction(action.service);
    setAskText(`${action.title}: `);
    setSentMsg(null);
  };

  const activeTasks = tasks.filter((t) =>
    ["requested", "understanding", "searching", "assigned_to_bandit", "in_progress", "booking", "awaiting_guest"].includes(
      t.status,
    ),
  );
  const statusTasks = tasks.filter((t) => t.status !== "cancelled");
  const completedTasks = tasks.filter((t) => t.status === "completed");

  if (
    banditAuthorized === null ||
    !identityReady ||
    entitlementLoading ||
    loadingBandit ||
    claimingPaid
  ) {
    return (
      <View style={styles.salesScreen}>
        <Stack.Screen options={salesHeader} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={color.brand} />
          <Text style={styles.loadingText}>
            {claimingPaid ? "Confirming payment…" : "Checking Premium Insights access…"}
          </Text>
        </View>
      </View>
    );
  }

  if (banditAuthorized === false) {
    return (
      <View style={styles.salesScreen}>
        <Stack.Screen options={salesHeader} />
        <View style={[styles.salesContent, { width: contentWidth, paddingTop: 48 }]}>
          <Text style={styles.salesTitle} testID="local-insider-ineligible">
            Your Local Insider not available
          </Text>
          <Text style={styles.salesLead}>
            {`${first} still offers free City Guide and Ask Me. Octopus Concierge appears only when this Local banDit is Octopus Verified.`}
          </Text>
          <Text style={styles.secureHint} testID="local-insider-ineligible-detail">
            {visibility?.authorizationClass === "NONE" || !visibility?.showPremiumInsights
              ? "This Local banDit is not commercially authorized for Stay Pass."
              : visibility.blockers?.[0] ||
                "Purchases open only for Octopus Verified Local banDits."}
          </Text>
        </View>
      </View>
    );
  }

  const entitlementEnded =
    entitlement?.state === "exhausted" || entitlement?.state === "expired";

  // SALES / RENEWAL — concise: headline, price, <=3 benefits, one CTA
  if (!entitled) {
    const commerceReady =
      visibility?.commerceOperational === true &&
      entitlement?.state !== "unavailable" &&
      Boolean(guestEmail);
    const compactBenefits = [
      `Up to 5 requests with ${first} this stay`,
      "Tables, tickets and transfers handled for you",
      "City Guide stays free - this is paid execution",
    ] as const;
    return (
      <View style={styles.salesScreen}>
        <Stack.Screen options={salesHeader} />
        <ScrollView
          contentContainerStyle={[styles.salesContent, { width: contentWidth }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          testID="local-insider-sales-screen"
        >
          <View style={styles.brandRow}>
            <LocalBanditOctopusIcon style={styles.brandIcon} />
            <Text style={styles.kicker}>
              {visibility?.authorizationClass === "TEST_DEMO"
                ? "OCTOPUS CONCIERGE · TEST"
                : "OCTOPUS CONCIERGE"}
            </Text>
          </View>
          <Text style={styles.salesTitle}>Your Local Insider</Text>
          <Text style={styles.salesLead}>Your city. Your insider.</Text>
          <Text style={styles.salesPersuade}>
            {entitlementEnded
              ? entitlement?.state === "exhausted"
                ? `Your Stay Pass with ${first} has no requests left. Renew to keep going.`
                : `Your Stay Pass with ${first} has ended. Renew for this stay.`
              : `Go beyond recommendations. ${first} helps make things happen.`}
          </Text>

          <View style={styles.priceBlock}>
            <Text style={styles.price}>{OCTOPUS_CONCIERGE_OFFER.priceLabel}</Text>
            <Text style={styles.pricePeriod}>{OCTOPUS_CONCIERGE_OFFER.periodLabel}</Text>
          </View>

          <View style={styles.outcomeList}>
            {compactBenefits.map((line) => (
              <Text key={line} style={styles.outcomeLine}>
                {`- ${line}`}
              </Text>
            ))}
          </View>

          {commerceReady ? (
            <Pressable
              style={[styles.unlockCta, checkoutBusy && styles.unlockCtaBusy]}
              onPress={() => void onUnlock()}
              disabled={checkoutBusy}
              accessibilityRole="button"
              testID="local-insider-unlock-cta"
            >
              <Text style={styles.unlockCtaText}>
                {checkoutBusy
                  ? checkoutMsg?.startsWith("Confirming")
                    ? checkoutMsg
                    : visibility?.authorizationClass === "TEST_DEMO"
                      ? "Confirming TEST payment…"
                      : "Confirming payment…"
                  : entitlementEnded
                    ? `Renew Stay Pass — ${OCTOPUS_CONCIERGE_OFFER.priceLabel}`
                    : `Unlock Your Local Insider — ${OCTOPUS_CONCIERGE_OFFER.priceLabel}`}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.distinctionBox} testID="local-insider-checkout-gated">
              <Text style={styles.distinctionLabel}>
                {guestEmail ? "Checkout unavailable" : "Sign in required"}
              </Text>
              <Text style={styles.distinction}>
                {guestEmail
                  ? entitlement?.detail ||
                    "Purchases open after Workspace commerce and a verified stay are ready. City Guide and Ask Me stay free."
                  : "Sign in with your Guest account to purchase Stay Pass. City Guide and Ask Me stay free."}
              </Text>
            </View>
          )}

          <Text style={styles.secureHint}>
            {visibility?.authorizationClass === "TEST_DEMO"
              ? "QA TEST_DEMO · Stripe TEST Checkout · LIVE off · not a PRODUCTION seller"
              : "Secure Stripe Checkout (TEST) · unlocks after payment · third-party costs billed separately"}
          </Text>

          {checkoutMsg ? (
            <Text style={styles.checkoutMsg} testID="local-insider-checkout-msg">
              {checkoutMsg}
            </Text>
          ) : null}

          <Pressable onPress={() => void refreshEntitlement()} style={styles.verifyLink} accessibilityRole="button">
            <Text style={styles.verifyLinkText}>Already paid? Verify access</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // â”€â”€â”€ CONCIERGE OS (entitled only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const remaining =
    typeof entitlement?.requestsRemaining === "number" ? entitlement.requestsRemaining : null;
  return (
    <View style={styles.opsScreen}>
      <Stack.Screen options={opsHeader} />
      <ScrollView
        contentContainerStyle={[styles.opsContent, { width: contentWidth }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandRow}>
          <LocalBanditOctopusIcon style={styles.brandIcon} />
          <Text style={styles.opsKicker}>PREMIUM INSIGHTS</Text>
        </View>
        <Text style={styles.opsIdentity}>{banditName}</Text>
        {operatorResolution ? (
          <Text style={styles.opsOperatorType} testID="concierge-operator-type">
            {operatorResolution.operatorType === "UNDECLARED"
              ? "Operator type not declared by Workspace — Concierge is request-queue based, not a chatbot."
              : `Operator: ${operatorResolution.guestLabel}`}
          </Text>
        ) : null}
        <Text style={styles.opsTagline}>
          {remaining != null
            ? `${first}'s Athens is unlocked — ${remaining} request${remaining === 1 ? "" : "s"} left this stay.`
            : `${first}'s Athens is unlocked — ask anything, or pick what ${first} can handle.`}
        </Text>
        <Text style={styles.opsDisclosure}>
          Stay Pass (€19) covers coordination. Third-party costs (tables, tickets, rides, delivery) need your explicit
          approval before money moves — never from chat text alone.
        </Text>

        <View style={styles.askCard}>
          <Text style={styles.askTitle}>Ask My banDit</Text>
          <Text style={styles.askLead}>Need something arranged?</Text>
          <TextInput
            style={styles.askInput}
            placeholder={`Ask ${first}… e.g. Book a table for 4 tonight somewhere Greek but not touristy.`}
            placeholderTextColor={color.muted}
            value={askText}
            onChangeText={setAskText}
            multiline
          />
          <Pressable style={styles.askCta} onPress={() => submitAsk(activeAction || "Special requests")}>
            <Text style={styles.askCtaText}>Ask {first}</Text>
          </Pressable>
          {sentMsg ? <Text style={styles.sent}>{sentMsg}</Text> : null}
        </View>

        <Text style={styles.opsSection}>Quick actions</Text>
        <View style={[styles.actionGrid, { gap }]}>
          {BOOK_ACTIONS.map((a) => (
            <Pressable
              key={a.id}
              style={[
                styles.actionCard,
                { width: cardWidth },
                activeAction === a.service && styles.actionCardOn,
              ]}
              onPress={() => startAction(a)}
            >
              <Text style={styles.actionEmoji}>{a.emoji}</Text>
              <Text style={styles.actionTitle}>{a.title}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.opsSection}>Active Requests</Text>
        {trackHydration === "missing" ? (
          <Text style={styles.emptyTasks} testID="concierge-track-missing">
            Request updates unavailable right now — pull to retry or ask again later.
          </Text>
        ) : null}
        {activeTasks.length === 0 ? (
          <Text style={styles.emptyTasks}>No active requests yet — ask {first} anything above.</Text>
        ) : (
          activeTasks.map((r) => (
            <Pressable key={r.id} style={styles.requestRow} testID={`concierge-active-${r.id}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.requestTitle}>
                  {r.request.length > 48 ? `${r.request.slice(0, 48)}…` : r.request}
                </Text>
                {r.providerReply ? (
                  <Text style={styles.requestWhen} testID={`concierge-reply-${r.id}`}>
                    {r.providerReply}
                  </Text>
                ) : (
                  <Text style={styles.requestWhen}>{r.updatedAt.slice(0, 16).replace("T", " ")}</Text>
                )}
              </View>
              <Text style={styles.status}>{guestFacingConciergeStatus(r.status, first)}</Text>
            </Pressable>
          ))
        )}

        <Text style={styles.opsSection}>Status</Text>
        {statusTasks.length === 0 ? (
          <Text style={styles.emptyTasks}>No updates yet.</Text>
        ) : (
          statusTasks.map((r) => (
            <View key={`st_${r.id}`} style={styles.requestRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.requestTitle}>
                  {r.request.length > 48 ? `${r.request.slice(0, 48)}…` : r.request}
                </Text>
                {r.providerReply ? (
                  <Text style={styles.requestWhen} testID={`concierge-status-reply-${r.id}`}>
                    {r.providerReply}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.status}>{guestFacingConciergeStatus(r.status, first)}</Text>
            </View>
          ))
        )}

        <Text style={styles.opsSection}>Completed Requests</Text>
        {completedTasks.length === 0 ? (
          <Text style={styles.emptyTasks}>Nothing completed yet.</Text>
        ) : (
          completedTasks.map((r) => (
            <View key={`done_${r.id}`} style={styles.requestRow} testID={`concierge-done-${r.id}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.requestTitle}>
                  {r.request.length > 48 ? `${r.request.slice(0, 48)}…` : r.request}
                </Text>
                {r.providerReply ? (
                  <Text style={styles.requestWhen}>{r.providerReply}</Text>
                ) : null}
              </View>
              <Text style={[styles.status, { color: color.statusGreen }]}>Done</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const CORAL_SOFT = "#FF6B6B";
const NAVY_SOFT = "#1B2A4A";

const styles = StyleSheet.create({
  salesScreen: {
    flex: 1,
    backgroundColor: color.surface,
  },
  salesContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 56,
    maxWidth: 560,
    alignSelf: "center",
  },
  salesHero: {
    width: "100%",
    aspectRatio: 4 / 5,
    borderRadius: 22,
    overflow: "hidden",
    marginBottom: 20,
    backgroundColor: "#111",
  },
  salesHeroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  salesHeroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  salesHeroCopy: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 20,
  },
  kickerOnHero: {
    color: "#FF8A80",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  salesTitleOnHero: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.6,
    lineHeight: 36,
    fontFamily: "Caros",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: color.surface,
  },
  loadingText: {
    color: color.muted,
    fontSize: 14,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  brandIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    marginRight: 0,
  },
  kicker: {
    color: color.brand,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  salesTitle: {
    color: color.ink,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.6,
    lineHeight: 36,
    marginBottom: 10,
    fontFamily: "Caros",
  },
  salesLead: {
    color: color.inkSoft,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 10,
    fontWeight: "600",
  },
  salesPersuade: {
    color: color.ink,
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 14,
    fontWeight: "500",
  },
  distinctionBox: {
    backgroundColor: "#FFF5F5",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(224,49,49,0.18)",
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  distinctionLabel: {
    color: color.brand,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  distinction: {
    color: NAVY_SOFT,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  outcomeList: {
    gap: 8,
    marginBottom: 20,
    paddingHorizontal: 2,
  },
  outcomeLine: {
    color: color.inkSoft,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  afterUnlockHint: {
    marginTop: 20,
    fontSize: 12,
    lineHeight: 18,
    color: color.muted,
    textAlign: "center",
  },
  benefitGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 20,
  },
  benefitCard: {
    backgroundColor: color.surfaceWarm,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  benefitHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  benefitEmoji: {
    fontSize: 16,
  },
  benefitTitle: {
    color: color.ink,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 17,
    flex: 1,
  },
  benefitLine: {
    color: color.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
    paddingLeft: 24,
  },
  priceBlock: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginBottom: 6,
  },
  price: {
    color: color.ink,
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  pricePeriod: {
    color: color.muted,
    fontSize: 15,
    fontWeight: "600",
  },
  unlockSupport: {
    color: color.inkSoft,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    fontWeight: "500",
  },
  unlockCta: {
    backgroundColor: color.brand,
    borderRadius: radius.lg,
    paddingVertical: 16,
    paddingHorizontal: 22,
    alignItems: "center",
    alignSelf: "flex-start",
    maxWidth: 360,
    minWidth: 260,
    ...({
      boxShadow: "0 8px 24px rgba(224,49,49,0.28)",
    } as object),
  },
  unlockCtaBusy: {
    opacity: 0.72,
  },
  unlockCtaText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.15,
    textAlign: "center",
  },
  secureHint: {
    marginTop: 12,
    textAlign: "left",
    color: color.muted,
    fontSize: 12,
    fontWeight: "500",
    maxWidth: 360,
  },
  checkoutMsg: {
    marginTop: 14,
    textAlign: "left",
    color: NAVY_SOFT,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    maxWidth: 360,
  },
  verifyLink: {
    marginTop: 20,
    paddingVertical: 10,
    alignItems: "flex-start",
  },
  verifyLinkText: {
    color: color.inkSoft,
    fontWeight: "600",
    fontSize: 14,
    textDecorationLine: "underline",
  },

  opsScreen: {
    flex: 1,
    backgroundColor: color.surfaceWarm,
  },
  opsContent: {
    padding: 20,
    paddingBottom: 56,
    maxWidth: 560,
    alignSelf: "center",
  },
  opsKicker: {
    color: color.brand,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  opsIdentity: {
    color: color.ink,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  opsOperatorType: {
    marginTop: 6,
    color: color.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  opsTagline: {
    marginTop: 8,
    marginBottom: 8,
    color: color.inkSoft,
    fontSize: 15,
    lineHeight: 22,
  },
  opsDisclosure: {
    marginBottom: 20,
    color: color.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  askCard: {
    backgroundColor: color.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: color.hairline,
    marginBottom: 20,
  },
  askTitle: {
    color: color.ink,
    fontSize: 20,
    fontWeight: "800",
  },
  askLead: {
    color: color.muted,
    fontSize: 14,
    marginTop: 6,
    marginBottom: 12,
  },
  askInput: {
    minHeight: 88,
    borderRadius: 14,
    backgroundColor: color.surfaceSoft,
    borderWidth: 1,
    borderColor: color.hairline,
    color: color.ink,
    padding: 14,
    fontSize: 15,
    textAlignVertical: "top",
  },
  askCta: {
    marginTop: 12,
    backgroundColor: color.brand,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    maxWidth: 280,
    alignSelf: "flex-start",
  },
  askCtaText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
  },
  sent: {
    marginTop: 10,
    color: color.statusGreen,
    fontWeight: "700",
    fontSize: 13,
  },
  opsSection: {
    color: NAVY_SOFT,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 10,
    marginTop: 8,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  actionCard: {
    backgroundColor: color.surface,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: color.hairline,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 48,
  },
  actionCardOn: {
    borderColor: color.brand,
    backgroundColor: "#FFF5F5",
  },
  actionEmoji: {
    fontSize: 18,
  },
  actionTitle: {
    color: color.ink,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 17,
    flex: 1,
  },
  emptyTasks: {
    color: color.muted,
    fontSize: 13,
    marginBottom: 12,
  },
  requestRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: color.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  requestTitle: {
    color: color.ink,
    fontWeight: "700",
    fontSize: 14,
  },
  requestWhen: {
    color: color.muted,
    fontSize: 12,
    marginTop: 4,
  },
  status: {
    fontSize: 11,
    fontWeight: "800",
    color: color.brand,
    maxWidth: 110,
    textAlign: "right",
  },
});
