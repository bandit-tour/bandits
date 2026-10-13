import { router } from 'expo-router';
import React from 'react';
import { Image, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

/**
 * Top-right territory / map control on every Local banDit card.
 *
 * Communicates: this person belongs to / knows this local area.
 * Sized to be clearly readable — elegant and secondary to the portrait,
 * never a tiny decorative icon.
 *
 * Opens `/cityMap?banditId=` for this banDit's curated pins.
 */

const DESKTOP_BREAK = 900;

/** ~1.75× prior 44/48 chip — recognizable territory mark. */
const SIZE = { desktop: 84, mobile: 76 } as const;
const ICON = { desktop: 46, mobile: 42 } as const;

export default function BanditMiniMapPreview({ banditId }: { banditId: string }) {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= DESKTOP_BREAK;
  const size = isDesktop ? SIZE.desktop : SIZE.mobile;
  const iconSize = isDesktop ? ICON.desktop : ICON.mobile;
  const radius = isDesktop ? 18 : 16;

  const openFullMap = () => {
    router.push(`/cityMap?banditId=${encodeURIComponent(banditId)}` as any);
  };

  return (
    <Pressable
      onPress={openFullMap}
      style={({ pressed, hovered }: any) => [
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: radius,
        },
        (pressed || hovered) && styles.wrapHover,
      ]}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel="Open this banDit's local map"
    >
      <View style={[styles.inner, { borderRadius: radius - 2 }]}>
        <Image
          source={require('@/assets/icons/google-maps-512.png')}
          style={{ width: iconSize, height: iconSize }}
          resizeMode="contain"
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#FAF9F7',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.98)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
        cursor: 'pointer',
        transition: 'transform 140ms ease, box-shadow 140ms ease',
      } as any,
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.22,
        shadowOffset: { width: 0, height: 3 },
        shadowRadius: 8,
      },
      android: { elevation: 7 },
      default: {},
    }),
  },
  wrapHover: {
    transform: [{ scale: 1.04 }],
    ...Platform.select({
      web: {
        boxShadow: '0 8px 22px rgba(0,0,0,0.28)',
      } as any,
      default: {
        shadowOpacity: 0.3,
        elevation: 9,
      },
    }),
  },
  inner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
});
