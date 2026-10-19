import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

const TONE: Record<string, { bg: string; ink: string }> = {
  Food: { bg: '#F4E7DE', ink: '#7A4330' },
  Coffee: { bg: '#EFE4D8', ink: '#6A4632' },
  Nightlife: { bg: '#E7E0F4', ink: '#53367F' },
  Shopping: { bg: '#E4EEF8', ink: '#1E4E78' },
  Culture: { bg: '#E4F3EF', ink: '#1C6A5E' },
};

function initials(name: string): string {
  const words = String(name || '')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => /[A-Za-z0-9\u00C0-\u024F]/.test(w));
  const letters = words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '');
  return letters.join('') || '•';
}

/** Neutral place frame. Does not depict another business. */
export function VenuePhotoFallback({
  name,
  genre,
  style,
}: {
  name: string;
  genre?: string | null;
  style?: StyleProp<ViewStyle>;
}) {
  const tone = TONE[String(genre || '')] ?? { bg: '#ECEAE6', ink: '#3C3C3C' };
  const label = String(name || '').trim();
  const flat = StyleSheet.flatten(style) || {};
  const sized = flat.height != null || flat.aspectRatio != null;
  return (
    <View style={[styles.frame, !sized && styles.ratio, { backgroundColor: tone.bg }, style]}>
      <Text style={[styles.mark, { color: tone.ink }]}>{initials(label)}</Text>
      {label ? (
        <Text style={[styles.name, { color: tone.ink }]} numberOfLines={2}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    maxHeight: 420,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    gap: 8,
  },
  ratio: {
    aspectRatio: 4 / 3,
  },
  mark: {
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});
