import { BOTTLE_VIDEO } from '@/lib/openingIntroAssets';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Native Travel in a Bottle mix loading — reuses opening-intro `.mov`.
 * Web uses `TravelBottleMixLoading.web.tsx` (play-intro.mp4).
 */

const OVERLAY_LINES = [
  'Your next escape is taking shape...',
  'Mixing your perfect stays...',
] as const;

type Props = {
  visible: boolean;
  statusHint?: string;
};

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (alive) setReduce(!!v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
      setReduce(!!v);
    });
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduce;
}

export function TravelBottleMixLoading({ visible, statusHint }: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const player = useVideoPlayer(BOTTLE_VIDEO, (p) => {
    p.loop = true;
    p.muted = true;
  });
  const line = useMemo(() => {
    const i = Math.floor(Date.now() / 4000) % OVERLAY_LINES.length;
    return OVERLAY_LINES[i]!;
  }, [visible]);

  useEffect(() => {
    try {
      player.loop = true;
      player.muted = true;
      if (visible && !reduceMotion) player.play();
      else player.pause();
    } catch {
      /* ignore */
    }
  }, [visible, reduceMotion, player]);

  if (!visible) return null;

  const a11yLabel =
    statusHint ||
    'Mixing hotel and nature stays. Please wait while Travel in a Bottle searches Workspace.';

  return (
    <Modal visible animationType="fade" transparent onRequestClose={() => undefined}>
      <View
        style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}
        accessibilityViewIsModal
        accessibilityRole="progressbar"
        accessibilityLabel={a11yLabel}
        testID="travel-bottle-mix-loading"
      >
        <View style={styles.stage}>
          {reduceMotion ? (
            <View style={styles.neutral} testID="travel-bottle-mix-reduced">
              <ActivityIndicator color="#EED8B4" />
              <Text style={styles.reducedHint}>Searching sleeping stays…</Text>
            </View>
          ) : (
            <VideoView
              player={player}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              nativeControls={false}
            />
          )}
          <View style={styles.scrim} pointerEvents="none" />
          <View style={styles.copyBlock} pointerEvents="none">
            <Text style={styles.kicker}>Travel in a Bottle</Text>
            <Text style={styles.line}>{line}</Text>
            {null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(8, 7, 6, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  stage: {
    width: '100%',
    maxWidth: 420,
    aspectRatio: 9 / 14,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#0A0908',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(238, 216, 180, 0.35)',
  },
  neutral: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#141210',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 7, 6, 0.42)',
  },
  copyBlock: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 28,
  },
  kicker: {
    color: '#EED8B4',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  line: {
    color: '#FFFDF8',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  reducedHint: {
    marginTop: 10,
    color: 'rgba(255,253,248,0.75)',
    fontSize: 14,
    fontWeight: '600',
  },
});
