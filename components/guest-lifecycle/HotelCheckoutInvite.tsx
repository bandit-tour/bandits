/**
 * Dismissible hotel checkout invite — not a payment prompt (QA-03).
 * Shown after stay / between trips to remind guests hotel services pause.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const STORAGE_KEY = 'bandits.hotelCheckoutInvite.dismissed.v1';

type Props = {
  visible?: boolean;
  hotelName?: string | null;
};

export function HotelCheckoutInvite({ visible = true, hotelName }: Props) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (!cancelled) setDismissed(v === '1');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onDismiss = useCallback(() => {
    setDismissed(true);
    void AsyncStorage.setItem(STORAGE_KEY, '1');
  }, []);

  if (!visible || dismissed) return null;

  const place = hotelName?.trim() || 'your hotel';

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <View style={styles.body}>
        <Text style={styles.kicker}>Hotel checkout</Text>
        <Text style={styles.title}>Stay services pause after checkout</Text>
        <Text style={styles.lead}>
          When you leave {place}, room and hotel tools pause. Your traveler account, Chat, and City
          Memory stay with you — reconnect with Connect My New Stay when you book again.
        </Text>
      </View>
      <Pressable
        onPress={onDismiss}
        style={styles.dismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss hotel checkout invite"
      >
        <Text style={styles.dismissText}>Dismiss</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: '#D9CFC0',
    backgroundColor: '#FFF9F0',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginBottom: 12,
  },
  body: { gap: 6, paddingRight: 8 },
  kicker: {
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: '#6B5A3E',
    fontWeight: '700',
  },
  title: { fontSize: 16, fontWeight: '800', color: '#1A1A1A' },
  lead: { fontSize: 14, lineHeight: 20, color: '#444' },
  dismiss: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#1A1A1A',
  },
  dismissText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
});
