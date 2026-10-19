import { BOTTLE_INTRO_WEB_URI } from '@/lib/openingIntroAssets';
import React, { useCallback, useEffect, useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * Web variant of the opening-intro bottle clip.
 * Same master as native `assets/images/local-friend-bottle.mov` (stream-copied MP4).
 * Plays once, contain, original aspect. Does not use the PLAY / octopus intro.
 * Falls back to timed advance if the video cannot play — never invents a new asset.
 */

const WEB_ADVANCE_MS = 9_000;
const BOTTLE_MP4 = BOTTLE_INTRO_WEB_URI;

type BottleSubmitVideoProps = {
  visible: boolean;
  onFinished: () => void;
  skipLabel?: string;
};

export function BottleSubmitVideo({ visible, onFinished, skipLabel = 'Skip' }: BottleSubmitVideoProps) {
  const doneRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onFinished();
  }, [onFinished]);

  useEffect(() => {
    if (!visible) {
      doneRef.current = false;
      const el = videoRef.current;
      if (el) {
        try {
          el.pause();
          el.currentTime = 0;
        } catch {
          /* ignore */
        }
      }
      return;
    }
    doneRef.current = false;
    const el = videoRef.current;
    if (el) {
      try {
        el.muted = true;
        el.loop = false;
        el.currentTime = 0;
        void el.play().catch(() => {
          /* autoplay blocked — safety timer still advances */
        });
      } catch {
        /* ignore */
      }
    }
    const t = setTimeout(finish, WEB_ADVANCE_MS);
    return () => clearTimeout(t);
  }, [visible, finish]);

  if (!visible) return null;

  return (
    <Modal visible animationType="fade" transparent onRequestClose={finish}>
      <View style={styles.backdrop} accessibilityViewIsModal>
        {/* RN-web: native <video> for the approved bottle throw clip */}
        {React.createElement('video', {
          ref: (node: HTMLVideoElement | null) => {
            videoRef.current = node;
          },
          src: BOTTLE_MP4,
          style: {
            width: '100%',
            height: '88%',
            objectFit: 'contain',
            backgroundColor: 'transparent',
          },
          muted: true,
          playsInline: true,
          controls: false,
          onEnded: finish,
          'aria-label': 'Message in a bottle animation',
        })}
        <Pressable
          onPress={finish}
          style={styles.skip}
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
    alignItems: 'center',
  },
  skip: {
    position: 'absolute',
    right: 18,
    top: 18,
    zIndex: 2,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  skipText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
