import type { EventBanditRecommendation } from '@/app/services/events';
import { Image as ExpoImage } from 'expo-image';
import { repairDisplayText } from '@/lib/repairTextEncoding';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  name: string;
  category?: string | null;
  rating?: number | null;
  recommendation?: string | null;
  imageUri?: string | null;
  bandits?: EventBanditRecommendation[];
  onOpen: () => void;
  onDismiss?: () => void;
  compact?: boolean;
};

export default function MapPlacePreviewCard({
  name,
  category,
  rating,
  recommendation,
  imageUri,
  bandits,
  onOpen,
  onDismiss,
  compact = true,
}: Props) {
  const tip = String(recommendation || '').trim();
  const cat = String(category || '').trim();
  const rate = typeof rating === 'number' && Number.isFinite(rating) ? rating : null;
  const avatar = bandits?.[0];
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(imageUri && /^https?:\/\//i.test(imageUri) && !imageFailed);

  React.useEffect(() => {
    setImageFailed(false);
  }, [imageUri]);

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [styles.card, compact && styles.cardCompact, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${name}`}
    >
      <View style={styles.media}>
        {showImage ? (
          <ExpoImage
            source={{ uri: imageUri! }}
            style={styles.image}
            contentFit="cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <View style={[styles.image, styles.imageFallback]} />
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {repairDisplayText(name)}
        </Text>
        <View style={styles.metaRow}>
          {cat ? <Text style={styles.meta}>{cat}</Text> : null}
          {rate != null ? (
            <Text style={styles.meta}>{`${rate.toFixed(1)}★`}</Text>
          ) : null}
        </View>
        {tip ? (
          <Text style={styles.tip} numberOfLines={2}>
            {repairDisplayText(tip)}
          </Text>
        ) : avatar ? (
          <Text style={styles.tip} numberOfLines={1}>
            Recommended by banDit
          </Text>
        ) : (
          <Text style={styles.tip} numberOfLines={1}>
            Open place details
          </Text>
        )}
        <View style={styles.actions}>
          <Text style={styles.openCta}>Open</Text>
          {onDismiss ? (
            <Pressable
              onPress={(e) => {
                e?.stopPropagation?.();
                onDismiss();
              }}
              hitSlop={8}
              accessibilityLabel="Dismiss preview"
            >
              <Text style={styles.dismiss}>Close</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d9dee3',
    ...Platform.select({
      web: { boxShadow: '0 8px 24px rgba(15,23,42,0.16)' } as any,
      default: {
        shadowColor: '#0f172a',
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
      },
    }),
  },
  cardCompact: {
    maxWidth: 360,
    width: '100%',
  },
  pressed: { opacity: 0.94 },
  media: { width: 96, alignSelf: 'stretch', backgroundColor: '#e8edf1' },
  image: { width: '100%', height: '100%', minHeight: 96 },
  imageFallback: { backgroundColor: '#d5dde4' },
  body: { flex: 1, minWidth: 0, paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
  name: { fontSize: 15, fontWeight: '700', color: '#1f2937' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  meta: { fontSize: 12, fontWeight: '600', color: '#64748b', textTransform: 'capitalize' },
  tip: { fontSize: 12, lineHeight: 16, color: '#475569' },
  actions: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  openCta: { fontSize: 13, fontWeight: '700', color: '#111111' },
  dismiss: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },
});
