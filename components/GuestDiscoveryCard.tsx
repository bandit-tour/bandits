import { useRouter, type Href } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  dismissDiscoveryPrompt,
  markDiscoveryPromptShown,
  shouldShowDiscoveryPrompt,
  type DiscoveryPromptId,
} from '@/lib/guestDiscoveryPrompts';

type Props = {
  promptId: DiscoveryPromptId;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  href: Href;
  /** When set, runs instead of router.push(href) — e.g. open PremiumUnlockModal. */
  onCtaPress?: () => void;
  testID?: string;
};

/**
 * Elegant contextual discovery card — dismissible, frequency-capped.
 */
export function GuestDiscoveryCard({
  promptId,
  eyebrow,
  title,
  body,
  cta,
  href,
  onCtaPress,
  testID,
}: Props) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const ok = await shouldShowDiscoveryPrompt(promptId);
      if (!alive || !ok) return;
      setVisible(true);
      await markDiscoveryPromptShown(promptId);
    })();
    return () => {
      alive = false;
    };
  }, [promptId]);

  if (!visible) return null;

  return (
    <View style={styles.card} testID={testID || `discovery-${promptId}`}>
      <View style={styles.topRow}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Pressable
          onPress={() => {
            void dismissDiscoveryPrompt(promptId);
            setVisible(false);
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Dismiss suggestion"
        >
          <Text style={styles.dismiss}>Not now</Text>
        </Pressable>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <Pressable
        style={styles.cta}
        onPress={() => (onCtaPress ? onCtaPress() : router.push(href))}
        accessibilityRole="button"
        accessibilityLabel={cta}
      >
        <Text style={styles.ctaText}>{cta}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FFFCF7',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5DFD6',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: '#E03131',
  },
  dismiss: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8A8176',
    textDecorationLine: 'underline',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1A1510',
    letterSpacing: -0.2,
  },
  body: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: '#5A534A',
  },
  cta: {
    marginTop: 14,
    alignSelf: 'flex-start',
    backgroundColor: '#1A1510',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ctaText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 13,
  },
});
