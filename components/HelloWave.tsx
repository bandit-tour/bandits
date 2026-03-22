import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/ThemedText';

export function HelloWave() {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(rotation, { toValue: 25, duration: 150, useNativeDriver: true }),
        Animated.timing(rotation, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]),
      { iterations: 4 },
    );
    loop.start();
    return () => loop.stop();
  }, [rotation]);

  return (
    <Animated.View style={{ transform: [{ rotate: rotation.interpolate({ inputRange: [0, 25], outputRange: ['0deg', '25deg'] }) }] }}>
      <ThemedText style={styles.text}>👋</ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 28,
    lineHeight: 32,
    marginTop: -6,
  },
});
