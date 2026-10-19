import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Stack } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useAppState } from "@/contexts/AppStateContext";
import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import { color, radius } from "@/lib/guestDesign";
import {
  IMPACT_DROP_MILESTONE,
  IMPACT_DROP_RULES,
  dropsForCity,
  listImpactEvents,
  sharePassportText,
  type ImpactEvent,
} from "@/lib/impact/ledger";
import { IMPACT_VIEW, isValidExperienceImageUrl } from "@/lib/guest-workspace/productWorlds";
import {
  cancelVolunteerRegistration,
  fetchMyVolunteerRegistrations,
  fetchVolunteerOpportunities,
  formatVolunteerWhen,
  joinVolunteerOpportunity,
  syncVolunteerDropsToLedger,
  type GuestVolunteerOpportunity,
  type GuestVolunteerRegistration,
} from "@/lib/guest-workspace/liveVolunteering";

const HEADLINE = "Your Impact — Give back where you travel.";

/** Only a photo published on this session. Never a stand-in from another partner. */
function publishedPhoto(slot: GuestVolunteerOpportunity): string | null {
  const row = slot as GuestVolunteerOpportunity & Record<string, unknown>;
  for (const key of ["imageUrl", "photoUrl", "coverUrl", "heroUrl"]) {
    const value = row[key];
    if (typeof value === "string" && isValidExperienceImageUrl(value)) return value.trim();
  }
  return null;
}

