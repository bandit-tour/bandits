import { Image as ExpoImage, type ImageContentFit } from 'expo-image';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  ImageRatio,
  imageFocusStyle,
  type ImageFocus,
  type ImageRatioKey,
} from '@/lib/imageRatios';
import { color, radius } from '@/lib/guestDesign';

type Props = {
  uri: string;
  /** Locked ratio key — default portrait 4:5 */
  ratio?: ImageRatioKey | number;
  focus?: ImageFocus;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
  contentFit?: ImageContentFit;
  onPress?: () => void;
  /** Called when the remote image fails — parents should unmount the listing. */
  onError?: () => void;
  children?: React.ReactNode;
  priority?: 'low' | 'normal' | 'high';
};

/**
 * Cover image locked to a legal guest-app ratio.
 * Never renders a shallow strip — width fills parent; height follows aspectRatio.
 * On load failure: fires onError and renders nothing (no blank placeholder card).
 */
export function RatioImage({
  uri,
  ratio = 'portrait',
  focus = 'center-top',
  style,
  borderRadius = radius.xl,
  contentFit = 'cover',
  onPress,
  onError,
  children,
  priority = 'normal',
}: Props) {
  const [failed, setFailed] = useState(false);
  const aspect = typeof ratio === 'number' ? ratio : ImageRatio[ratio];

  if (!uri?.trim() || failed) {
    return null;
  }

  const frame = (
    <View style={[styles.frame, { aspectRatio: aspect, borderRadius }, style]}>
      <ExpoImage
        source={{ uri }}
        style={[StyleSheet.absoluteFillObject, imageFocusStyle(focus)]}
        contentFit={contentFit}
        transition={160}
        priority={priority}
        onError={() => {
          setFailed(true);
          onError?.();
        }}
      />
      {children}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button">
        {frame}
      </Pressable>
    );
  }
  return frame;
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: color.imageFallback,
  },
});
