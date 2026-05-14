import { Image as ExpoImage } from 'expo-image';
import React, { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

export type BanditProfileHeroVariant = 'listCard' | 'profileDetail' | 'fixedSquare';

type Source = { uri: string } | number;

type Props = {
  variant: BanditProfileHeroVariant;
  source: Source;
  onError?: () => void;
  /** Applied to the clipping viewport (radius, margins). */
  viewportStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** Pixel width/height when `variant` is `fixedSquare` (e.g. 88). */
  squareSize?: number;
};

/** List hero: full card width with face-safe framing on web/mobile. */
const LIST_HERO_MAX_H = 240;
const LIST_HERO_MIN_H = 176;

/** Detail hero: hard cap so wide web viewports never produce a fullscreen portrait. */
const DETAIL_HERO_MAX_H = 400;
const DETAIL_HERO_MIN_H = 232;

/**
 * Shared bandit portrait / profile hero for list cards and open profile.
 * List cards use `contain` + top bias to keep faces visible without harsh crops.
 */
export default function BanditProfileHeroMedia({
  variant,
  source,
  onError,
  viewportStyle,
  accessibilityLabel,
  squareSize = 88,
}: Props) {
  const { width: winW } = useWindowDimensions();

  const boxHeight = useMemo(() => {
    if (variant === 'fixedSquare') {
      return squareSize;
    }
    if (variant === 'listCard') {
      return Math.min(LIST_HERO_MAX_H, Math.max(LIST_HERO_MIN_H, Math.round(winW * 0.56)));
    }
    const base = Math.round(Math.min(winW, 720) * 0.5);
    return Math.min(DETAIL_HERO_MAX_H, Math.max(DETAIL_HERO_MIN_H, base));
  }, [variant, winW, squareSize]);

  const contentPosition =
    variant === 'fixedSquare' ? 'center' : variant === 'listCard' ? 'top' : 'center';
  const contentFit =
    variant === 'fixedSquare' ? 'cover' : variant === 'listCard' ? 'contain' : 'cover';

  const outerStyle = useMemo((): StyleProp<ViewStyle> => {
    if (variant === 'fixedSquare') {
      return [
        {
          width: squareSize,
          height: squareSize,
          borderRadius: squareSize / 2,
          overflow: 'hidden',
          backgroundColor: '#E8EAED',
        },
        viewportStyle,
      ];
    }
    return [styles.viewport, { height: boxHeight }, viewportStyle];
  }, [variant, squareSize, boxHeight, viewportStyle]);

  return (
    <View style={outerStyle}>
      <ExpoImage
        source={source}
        style={styles.imageFill}
        contentFit={contentFit}
        contentPosition={contentPosition}
        cachePolicy="memory-disk"
        allowDownscaling
        onError={onError}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="image"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    width: '100%',
    alignSelf: 'stretch',
    overflow: 'hidden',
    backgroundColor: '#E8EAED',
  },
  imageFill: {
    width: '100%',
    height: '100%',
  },
});
