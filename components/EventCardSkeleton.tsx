import React, { memo, useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, ViewStyle } from 'react-native';

/**
 * Lightweight skeleton replacement for `EventCard` shown while a list is
 * loading. Renders a card-shaped silhouette that pulses gently so the user
 * sees structure (and doesn't perceive a blank screen) before real data
 * arrives.
 *
 * Design notes:
 * - Matches the dimensions of the real card (4:3 hero, three text lines) so
 *   the layout doesn't jump when the real card replaces it.
 * - Uses `react-native`'s `Animated` with `useNativeDriver: true` so the
 *   pulse runs on the UI thread (no JS work, no jank).
 * - Pure presentational + `React.memo`; can be reused in every list screen.
 */
function EventCardSkeletonImpl({ style }: { style?: ViewStyle }) {
  const pulse = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulse, {
          toValue: 0.6,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={[styles.card, style]}>
      <Animated.View style={[styles.hero, { opacity: pulse }]} />
      <View style={styles.body}>
        <Animated.View style={[styles.lineTitle, { opacity: pulse }]} />
        <Animated.View style={[styles.lineGenre, { opacity: pulse }]} />
        <Animated.View style={[styles.lineText, { opacity: pulse }]} />
        <Animated.View style={[styles.lineTextShort, { opacity: pulse }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    overflow: 'hidden',
    marginBottom: 12,
    paddingBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 1,
    width: '100%',
  },
  hero: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#ECECEC',
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },
  body: {
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  lineTitle: {
    height: 16,
    width: '70%',
    backgroundColor: '#ECECEC',
    borderRadius: 4,
    marginBottom: 8,
  },
  lineGenre: {
    height: 12,
    width: '30%',
    backgroundColor: '#ECECEC',
    borderRadius: 4,
    marginBottom: 8,
  },
  lineText: {
    height: 12,
    width: '95%',
    backgroundColor: '#ECECEC',
    borderRadius: 4,
    marginBottom: 6,
  },
  lineTextShort: {
    height: 12,
    width: '60%',
    backgroundColor: '#ECECEC',
    borderRadius: 4,
  },
});

const EventCardSkeleton = memo(EventCardSkeletonImpl);
export default EventCardSkeleton;
