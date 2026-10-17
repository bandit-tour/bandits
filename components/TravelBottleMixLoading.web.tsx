import { BOTTLE_VIDEO_WEB_URI } from '@/lib/openingIntroAssets';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Web Travel in a Bottle mix loading.
 * Plays `/videos/play-intro.mp4` only while Mix search is pending.
 * NOTE: as of asset audit 17 Oct 2026 that file is PLAY branding, not ocean throw —
 * replace the file bytes when the owner supplies the original sea clip (same path).
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
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduce(!!mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);
  return reduce;
}

export function TravelBottleMixLoading({ visible, statusHint }: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const line = useMemo(() => {
    const i = Math.floor(Date.now() / 4000) % OVERLAY_LINES.length;
    return OVERLAY_LINES[i]!;
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setPlaybackError(null);
      setIsPlaying(false);
    }
  }, [visible]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (!visible || reduceMotion) {
      try {
        el.pause();
        el.currentTime = 0;
      } catch {
        /* ignore */
      }
      setIsPlaying(false);
      return;
    }

    let cancelled = false;
    const tryPlay = () => {
      if (cancelled || !videoRef.current) return;
      const v = videoRef.current;
      v.muted = true;
      v.defaultMuted = true;
      v.loop = true;
      v.playsInline = true;
      v.setAttribute('playsinline', 'true');
      v.setAttribute('webkit-playsinline', 'true');
      const p = v.play();
      if (p && typeof p.then === 'function') {
        void p
          .then(() => {
            if (!cancelled) {
              setIsPlaying(true);
              setPlaybackError(null);
            }
          })
          .catch((err: unknown) => {
            if (!cancelled) {
              setIsPlaying(false);
              setPlaybackError(err instanceof Error ? err.message : 'autoplay blocked');
            }
          });
      }
    };

    const onCanPlay = () => tryPlay();
    const onPlaying = () => {
      if (!cancelled) setIsPlaying(true);
    };
    const onError = () => {
      if (!cancelled) {
        setIsPlaying(false);
        setPlaybackError(el.error?.message || `media error ${el.error?.code ?? '?'}`);
      }
    };

    el.addEventListener('canplay', onCanPlay);
    el.addEventListener('playing', onPlaying);
    el.addEventListener('error', onError);
    try {
      el.load();
      tryPlay();
    } catch {
      /* ignore */
    }

    return () => {
      cancelled = true;
      el.removeEventListener('canplay', onCanPlay);
      el.removeEventListener('playing', onPlaying);
      el.removeEventListener('error', onError);
      try {
        el.pause();
      } catch {
        /* ignore */
      }
    };
  }, [visible, reduceMotion]);

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
        accessibilityState={{ busy: true, checked: isPlaying }}
        accessibilityHint={
          reduceMotion
            ? 'Reduced motion: text loading'
            : `Video ${BOTTLE_VIDEO_WEB_URI}${playbackError ? `; ${playbackError}` : ''}`
        }
      >
        <View style={styles.stage}>
          {reduceMotion ? (
            <View style={styles.neutral} testID="travel-bottle-mix-reduced">
              <ActivityIndicator color="#EED8B4" />
              <Text style={styles.reducedHint}>Searching sleeping stays…</Text>
            </View>
          ) : (
            <>
              {React.createElement('video', {
                ref: (node: HTMLVideoElement | null) => {
                  videoRef.current = node;
                },
                key: BOTTLE_VIDEO_WEB_URI,
                src: BOTTLE_VIDEO_WEB_URI,
                'data-testid': 'travel-bottle-mix-video',
                autoPlay: true,
                muted: true,
                defaultMuted: true,
                playsInline: true,
                loop: true,
                preload: 'auto',
                controls: false,
                'aria-hidden': true,
                style: {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  backgroundColor: '#0A0908',
                },
              })}
              {playbackError && !isPlaying ? (
                <View style={styles.neutral} testID="travel-bottle-mix-video-error">
                  <Text style={styles.reducedHint}>Searching sleeping stays…</Text>
                </View>
              ) : null}
            </>
          )}
          <View style={styles.scrim} pointerEvents="none" />
          <View style={styles.copyBlock} pointerEvents="none">
            <Text style={styles.kicker}>Travel in a Bottle</Text>
            <Text style={styles.line}>{line}</Text>
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
    zIndex: 9999,
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
    position: 'relative',
  },
  neutral: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#141210',
    zIndex: 1,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 7, 6, 0.28)',
    zIndex: 2,
  },
  copyBlock: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 28,
    zIndex: 3,
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
