import React from 'react';
import { Image, type ImageSourcePropType, StyleSheet, View } from 'react-native';

export type HotelBottleImageProps = {
  /** Pass `PLAY_HOTEL_BOTTLE_ASSET`, `NYX_HOTEL_BOTTLE_ASSET`, or `getHotelBottleAsset(slug)`. */
  source: ImageSourcePropType;
  variant: 'intro' | 'message' | 'gift' | 'featured' | 'alumaHero';
};

/**
 * Reusable bottle hero for hotel guest flows. Sizes keep the bottle secondary to copy.
 * To replace PLAY art later: change `PLAY_HOTEL_BOTTLE_ASSET` in `lib/hotelWhiteLabel.ts` only.
 */
export function HotelBottleImage({ source, variant }: HotelBottleImageProps) {
  return (
    <View
      style={[
        styles.wrap,
        variant === 'intro' && styles.wrapIntro,
        variant === 'message' && styles.wrapMessage,
        variant === 'gift' && styles.wrapGift,
        variant === 'featured' && styles.wrapFeatured,
        variant === 'alumaHero' && styles.wrapAlumaHero,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Image
        source={source}
        style={[
          styles.img,
          variant === 'intro' && styles.imgIntro,
          variant === 'message' && styles.imgMessage,
          variant === 'gift' && styles.imgGift,
          variant === 'featured' && styles.imgFeatured,
          variant === 'alumaHero' && styles.imgAlumaHero,
        ]}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrapIntro: {
    width: '100%',
    maxWidth: 300,
    minHeight: 280,
    maxHeight: 360,
    marginVertical: 8,
  },
  wrapMessage: {
    flexGrow: 1,
    flexShrink: 0,
    minHeight: 240,
    maxHeight: 320,
    width: '100%',
    maxWidth: 200,
    alignSelf: 'center',
  },
  wrapGift: {
    width: '100%',
    maxWidth: 132,
    minHeight: 168,
    maxHeight: 200,
    marginTop: 4,
    marginBottom: 8,
    alignSelf: 'center',
  },
  /** Large right-column hero (e.g. NYX gift reveal) — does not compete with left copy. */
  wrapFeatured: {
    width: '100%',
    maxWidth: 220,
    minHeight: 300,
    maxHeight: 400,
    alignSelf: 'center',
    justifyContent: 'center',
  },
  /** ALUMA flip-card hero — branded bottle is the focal asset (attached art only). */
  wrapAlumaHero: {
    width: '100%',
    maxWidth: 400,
    minHeight: 380,
    maxHeight: 500,
    marginVertical: 10,
    alignSelf: 'center',
    justifyContent: 'center',
  },
  img: {
    width: '100%',
    height: '100%',
  },
  imgIntro: {
    maxHeight: 360,
  },
  imgMessage: {
    opacity: 0.95,
  },
  imgGift: {
    opacity: 0.92,
  },
  imgFeatured: {
    opacity: 0.98,
  },
  imgAlumaHero: {
    opacity: 0.98,
  },
});
