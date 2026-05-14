import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useCallback, useEffect, useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Full-screen submit overlay — bottle video plays **once**, then auto-advances.
 * Native variant. Web uses `BottleSubmitVideo.web.tsx` (static art, time-based advance).
 *
 * Required behavior contract (called sites in bandiTeam/report + localFriend):
 *  1. The video must NEVER loop (`player.loop = false`).
 *  2. When playback reaches the end (`playToEnd`), `onFinished` is invoked exactly once.
 *  3. A 9s hard safety timeout still fires `onFinished` if the player misbehaves.
 *  4. Tapping "Skip" or back-press also calls `onFinished` (still single-fire).
 */

const BOTTLE_SOURCE = require('@/assets/images/local-friend-bottle.mov');

type BottleSubmitVideoProps = {
  visible: boolean;
  onFinished: () => void;
  /** Optional label override for the dismiss/skip control. */
  skipLabel?: string;
};

export function BottleSubmitVideo({ visible, onFinished, skipLabel = 'Skip' }: BottleSubmitVideoProps) {
  const insets = useSafeAreaInsets();
  const doneRef = useRef(false);
  const player = useVideoPlayer(BOTTLE_SOURCE);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onFinished();
  }, [onFinished]);

  useEffect(() => {
    if (!visible) {
      try {
        player.pause();
      } catch {
        /* ignore */
      }
      return;
    }
    doneRef.current = false;
    try {
      player.muted = true;
      player.loop = false;
      if ('currentTime' in player && typeof (player as { currentTime?: number }).currentTime === 'number') {
        (player as { currentTime: number }).currentTime = 0;
      }
      player.play();
    } catch {
      finish();
    }
  }, [visible, player, finish]);

  useEffect(() => {
    if (!visible) return;
    const sub = player.addListener('playToEnd', finish);
    /** Hard safety: ensures the user is never trapped behind a stuck player. */
    const t = setTimeout(finish, 9_000);
    return () => {
      sub.remove();
      clearTimeout(t);
    };
  }, [visible, player, finish]);

  if (!visible) return null;

  return (
    <Modal visible animationType="fade" transparent onRequestClose={finish}>
      <View style={styles.backdrop} accessibilityViewIsModal>
        <VideoView
          player={player}
          style={styles.video}
          nativeControls={false}
          contentFit="contain"
          allowsFullscreen={false}
        />
        <Pressable
          onPress={finish}
          style={[styles.skip, { top: insets.top + 8 }]}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={skipLabel}
        >
          <Text style={styles.skipText}>{skipLabel}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
  },
  video: {
    width: '100%',
    height: '88%',
    backgroundColor: 'transparent',
  },
  skip: {
    position: 'absolute',
    right: 18,
    zIndex: 2,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  skipText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
