import { ensureAnonymousSession, syncPilotHotelProfileIfNeeded } from '@/lib/pilotSession';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Stack, router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const INTRO_SOURCE =
  Platform.OS === 'web'
    ? { uri: '/videos/play-intro.mp4' }
    : require('@/assets/videos/play-intro.mp4');

export default function PlayIntroScreen() {
  const insets = useSafeAreaInsets();
  const overlay = useRef(new Animated.Value(1)).current;
  const isNavigating = useRef(false);
  const player = useVideoPlayer(INTRO_SOURCE);

  useEffect(() => {
    try {
      player.muted = true;
      player.loop = false;
      player.play();
    } catch {
      navigateHomeWithFade();
    }
  }, [player]);

  useEffect(() => {
    Animated.timing(overlay, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [overlay]);

  const navigateHomeWithFade = () => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    Animated.timing(overlay, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start(async () => {
      await ensureAnonymousSession();
      await syncPilotHotelProfileIfNeeded();
      router.replace('/bandits');
    });
  };

  useEffect(() => {
    const sub = player.addListener('playToEnd', navigateHomeWithFade);
    return () => {
      sub.remove();
    };
  }, [player]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false, animation: 'fade' }} />
      <View style={styles.container}>
        <VideoView
          player={player}
          style={styles.video}
          nativeControls={false}
          contentFit="contain"
          allowsFullscreen={false}
          allowsPictureInPicture={false}
        />
        <Pressable
          onPress={navigateHomeWithFade}
          style={[styles.skipButton, { top: insets.top + 10 }]}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Skip intro video"
        >
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
        <Animated.View pointerEvents="none" style={[styles.fadeOverlay, { opacity: overlay }]} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  skipButton: {
    position: 'absolute',
    right: 18,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    zIndex: 3,
  },
  skipText: {
    color: '#fff',
    fontSize: 13,
    letterSpacing: 0.3,
    fontWeight: '700',
  },
  fadeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 5,
  },
});
