import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { TrailWithStops } from '@/services/trails';

interface TrailCardProps {
  trail: TrailWithStops;
}

export default function TrailCard({ trail }: TrailCardProps) {
  const router = useRouter();
  const stopCount = trail.trail_stops?.length ?? 0;

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/trail/${trail.id}` as any)}
    >
      <Text style={styles.title}>{trail.title}</Text>
      <Text style={styles.mood}>{trail.mood}</Text>
      <Text style={styles.meta}>
        {trail.duration} · {stopCount} stops
      </Text>
      <Text style={styles.description} numberOfLines={2}>
        {trail.description}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F8F8F8',
    borderRadius: 14,
    padding: 14,
    marginRight: 12,
    width: 220,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
    marginBottom: 4,
  },
  mood: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  meta: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
  },
  description: {
    fontSize: 13,
    color: '#3C3C3C',
    lineHeight: 18,
  },
});