/** Impact — presentation only. Ledger, join, and Ocean scoring stay as they are. */
export function ImpactScreen() {
  const { width } = useWindowDimensions();
  const { activeIdentity, getCurrentUser } = useAppState();
  const userId = activeIdentity?.userId || "guest";
  const screenOptions = useAppBackScreenOptions({
    title: "Impact / Passport",
    fallback: "/menu",
    showBack: true,
    escapeShortcuts: true,
  });
  const [events, setEvents] = useState<ImpactEvent[]>([]);
  const [causeNote, setCauseNote] = useState<string | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [guestEmail, setGuestEmail] = useState<string>("guest@banditour.demo");
  const [opportunities, setOpportunities] = useState<GuestVolunteerOpportunity[]>([]);
  const [registrations, setRegistrations] = useState<GuestVolunteerRegistration[]>([]);
  const [volNote, setVolNote] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const oceanMax = Math.min(width - 32, 960);
  const coverAspect = width >= 800 ? 2.15 : 1.5;
  const drops = dropsForCity(events);
  const fillRatio = Math.min(1, drops / IMPACT_DROP_MILESTONE);
  const cities = [...new Set(events.map((item) => item.city).filter(Boolean))];

  const refreshLedger = async () => {
    setEvents(await listImpactEvents(userId));
  };

  const refreshVolunteering = async (email: string) => {
    const [ops, mine] = await Promise.all([
      fetchVolunteerOpportunities("Athens", email),
      fetchMyVolunteerRegistrations(email),
    ]);
    if (ops.ok) setOpportunities(ops.opportunities);
    if (mine.ok) setRegistrations(mine.registrations);
    const sync = await syncVolunteerDropsToLedger({ userId, guestEmail: email });
    if (sync.synced > 0) {
      setVolNote(`+${sync.synced * IMPACT_DROP_RULES.verified_volunteer_completion} Drops from verified volunteering.`);
      await refreshLedger();
    } else {
      await refreshLedger();
    }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const user = await getCurrentUser();
      const email = (user?.email || "guest@banditour.demo").trim().toLowerCase();
      if (cancelled) return;
      setGuestEmail(email);
      await refreshVolunteering(email);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per identity
  }, [userId, getCurrentUser]);

  const onJoin = async (opportunityId: string) => {
    setJoiningId(opportunityId);
    setVolNote(null);
    const before = dropsForCity(await listImpactEvents(userId));
    const result = await joinVolunteerOpportunity(opportunityId, guestEmail);
    await refreshVolunteering(guestEmail);
    const after = dropsForCity(await listImpactEvents(userId));
    setJoiningId(null);
    if (!result.ok) {
      setVolNote(result.detail || "Could not join.");
      return;
    }
    setVolNote(
      after === before
        ? "You're registered. Drops are added only after the organization confirms you were there."
        : "You're registered.",
    );
  };

  const onCancel = async (registrationId: string) => {
    const result = await cancelVolunteerRegistration(registrationId, guestEmail);
    await refreshVolunteering(guestEmail);
    setVolNote(result.ok ? "Registration cancelled." : result.detail || "Could not cancel.");
  };

  const onShare = async () => {
    if (!events.length) {
      setShareNote("Nothing verified to share yet.");
      return;
    }
    const message = sharePassportText(events);
    setShareNote(message);
    try {
      await Share.share({ message });
    } catch {
      /* user dismissed */
    }
  };

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
      >
        <View style={styles.column}>
          <Text testID="impact-user" style={styles.srOnly}>
            {userId}
          </Text>
          <Text testID="impact-headline" style={styles.title}>
            {HEADLINE}
          </Text>

          <Text style={styles.oceanLabel}>Your Impact Ocean</Text>
          <WaterDropOcean
            fillRatio={fillRatio}
            maxWidth={oceanMax}
            destination={events[0]?.city || "Your travels"}
            earned={drops}
            required={IMPACT_DROP_MILESTONE}
            hint={
              drops === 0
                ? "No verified Drops yet. The ocean stays quiet until a confirmed action is recorded."
                : `${Math.max(0, IMPACT_DROP_MILESTONE - drops)} Drops to the next mark. Drops are not redeemable.`
            }
          />

          <View style={styles.rulesRow}>
            <Text style={styles.rules} testID="impact-drop-rules">
              {`Purchase +${IMPACT_DROP_RULES.verified_local_purchase} · Cause +${IMPACT_DROP_RULES.verified_cause_contribution} · Volunteering +${IMPACT_DROP_RULES.verified_volunteer_completion}`}
            </Text>
            <Pressable
              onPress={() => setRulesOpen((open) => !open)}
              testID="impact-rules-info"
              accessibilityRole="button"
              accessibilityLabel="How verification works"
              hitSlop={8}
              style={styles.infoBtn}
            >
              <Ionicons
                name={rulesOpen ? "information-circle" : "information-circle-outline"}
                size={22}
                color={color.ink}
              />
            </Pressable>
          </View>
          {rulesOpen ? (
            <View style={styles.infoPanel} testID="impact-verification">
              <Text style={styles.infoText}>
                Drops count confirmed actions only. They are not a measure of trees, plastic, or money.
                The same action cannot be counted twice, and Drops are not redeemable.
              </Text>
              <Text style={styles.infoText}>
                {`Purchase +${IMPACT_DROP_RULES.verified_local_purchase}. Cause contribution +${IMPACT_DROP_RULES.verified_cause_contribution}. Volunteering +${IMPACT_DROP_RULES.verified_volunteer_completion} only after an organization confirms you were there. Joining does not add Drops.`}
              </Text>
              <Text style={styles.infoText}>
                Your Passport shares verified Drops and cities. No hotel, spending, or precise places.
              </Text>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>Volunteer in Athens</Text>
          <Text style={styles.sectionLead} testID="impact-volunteer-flow">
            Free. Pick a date and join.
          </Text>
          <View testID="impact-volunteer-explore" style={styles.stack}>
            {opportunities.length === 0 ? (
              <Text style={styles.sectionLead} testID="impact-volunteer-empty">
                No verified volunteer dates in Athens yet.
              </Text>
            ) : (
              opportunities.map((slot) => {
                const mine = registrations.find(
                  (r) => r.opportunityId === slot.id && r.status !== "cancelled" && r.status !== "rejected",
                );
                return (
                  <View key={slot.id} style={styles.oppCard} testID={`impact-volunteer-slot-${slot.id}`}>
                    <OpportunityCover slot={slot} aspect={coverAspect} />
                    <View style={styles.oppBody}>
                      <Text style={styles.oppTitle}>{slot.title}</Text>
                      <View style={styles.metaRow}>
                        <Ionicons name="location-outline" size={15} color={color.inkSoft} />
                        <Text style={styles.metaText}>{slot.destination || slot.city}</Text>
                      </View>
                      <View style={styles.metaRow}>
                        <Ionicons name="calendar-outline" size={15} color={color.inkSoft} />
                        <Text style={styles.metaText}>{formatVolunteerWhen(slot.startsAt, slot.endsAt)}</Text>
                      </View>
                      <Text style={styles.oppQuiet}>
                        {slot.organizationName}
                        {slot.demo ? " · TEST" : ""} · {slot.seatsLeft} seats
                      </Text>
                      {slot.demo ? (
                        <Text style={styles.nonbookable} testID={`impact-volunteer-test-${slot.id}`}>
                          TEST · not bookable
                        </Text>
                      ) : null}
                      {mine?.status === "attended" ? (
                        <Text style={styles.verifiedMark} testID={`impact-volunteer-status-${slot.id}`}>
                          Verified
                        </Text>
                      ) : mine ? (
                        <Pressable
                          onPress={() => void onCancel(mine.id)}
                          testID={`impact-volunteer-cancel-${slot.id}`}
                          style={styles.joinedBtn}
                          accessibilityRole="button"
                          accessibilityLabel="Cancel registration"
                        >
                          <Text style={styles.joinedBtnText}>
                            {mine.status === "approved" ? "Approved" : "Joined"}
                          </Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          disabled={!slot.joinable || joiningId === slot.id}
                          onPress={() => void onJoin(slot.id)}
                          testID={`impact-volunteer-join-${slot.id}`}
                          accessibilityRole="button"
                          accessibilityLabel={`Join ${slot.title}`}
                          style={[
                            styles.joinBtn,
                            (!slot.joinable || joiningId === slot.id) && styles.joinBtnDisabled,
                          ]}
                        >
                          <Text style={styles.joinBtnText}>
                            {joiningId === slot.id ? "Joining…" : slot.joinable ? "Join" : "Full"}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
          {volNote ? (
            <Text style={styles.note} testID="impact-volunteer-note">
              {volNote}
            </Text>
          ) : null}

          <Text style={styles.sectionTitle}>What you left behind</Text>
          {events.length === 0 ? (
            <Text style={styles.sectionLead} testID="impact-empty">
              No verified impact yet.
            </Text>
          ) : (
            <View style={styles.leftBehindList} testID="impact-history">
              {events.map((item, index) => (
                <View
                  key={item.id}
                  style={[styles.leftBehindRow, index === events.length - 1 && styles.leftBehindRowLast]}
                  testID={`impact-event-${item.id}`}
                >
                  <Text style={styles.dropPill}>{item.drops}</Text>
                  <View style={styles.leftBehindCopy}>
                    <Text style={styles.leftBehindText}>
                      <Text style={styles.leftBehindValue}>{item.title}</Text>
                      {" · "}
                      {item.city}
                    </Text>
                    <Text style={styles.oppQuiet}>{item.evidence}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.sectionTitle}>Inspiration</Text>
          <Text style={styles.sectionLead}>Not bookable.</Text>
          <View style={styles.stack}>
            {IMPACT_VIEW.causes.map((c) => (
              <Pressable
                key={c.id}
                style={({ pressed }) => [styles.oppCard, pressed && styles.pressed]}
                onPress={() =>
                  setCauseNote(
                    `${c.name} is inspiration. ${c.organizationName} is not an approved partner in this app.`,
                  )
                }
                testID={`impact-cause-${c.id}`}
              >
                <TypeCover kicker={c.family} title={c.imageLabel} aspect={width >= 800 ? 2.4 : 1.85} />
                <View style={styles.nonbookBadge}>
                  <Text style={styles.nonbookBadgeText}>Not bookable</Text>
                </View>
                <View style={styles.oppBody}>
                  <Text style={styles.oppTitle}>{c.name}</Text>
                  <Text style={styles.oppQuiet} numberOfLines={2}>
                    {c.guestDescription}
                  </Text>
                  <Text style={styles.oppMetaStrong}>{c.organizationName}</Text>
                </View>
              </Pressable>
            ))}
            {IMPACT_VIEW.volunteer.map((v) => (
              <View key={v.id} style={styles.oppCard} testID={`impact-editorial-${v.id}`}>
                <TypeCover kicker="Inspiration" title={v.title} aspect={width >= 800 ? 2.4 : 1.85} />
                <View style={styles.nonbookBadge}>
                  <Text style={styles.nonbookBadgeText}>Not bookable</Text>
                </View>
                <View style={styles.oppBody}>
                  <Text style={styles.oppTitle}>{v.title}</Text>
                  <Text style={styles.oppQuiet}>{v.when} · Inspiration, not an open signup</Text>
                </View>
              </View>
            ))}
          </View>
          {causeNote ? (
            <Text style={styles.note} testID="impact-cause-note">
              {causeNote}
            </Text>
          ) : null}

          <View style={styles.passport} testID="impact-passport">
            <View style={styles.passportRibbon} />
            <Text style={styles.passportKicker}>Impact Passport</Text>
            <Text style={styles.passportHeadline}>
              {events.length ? `${drops} verified Drops` : "No stamps yet"}
            </Text>
            <View style={styles.passportPage}>
              {events.length === 0 ? (
                <View style={styles.stamp}>
                  <Text style={styles.stampMark}>—</Text>
                </View>
              ) : (
                events.map((item) => (
                  <View key={item.id} style={styles.stampRow}>
                    <Text style={styles.stampCity}>{item.city}</Text>
                    <Text style={styles.stampTitle}>{item.title}</Text>
                    <Text style={styles.stampDate}>{item.at.slice(0, 10)}</Text>
                  </View>
                ))
              )}
              <Text style={styles.passportPlaces}>
                {events.length
                  ? cities.join(" · ")
                  : "Your Passport stays blank until a verified action is yours."}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.shareAction, pressed && styles.pressed]}
              onPress={() => void onShare()}
              testID="impact-share"
              accessibilityRole="button"
            >
              <Text style={styles.shareActionText}>{events.length ? "Share Passport" : "Nothing to share"}</Text>
            </Pressable>
            <Text style={styles.passportPrivacy}>Verified Drops and cities only.</Text>
          </View>
          {shareNote ? (
            <Text style={styles.note} testID="impact-share-note">
              {shareNote}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </>
  );
}

function OpportunityCover({
  slot,
  aspect,
}: {
  slot: GuestVolunteerOpportunity;
  aspect: number;
}) {
  const [failed, setFailed] = useState(false);
  const photo = failed ? null : publishedPhoto(slot);
  return (
    <View style={[styles.cover, { aspectRatio: aspect }]}>
      {photo ? (
        <ExpoImage
          source={{ uri: photo }}
          style={styles.coverImage}
          contentFit="cover"
          onError={() => setFailed(true)}
          accessibilityLabel={`${slot.title} photo`}
        />
      ) : (
        <LinearGradient
          colors={slot.demo ? ["#2C2C2C", "#141414"] : ["#F3EEE6", "#E6DDD2"]}
          style={StyleSheet.absoluteFill}
        />
      )}
      {photo ? null : (
        <View style={styles.coverCopy}>
          <Text style={[styles.coverKicker, slot.demo && styles.coverKickerOnDark]}>
            {slot.demo ? "TEST" : slot.city || "Session"}
          </Text>
          <Text style={[styles.coverHeadline, slot.demo && styles.coverHeadlineOnDark]} numberOfLines={3}>
            {slot.demo ? "No partner photo" : slot.title}
          </Text>
        </View>
      )}
    </View>
  );
}

function TypeCover({ kicker, title, aspect }: { kicker: string; title: string; aspect: number }) {
  return (
    <View style={[styles.cover, { aspectRatio: aspect }]}>
      <LinearGradient colors={["#F6F1EA", "#E8E0D6"]} style={StyleSheet.absoluteFill} />
      <View style={styles.coverCopy}>
        <Text style={styles.coverKicker}>{kicker}</Text>
        <Text style={styles.coverHeadline} numberOfLines={3}>
          {title}
        </Text>
      </View>
    </View>
  );
}

/** Living water-drop meter — blue only here, capped width, not a full-bleed slab. */
function WaterDropOcean({
  fillRatio,
  maxWidth,
  destination,
  earned,
  required,
  hint,
}: {
  fillRatio: number;
  maxWidth: number;
  destination: string;
  earned: number;
  required: number;
  hint: string;
}) {
  const fillAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.7)).current;
  const drop1 = useRef(new Animated.Value(0)).current;
  const drop2 = useRef(new Animated.Value(0)).current;
  const drop3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: Math.min(1, Math.max(0, fillRatio)),
      duration: 1800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.45,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ]),
    );
    pulse.start();

    const makeDrop = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2200,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      );

    const d1 = makeDrop(drop1, 0);
    const d2 = makeDrop(drop2, 700);
    const d3 = makeDrop(drop3, 1400);
    d1.start();
    d2.start();
    d3.start();

    return () => {
      pulse.stop();
      d1.stop();
      d2.stop();
    };
  }, [fillAnim, fillRatio, pulseAnim, drop1, drop2, drop3]);

  const fillHeight = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["8%", "92%"],
  });

  const dropStyle = (anim: Animated.Value, left: `${number}%`) => ({
    position: "absolute" as const,
    left,
    top: 28,
    opacity: anim.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 0.9, 0.7, 0] }),
    transform: [
      { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 120] }) },
      { scale: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 1, 0.5] }) },
    ],
  });

  return (
    <View style={[styles.oceanWrap, { maxWidth, alignSelf: "center", width: "100%" }]}>
      <LinearGradient
        colors={[color.waterDeep, color.waterMid, "#0D5F72"]}
        style={styles.ocean}
      >
        <View style={styles.foamRim} />

        <Animated.View style={[styles.waterFill, { height: fillHeight }]}>
          <LinearGradient
            colors={["rgba(168,232,245,0.55)", "rgba(31,168,201,0.92)", "rgba(10,106,138,0.98)"]}
            locations={[0, 0.22, 1]}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View style={[styles.waveLine, { opacity: pulseAnim }]} />
        </Animated.View>

        <Animated.Text style={[styles.fallingDrop, dropStyle(drop1, "22%")]}>💧</Animated.Text>
        <Animated.Text style={[styles.fallingDrop, dropStyle(drop2, "48%")]}>💧</Animated.Text>
        <Animated.Text style={[styles.fallingDrop, dropStyle(drop3, "72%")]}>💧</Animated.Text>

        <View style={styles.bottleFrame} pointerEvents="none">
          <View style={styles.bottleNeck} />
        </View>

        <View style={styles.oceanContent}>
          <Text style={styles.oceanDest}>{destination}</Text>
          <Text style={styles.oceanCount} testID="impact-drops-count">
            {earned} / {required} Drops
          </Text>
          <Text style={styles.oceanHint}>{hint}</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

export default function ImpactRoute() {
  return <ImpactScreen />;
}

/** Hoisted above StyleSheet.create — avoid TDZ when spreading into styles. */
const PlatformShadow = {
  shadowColor: "#000",
  shadowOpacity: 0.08,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
};

const styles = StyleSheet.create({
  srOnly: { height: 0, width: 0, opacity: 0 },
  screen: { flex: 1, backgroundColor: color.surfaceWarm },
  content: { paddingBottom: 96, paddingTop: 8 },
  column: {
    width: "100%",
    maxWidth: 880,
    alignSelf: "center",
    paddingHorizontal: 16,
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "700",
    color: color.ink,
    letterSpacing: -0.4,
    marginTop: 4,
    marginBottom: 14,
  },
  oceanLabel: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: color.ink,
    marginBottom: 8,
  },
  rulesRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 10,
    marginBottom: 4,
  },
  rules: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
    color: color.ink,
  },
  infoBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  infoPanel: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.hairline,
    padding: 14,
    gap: 8,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    color: color.inkSoft,
  },
  sectionTitle: {
    fontFamily: "Georgia",
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "700",
    color: color.ink,
    marginTop: 22,
    marginBottom: 4,
  },
  sectionLead: {
    fontSize: 15,
    lineHeight: 21,
    color: color.inkSoft,
    marginBottom: 12,
  },
  stack: { gap: 14 },
  note: {
    fontSize: 14,
    lineHeight: 20,
    color: color.inkSoft,
    marginTop: 10,
  },
  oppCard: {
    backgroundColor: color.surface,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: color.hairline,
    ...PlatformShadow,
  },
  cover: {
    width: "100%",
    minHeight: 200,
    backgroundColor: color.imageFallback,
    position: "relative",
  },
  coverImage: {
    ...StyleSheet.absoluteFillObject,
  },
  coverCopy: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 18,
    paddingBottom: 16,
    justifyContent: "flex-end",
  },
  coverKicker: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: color.brand,
    marginBottom: 6,
  },
  coverKickerOnDark: { color: "#F0B4B4" },
  coverHeadline: {
    fontFamily: "Georgia",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    color: color.ink,
  },
  coverHeadlineOnDark: { color: "#FFFFFF" },
  oppBody: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, gap: 6 },
  oppTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
    color: color.ink,
    letterSpacing: -0.3,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { flex: 1, fontSize: 15, lineHeight: 20, color: color.inkSoft, fontWeight: "600" },
  oppQuiet: { fontSize: 13, lineHeight: 18, color: color.muted },
  oppMetaStrong: { fontSize: 14, lineHeight: 18, fontWeight: "700", color: color.inkSoft },
  nonbookable: {
    alignSelf: "flex-start",
    marginTop: 2,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: "#F4F4F4",
    overflow: "hidden",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: color.ink,
  },
  nonbookBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(255,255,255,0.94)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  nonbookBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: color.ink,
  },
  joinBtn: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: color.brand,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  joinBtnDisabled: { opacity: 0.45 },
  joinBtnText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
  joinedBtn: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: color.ink,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  joinedBtnText: { color: color.ink, fontSize: 16, fontWeight: "800" },
  verifiedMark: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: "800",
    color: color.statusGreen,
  },
  leftBehindList: {
    backgroundColor: color.surface,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 14,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: color.hairline,
    ...PlatformShadow,
  },
  leftBehindRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.hairline,
  },
  leftBehindRowLast: { borderBottomWidth: 0 },
  leftBehindCopy: { flex: 1 },
  leftBehindText: { fontSize: 15, color: color.inkSoft, lineHeight: 20 },
  leftBehindValue: { fontWeight: "800", color: color.ink },
  dropPill: {
    minWidth: 36,
    textAlign: "center",
    overflow: "hidden",
    backgroundColor: color.surfaceWarm,
    borderRadius: 10,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: "800",
    color: color.ink,
  },
  passport: {
    marginTop: 26,
    backgroundColor: color.charcoal,
    borderRadius: 26,
    padding: 18,
    paddingTop: 16,
    overflow: "hidden",
  },
  passportRibbon: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: color.brand,
  },
  passportKicker: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.72)",
  },
  passportHeadline: {
    fontFamily: "Georgia",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 4,
    marginBottom: 12,
  },
  passportPage: {
    backgroundColor: "#F7F1E8",
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  stamp: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#B7A898",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  stampMark: { fontSize: 28, color: "#8C7B6B", fontFamily: "Georgia" },
  stampRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E4D9CC",
    paddingBottom: 8,
  },
  stampCity: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: color.brand,
  },
  stampTitle: { fontSize: 16, fontWeight: "800", color: color.ink, marginTop: 2 },
  stampDate: { fontSize: 12, color: color.muted, marginTop: 2 },
  passportPlaces: { fontSize: 13, lineHeight: 18, color: color.inkSoft },
  shareAction: {
    marginTop: 14,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  shareActionText: { color: color.ink, fontWeight: "800", fontSize: 15 },
  passportPrivacy: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 16,
    color: "rgba(255,255,255,0.62)",
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  oceanWrap: {
    marginBottom: 4,
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  ocean: {
    height: 300,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  foamRim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 36,
    backgroundColor: "rgba(232,247,251,0.08)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.15)",
    zIndex: 2,
  },
  waterFill: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
  },
  waveLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 10,
    backgroundColor: "rgba(255,255,255,0.35)",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
  },
  fallingDrop: {
    fontSize: 18,
    zIndex: 3,
  },
  bottleFrame: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 28,
    margin: 10,
    zIndex: 1,
  },
  bottleNeck: {
    position: "absolute",
    top: -18,
    alignSelf: "center",
    left: "42%",
    width: "16%",
    height: 16,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(6,42,58,0.5)",
  },
  oceanContent: {
    padding: 22,
    paddingBottom: 26,
    zIndex: 4,
    alignItems: "center",
  },
  oceanDest: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  oceanCount: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFF",
    marginTop: 8,
    letterSpacing: -0.4,
  },
  oceanHint: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    marginTop: 6,
    textAlign: "center",
  },
});
