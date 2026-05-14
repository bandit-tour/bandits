import { PLAY_HOTEL_BOTTLE_ASSET } from '@/lib/hotelWhiteLabel';
import React, { useCallback, useEffect, useRef } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * Web variant — expo-video can break hydration / loop unpredictably on RN-web.
 * We render the static bottle hero asset and auto-advance after a short delay
 * so the calling screen still flips to its confirmation card without manual interaction.
 */

const WEB_ADVANCE_MS = 2_400;

type BottleSubmitVideoProps = {
  visible: boolean;
  onFinished: () => void;
  skipLabel?: string;
};

export function BottleSubmitVideo({ visible, onFinished, skipLabel = 'Skip' }: BottleSubmitVideoProps) {
  const doneRef = useRef(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onFinished();
  }, [onFinished]);

  useEffect(() => {
    if (!visible) {
      doneRef.current = false;
      return;
    }
    doneRef.current = false;
    const t = setTimeout(finish, WEB_ADVANCE_MS);
    return () => clearTimeout(t);
  }, [visible, finish]);

  if (!visible) return null;

  return (
    <Modal visible animationType="fade" transparent onRequestClose={finish}>
      <View style={styles.backdrop} accessibilityViewIsModal>
        <Image
          source={PLAY_HOTEL_BOTTLE_ASSET}
          style={styles.image}
          resizeMode="contain"
          accessibilityLabel="Message in a bottle"
        />
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
  image: {
    width: '100%',
    height: '80%',
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
