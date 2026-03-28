import React from 'react';
import { Image, ImageStyle, StyleProp, StyleSheet } from 'react-native';

/** Inline Local Bandit mark — `assets/icons/octopus.jpeg` (fixed size; shared with BanditHeader). */
export default function LocalBanditOctopusIcon({ style }: { style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      source={require('@/assets/icons/octopus.jpeg')}
      style={[styles.octopus, style]}
      resizeMode="cover"
    />
  );
}

const styles = StyleSheet.create({
  octopus: {
    width: 24,
    height: 24,
    borderRadius: 4,
    marginRight: 6,
  },
});
