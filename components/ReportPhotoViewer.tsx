import React, { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

type ReportPhotoViewerProps = {
  uri: string;
  testID?: string;
};

function fitBox(maxW: number, maxH: number, ratio: number) {
  const safe = ratio > 0 ? ratio : 1;
  let width = maxW;
  let height = width / safe;
  if (height > maxH) {
    height = maxH;
    width = height * safe;
  }
  return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
}

/**
 * banDiTEAM uploaded photo. The card matches the file's aspect ratio and the
 * image is contained, never cropped into a banner. Desktop opens a lightbox;
 * a narrow screen opens a full-screen viewer.
 */
export function ReportPhotoViewer({ uri, testID = 'report-photo' }: ReportPhotoViewerProps) {
  const { width: windowW, height: windowH } = useWindowDimensions();
  const [aspect, setAspect] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const isCompact = windowW < 768;
  const ratio = aspect && aspect > 0 ? aspect : 1;

  useEffect(() => {
    let cancelled = false;
    setAspect(null);
    if (Platform.OS === 'web' && typeof globalThis.Image === 'function') {
      const probe = new globalThis.Image();
      probe.onload = () => {
        if (!cancelled && probe.naturalWidth > 0 && probe.naturalHeight > 0) {
          setAspect(probe.naturalWidth / probe.naturalHeight);
        }
      };
      probe.src = uri;
      return () => {
        cancelled = true;
      };
    }
    Image.getSize(
      uri,
      (w, h) => {
        if (!cancelled && w > 0 && h > 0) setAspect(w / h);
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [uri]);

  const card = fitBox(Math.min(Math.max(windowW - 40, 240), 720), Math.round(windowH * 0.72), ratio);
  const stage = fitBox(
    isCompact ? windowW : Math.min(windowW * 0.92, 1100),
    isCompact ? windowH - 88 : Math.round(windowH * 0.86),
    ratio,
  );

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="View photo"
        testID={testID}
        style={[styles.card, { width: card.width, height: card.height }]}
      >
        <Image
          source={{ uri }}
          style={styles.img}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View
          style={[styles.viewer, isCompact ? styles.viewerFull : styles.viewerDesktop]}
          testID={`${testID}-viewer`}
          accessibilityViewIsModal
        >
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close photo" />
          <View style={[styles.stage, { width: stage.width, height: stage.height }]} pointerEvents="none">
            <Image source={{ uri }} style={styles.img} resizeMode="contain" accessibilityIgnoresInvertColors />
          </View>
          <Pressable
            onPress={() => setOpen(false)}
            style={styles.close}
            accessibilityRole="button"
            accessibilityLabel="Close"
            testID={`${testID}-close`}
          >
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#111111',
    alignSelf: 'center',
  },
  img: {
    width: '100%',
    height: '100%',
  },
  viewer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerFull: {
    paddingTop: 64,
    paddingBottom: 16,
  },
  viewerDesktop: {
    padding: 28,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  stage: {
    zIndex: 1,
  },
  close: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 3,
    minWidth: 44,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
