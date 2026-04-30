import { PLAY_HOTEL_BOTTLE_ASSET } from '@/lib/hotelWhiteLabel';
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

type LocalFriendBottleHeroProps = {
  height?: number;
};

/**
 * Web: expo-video / useVideoPlayer can throw or break hydration; use static bottle art (same asset as home hero).
 */
export function LocalFriendBottleHero({ height = 280 }: LocalFriendBottleHeroProps) {
  return (
    <View style={[styles.wrap, { height }]} accessibilityLabel="Message in a bottle">
      <Image source={PLAY_HOTEL_BOTTLE_ASSET} style={styles.img} resizeMode="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#0B0F18',
  },
  img: {
    width: '100%',
    height: '100%',
  },
});
