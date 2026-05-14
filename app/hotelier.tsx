import { PLAY_THEATROU_GUEST_ENTRY_URL } from '@/lib/pilotSession';
import { Image as ExpoImage } from 'expo-image';
import { Stack } from 'expo-router';
import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppBackScreenOptions } from '@/hooks/useAppBackScreenOptions';

/** Full uncropped property art — same 375×380 source used for PLAY Athenian hero; `contain` shows all branding. */
const HOTELIER_BANNER = require('@/assets/images/play_athens_bg.png');

/** Viewport for `contain` — wide enough to fit the full square; no `cover` crop. */
const BANNER_VIEWPORT_H = 200;

function HotelierScreen() {
  const insets = useSafeAreaInsets();
  const screenOptions = useAppBackScreenOptions({
    title: 'Hotelier',
    fallback: '/menu',
  });
  const { width: winW } = useWindowDimensions();
  const pad = 20;
  const maxRow = winW - pad * 2;
  const isDesktopWeb = Platform.OS === 'web' && winW >= 1100;
  const bannerW = Math.min(isDesktopWeb ? 560 : 400, maxRow);

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.topGrid, isDesktopWeb && styles.topGridDesktop]}>
          <View style={[styles.bannerCard, { width: bannerW }]}>
            <ExpoImage
              source={HOTELIER_BANNER}
              style={{ width: bannerW, height: isDesktopWeb ? 280 : BANNER_VIEWPORT_H }}
              contentFit="contain"
              contentPosition="center"
              cachePolicy="memory-disk"
              allowDownscaling
              accessibilityLabel="PLAY Theatrou Athens"
            />
          </View>
          <View style={styles.topCopy}>
            <View style={styles.kickerPill}>
              <Text style={styles.kickerText}>Pilot Partner Showcase</Text>
            </View>
            <Text style={styles.partnerLine}>PLAY Theatrou Athens – Curated Guest City Layer</Text>
            <Text style={styles.bodyLead}>Turn each stay into a signature local experience.</Text>
            <Text style={styles.body}>
              This page showcases the active pilot partner inside bandiTour.
              {'\n'}
              {'\n'}
              PLAY Theatrou Athens is currently our featured hospitality partner.
            </Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>Pilot partner profile</Text>
              <Text style={styles.infoLine}>Hotel: PLAY Theatrou Athens</Text>
              <Text style={styles.infoLine}>Group: Israel Canada</Text>
              <Text style={styles.infoLine}>City: Athens</Text>
              <Text style={styles.infoLine}>Program: PLAY x bandiTour guest city access</Text>
            </View>
          </View>
        </View>

        <View style={styles.guestEntryCard}>
          <Text style={styles.guestEntryTitle}>Official guest entry (QR, email, Wi‑Fi)</Text>
          <Text style={styles.guestEntryBody}>
            Use this single link for all PLAY Theatrou guests. It opens the in-browser guest experience (PWA) — no app
            store redirect, no download prompt, no login required.
          </Text>
          <Text style={styles.guestEntryUrl} selectable>
            {PLAY_THEATROU_GUEST_ENTRY_URL}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>What PLAY guests receive:</Text>
        <Text style={styles.bullet}>- curated routes and places by local insiders</Text>
        <Text style={styles.bullet}>- category-aware discovery (food, culture, nightlife, shopping)</Text>
        <Text style={styles.bullet}>- premium arrival journey from welcome screen to city guide</Text>

        <Text style={styles.sectionTitle}>What this pilot validates:</Text>
        <Text style={styles.bullet}>- hotel-branded onboarding experience</Text>
        <Text style={styles.bullet}>- local discovery engagement from real guests</Text>
        <Text style={styles.bullet}>- scalable model for future multi-hotel dashboards</Text>

        <Text style={styles.footerNote}>
          Note: During pilot phase this screen is informational and partner-facing only.
          Multi-hotel dashboards and tooling will be enabled in the next rollout stage.
        </Text>
      </ScrollView>
    </>
  );
}

export default function HotelierRoute() {
  return <HotelierScreen />;
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#FAFAF8' },
  content: { paddingHorizontal: 20, paddingTop: 12, width: '100%', maxWidth: 1240, alignSelf: 'center' },
  topGrid: {
    width: '100%',
  },
  topGridDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 20,
  },
  topCopy: {
    flex: 1,
    minWidth: 280,
  },
  bannerCard: {
    maxWidth: 400,
    alignSelf: 'center',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0E0C0A',
    marginBottom: 20,
  },
  kickerPill: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F1F6FB',
    marginBottom: 10,
  },
  kickerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#29435C',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  partnerLine: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
    marginBottom: 10,
    lineHeight: 24,
  },
  body: {
    fontSize: 14,
    color: '#444',
    lineHeight: 21,
    marginBottom: 14,
  },
  bodyLead: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#222',
    marginTop: 4,
    marginBottom: 6,
  },
  bullet: {
    fontSize: 14,
    color: '#444',
    lineHeight: 21,
    marginBottom: 2,
  },
  guestEntryCard: {
    marginTop: 8,
    marginBottom: 20,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#F4F6F8',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E6EB',
  },
  guestEntryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111',
    marginBottom: 8,
  },
  guestEntryBody: {
    fontSize: 13,
    color: '#444',
    lineHeight: 19,
    marginBottom: 12,
  },
  guestEntryUrl: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0a5c8a',
    lineHeight: 20,
  },
  infoCard: {
    marginBottom: 16,
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#F7F9FC',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DCE3EC',
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1F2D3D',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  infoLine: {
    fontSize: 14,
    color: '#2E3D4E',
    lineHeight: 20,
    marginBottom: 3,
  },
  footerNote: {
    marginTop: 16,
    fontSize: 13,
    color: '#5A6573',
    lineHeight: 20,
  },
});
