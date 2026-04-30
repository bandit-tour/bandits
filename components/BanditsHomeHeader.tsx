import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { getHotelWhiteLabelOrDefault, type HotelSlug } from '@/lib/hotelWhiteLabel';

const BANNER_BODY =
  'Trusted traveler alerts for PLAY guests.\n\nReport scams, fake taxis, tourist traps and unsafe situations.\n\nStay safe. Protect the holiday together.';

const bandiStyles = StyleSheet.create({
  /** Sticky below upper tabs: stays visible when the list below scrolls. */
  stack: {
    marginHorizontal: -16,
    marginBottom: 8,
    width: '100%' as const,
    zIndex: 24,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
      android: { elevation: 6 },
      default: {},
      web: { position: 'sticky' as any, top: 0, boxShadow: '0 2px 10px rgba(0,0,0,0.32)' },
    }),
  },
  banditsBar: {
    width: '100%',
    backgroundColor: '#0A0908',
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 106, 0.55)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(200, 175, 120, 0.28)',
    paddingVertical: 11,
    paddingLeft: 12,
    paddingRight: 8,
    minHeight: 82,
  },
  banditsBarInner: {
    position: 'relative' as const,
    width: '100%',
    minHeight: 62,
    justifyContent: 'center' as const,
  },
  centerBlock: {
    paddingHorizontal: 64,
    alignItems: 'center' as const,
  },
  playBandiTourMark: {
    fontSize: 15,
    fontWeight: '800',
    color: 'rgba(240, 215, 160, 0.98)',
    letterSpacing: 1.2,
    textAlign: 'center',
    marginBottom: 6,
  },
  banditsTag: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(250, 245, 236, 0.9)',
    textAlign: 'center',
    letterSpacing: 0.15,
    lineHeight: 15,
    maxWidth: 320,
  },
  ctaSide: {
    position: 'absolute' as const,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center' as const,
    paddingLeft: 8,
    paddingRight: 2,
  },
  ctaText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: '#C9A66A',
  },
  ctaTextPressed: {
    opacity: 0.8,
  },
  pressedOverlay: {
    opacity: 0.94,
  },
  hairline: {
    position: 'absolute' as const,
    bottom: 0,
    left: '12%' as any,
    right: '12%' as any,
    height: 1,
    backgroundColor: 'rgba(200, 175, 120, 0.15)',
  },
  loadingText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(248, 244, 238, 0.65)',
    marginTop: 4,
  },
});

type Props = {
  hotelSlug: HotelSlug | string | null;
  loadingContext: boolean;
};

const HOME_HERO_BRAND = 'PLAY × bandiTour';

/**
 * Premium home strip (PLAY × bandiTour) — tappable, opens community hub; hotel used for loading copy only.
 */
export default function BanditsHomeHeader({ hotelSlug, loadingContext }: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const slug = (hotelSlug || 'play-theatrou') as string;
  const hotel = getHotelWhiteLabelOrDefault(slug);

  const goHub = useCallback(() => {
    router.push('/bandiTeam' as never);
  }, [router]);

  const isCompact = width < 360;

  if (loadingContext) {
    return (
      <View testID="bandits-home-hero" style={[{ width }, bandiStyles.stack]}>
        <Pressable
          onPress={goHub}
          accessibilityLabel="Open community hub, PLAY and bandiTour"
          accessibilityRole="link"
          style={({ pressed }) => [bandiStyles.banditsBar, pressed && bandiStyles.pressedOverlay]}
        >
          <View style={bandiStyles.banditsBarInner}>
            <View
              style={[
                bandiStyles.centerBlock,
                isCompact && { paddingHorizontal: 52 },
              ]}
            >
              <Text style={bandiStyles.playBandiTourMark} numberOfLines={1}>
                {HOME_HERO_BRAND}
              </Text>
              <ActivityIndicator size="small" color="#C9A66A" style={{ marginVertical: 6 }} />
              <Text style={bandiStyles.loadingText} numberOfLines={1}>
                {`Preparing ${hotel.displayName}…`}
              </Text>
            </View>
            <View style={bandiStyles.ctaSide} pointerEvents="none">
              <Text style={bandiStyles.ctaText}>ENTER →</Text>
            </View>
          </View>
          <View style={bandiStyles.hairline} pointerEvents="none" />
        </Pressable>
      </View>
    );
  }

  return (
    <View testID="bandits-home-hero" style={[{ width }, bandiStyles.stack]}>
      <Pressable
        testID="bandits-bandits-banner"
        onPress={goHub}
        accessibilityLabel="PLAY and bandiTour traveler alerts — open community hub"
        accessibilityRole="link"
        style={({ pressed }) => [bandiStyles.banditsBar, pressed && bandiStyles.pressedOverlay]}
        hitSlop={4}
      >
        <View style={bandiStyles.banditsBarInner}>
          <View style={[bandiStyles.centerBlock, isCompact && { paddingHorizontal: 50 }]}>
            <Text style={bandiStyles.playBandiTourMark} numberOfLines={1}>
              {HOME_HERO_BRAND}
            </Text>
            <Text
              style={[bandiStyles.banditsTag, isCompact && { fontSize: 10, lineHeight: 14, maxWidth: 248 }]}
              numberOfLines={6}
            >
              {BANNER_BODY}
            </Text>
          </View>
          <View style={bandiStyles.ctaSide} pointerEvents="none">
            <Text style={bandiStyles.ctaText}>ENTER →</Text>
          </View>
        </View>
        <View style={bandiStyles.hairline} pointerEvents="none" />
      </Pressable>
    </View>
  );
}
