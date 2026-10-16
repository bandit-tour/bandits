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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppBackScreenOptions } from "@/hooks/useAppBackScreenOptions";
import { color } from "@/lib/guestDesign";
import { IMPACT_STORY } from "@/lib/guest-workspace/impactStory";

/** Impact — bandiTour brand chrome; water blue only inside the drop meter. */
export function ImpactScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const screenOptions = useAppBackScreenOptions({
    title: "Impact / Passport",
    fallback: "/menu",
    showBack: true,
    escapeShortcuts: true,
  });
  const [joined, setJoined] = useState<string | null>(null);
  const fillRatio = IMPACT_STORY.dropsEarned / IMPACT_STORY.dropsRequired;
  const oceanMax = Math.min(width - 32, 960);

  const onShare = async () => {
    try {
      await Share.share({ message: IMPACT_STORY.shareLine });
    } catch {
      /* user dismissed */
    }
  };

  return (
    <>
      <Stack.Screen options={screenOptions} />
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: 12 }]}
      showsVerticalScrollIndicator
    >
      <Text style={styles.title}>{IMPACT_STORY.title}</Text>
      <Text style={styles.subtitle}>{IMPACT_STORY.subtitle}</Text>
      <Text style={styles.supporting}>{IMPACT_STORY.supporting}</Text>

      <Text style={styles.intro}>{IMPACT_STORY.intro}</Text>

      <WaterDropOcean fillRatio={fillRatio} maxWidth={oceanMax} />

      {/* What you left behind — prominent under Your Impact / meter */}
      <Text style={styles.sectionTitle}>What you left behind</Text>
      <Text style={styles.sectionLead}>{IMPACT_STORY.leftBehindLead}</Text>
      <View style={styles.leftBehindList}>
        {IMPACT_STORY.leftBehind.map((item, index) => (
          <View
            key={item.id}
            style={[
              styles.leftBehindRow,
              index === IMPACT_STORY.leftBehind.length - 1 && styles.leftBehindRowLast,
            ]}
          >
            <Text style={styles.leftBehindEmoji}>{item.emoji}</Text>
            <Text style={styles.leftBehindText}>
              <Text style={styles.leftBehindValue}>{item.value}</Text>
              {"  "}
              {item.label}
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Where your drops come from</Text>
      <Text style={styles.sectionLead}>Each local action earned Water Drops for Athens.</Text>
      <View style={styles.sourceGrid}>
        {IMPACT_STORY.dropSources.map((s) => (
          <Pressable key={s.id} style={({ pressed }) => [styles.sourceCard, pressed && styles.pressed]}>
            <Text style={styles.sourceEmoji}>{s.emoji}</Text>
            <Text style={styles.sourceLabel}>{s.label}</Text>
            <Text style={styles.sourceDrops}>💧 +{s.drops}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.compareBlock}>
        {IMPACT_STORY.comparisons.map((c) => (
          <View key={c.id} style={styles.compareCard}>
            <Text style={styles.compareLine}>{c.line}</Text>
          </View>
        ))}
      </View>

      {/* Compact share — not a blue banner */}
      <Pressable style={({ pressed }) => [styles.shareCard, pressed && styles.pressed]} onPress={onShare}>
        <Text style={styles.shareTitle}>Share your Athens footprint</Text>
        <Text style={styles.shareSub}>Proud of what you left behind? Share your journey.</Text>
        <View style={styles.shareAction}>
          <Text style={styles.shareActionText}>Share</Text>
        </View>
      </Pressable>

      <Text style={styles.sectionTitle}>Keep giving · local causes</Text>
      {IMPACT_STORY.causes.map((c) => (
        <Pressable
          key={c.id}
          style={({ pressed }) => [styles.causeCard, pressed && styles.pressed]}
          onPress={() => setJoined(c.id)}
        >
          <Text style={styles.causeFamily}>{c.family}</Text>
          <Text style={styles.causeTitle}>{c.name}</Text>
          <Text style={styles.causeBody}>{c.guestDescription}</Text>
          <Text style={styles.causeOrg}>{c.organizationName}</Text>
          <View style={styles.causeCta}>
            <Text style={styles.causeCtaText}>{joined === c.id ? "Supporting ✓" : "Support this cause"}</Text>
          </View>
        </Pressable>
      ))}

      <Text style={styles.sectionTitle}>Impact Passport</Text>
      {IMPACT_STORY.passportEntries.map((p) => (
        <Pressable key={p.id} style={({ pressed }) => [styles.passport, pressed && styles.pressed]} onPress={onShare}>
          <Text style={styles.passportDest}>{p.destination}</Text>
          <Text style={styles.passportCause}>{p.causeName}</Text>
          <Text style={styles.passportShare}>{p.shareLine}</Text>
          <Text style={styles.passportDate}>{p.date}</Text>
        </Pressable>
      ))}

      <Text style={styles.sectionTitle}>Volunteer while here</Text>
      {IMPACT_STORY.volunteer.map((v) => (
        <Pressable key={v.id} style={({ pressed }) => [styles.volunteerRow, pressed && styles.pressed]}>
          <View style={styles.volunteerCopy}>
            <Text style={styles.volunteerTitle}>{v.title}</Text>
            <Text style={styles.volunteerWhen}>{v.when}</Text>
          </View>
          <Text style={styles.volunteerDrops}>💧 +{v.drops}</Text>
        </Pressable>
      ))}

      <View style={styles.reward}>
        <Text style={styles.rewardTitle}>Ocean almost full</Text>
        <Text style={styles.rewardBody}>{IMPACT_STORY.badgeUnlockCopy(IMPACT_STORY.remainingDrops)}</Text>
      </View>
    </ScrollView>
    </>
  );
}

/** Living water-drop meter — blue only here, capped width, not a full-bleed slab. */
function WaterDropOcean({ fillRatio, maxWidth }: { fillRatio: number; maxWidth: number }) {
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
      d3.stop();
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
          <Text style={styles.oceanDest}>{IMPACT_STORY.destination}</Text>
          <Text style={styles.oceanCount}>
            {IMPACT_STORY.dropsEarned} / {IMPACT_STORY.dropsRequired} Drops
          </Text>
          <Text style={styles.oceanHint}>Your ocean is filling</Text>
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
  shadowOpacity: 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.surfaceWarm },
  content: { paddingHorizontal: 18, paddingBottom: 96 },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: color.ink,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "600",
    color: color.inkSoft,
    marginTop: 6,
    lineHeight: 22,
  },
  supporting: {
    fontSize: 14,
    color: color.muted,
    marginTop: 4,
    lineHeight: 20,
  },
  intro: {
    fontSize: 14,
    color: color.inkSoft,
    lineHeight: 21,
    marginTop: 14,
    marginBottom: 16,
  },

  oceanWrap: {
    marginBottom: 22,
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
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: color.ink,
    marginTop: 8,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  sectionLead: {
    fontSize: 13,
    color: color.muted,
    marginBottom: 12,
    lineHeight: 18,
  },

  sourceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 10,
  },
  sourceCard: {
    width: "47.5%",
    backgroundColor: color.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  sourceEmoji: { fontSize: 22, marginBottom: 6 },
  sourceLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: color.ink,
    lineHeight: 17,
    minHeight: 34,
  },
  sourceDrops: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "800",
    color: color.waterMid,
  },

  leftBehindList: {
    backgroundColor: color.surface,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: color.hairline,
    ...PlatformShadow,
  },
  leftBehindRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.hairline,
  },
  leftBehindRowLast: { borderBottomWidth: 0 },
  leftBehindEmoji: { fontSize: 20, width: 32 },
  leftBehindText: { flex: 1, fontSize: 15, color: color.inkSoft, lineHeight: 20 },
  leftBehindValue: { fontWeight: "800", color: color.ink },

  compareBlock: { gap: 10, marginBottom: 16 },
  compareCard: {
    backgroundColor: color.charcoal,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  compareLine: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FAF9F7",
    lineHeight: 22,
  },

  shareCard: {
    backgroundColor: color.surface,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: color.hairline,
    borderLeftWidth: 3,
    borderLeftColor: color.brand,
  },
  shareTitle: { fontSize: 16, fontWeight: "800", color: color.ink },
  shareSub: { fontSize: 13, color: color.muted, marginTop: 6, lineHeight: 18 },
  shareAction: {
    marginTop: 14,
    alignSelf: "flex-start",
    backgroundColor: color.brand,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  shareActionText: { color: "#FFF", fontWeight: "800", fontSize: 13 },

  causeCard: {
    backgroundColor: color.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  causeFamily: {
    fontSize: 11,
    fontWeight: "700",
    color: color.brand,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  causeTitle: { fontSize: 16, fontWeight: "800", color: color.ink, marginTop: 4 },
  causeBody: { fontSize: 13, color: color.inkSoft, marginTop: 8, lineHeight: 18 },
  causeOrg: { fontSize: 12, fontWeight: "600", color: color.muted, marginTop: 8 },
  causeCta: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: color.charcoal,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  causeCtaText: { color: "#FFF", fontWeight: "800", fontSize: 13 },

  passport: {
    backgroundColor: color.charcoal,
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
  },
  passportDest: { fontSize: 12, fontWeight: "700", color: color.brand, letterSpacing: 0.8 },
  passportCause: { fontSize: 16, fontWeight: "800", color: "#FFF", marginTop: 4 },
  passportShare: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 8, lineHeight: 18 },
  passportDate: { fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 8 },

  volunteerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: color.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  volunteerCopy: { flex: 1, paddingRight: 10 },
  volunteerTitle: { fontSize: 14, fontWeight: "700", color: color.ink },
  volunteerWhen: { fontSize: 12, color: color.muted, marginTop: 2 },
  volunteerDrops: { fontSize: 14, fontWeight: "800", color: color.waterMid },

  reward: {
    marginTop: 8,
    backgroundColor: color.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  rewardTitle: { fontSize: 15, fontWeight: "800", color: color.ink },
  rewardBody: { fontSize: 13, color: color.inkSoft, marginTop: 6, lineHeight: 18 },

  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
});
