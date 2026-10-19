import React, { useState } from 'react';
import {
  Image,
  Modal,
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

/**
 * banDiTEAM uploaded photo: full image at its own aspect ratio, then a
 * desktop lightbox or mobile full-screen viewer. Contain only — no banner crop.
 */
export function ReportPhotoViewer({ uri, testID = 'report-photo' }: ReportPhotoViewerProps) {
  const { width: windowW, height: windowH } = useWindowDimensions();
  const [aspect, setAspect] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const isCompact = windowW < 768;
  const ratio = aspect && aspect > 0 ? aspect : 1;
  const maxCardH = Math.min(Math.round(windowH * 0.78), 960);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="View photo"
        testID={testID}
        style={[styles.card, { aspectRatio: ratio, maxHeight: maxCardH }]}
      >
        <Image
          source={{ uri }}
          style={styles.img}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          onLoad={(event) => {
            const w = event.nativeEvent.source?.width;
            const h = event.nativeEvent.source?.height;
            if (w && h) setAspect(w / h);
          }}
        />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View
          style={[styles.viewer, isCompact ? styles.viewerFull : styles.viewerDesktop]}
          testID={`${testID}-viewer`}
          accessibilityViewIsModal
        >
          <Pressable
            style={styles.backdrop}
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close photo"
          />
          <View
            style={isCompact ? styles.stageFull : styles.stageDesktop}
            pointerEvents="none"
          >
            <Image source={{ uri }} style={styles.stageImg} resizeMode="contain" accessibilityIgnoresInvertColors />
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
    width: '100%',
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
  },
  viewerFull: {
    justifyContent: 'center',
  },
  viewerDesktop: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  stageFull: {
    flex: 1,
    width: '100%',
    marginTop: 56,
    marginBottom: 24,
  },
  stageDesktop: {
    width: '92%',
    maxWidth: 1100,
    height: '86%',
  },
  stageImg: {
    width: '100%',
    height: '100%',
  },
  close: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 2,
    minWidth: 44,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
