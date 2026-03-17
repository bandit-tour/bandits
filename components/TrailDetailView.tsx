import React from 'react';
import { ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';

export type BasicTrailStop = {
  position: number;
  stop_name: string;
  note?: string | null;
  spot_id?: string | null;
  canOpenSpot?: boolean;
};

export type BasicTrail = {
  title: string;
  description: string;
  mood: string;
  duration: string;
  stops: BasicTrailStop[];
};

interface TrailDetailViewProps {
  trail: BasicTrail;
  containerStyle?: ViewStyle;
  inline?: boolean;
}

export default function TrailDetailView({ trail, containerStyle, inline }: TrailDetailViewProps) {
  const stops = trail.stops ?? [];
  const totalStops = stops.length;

  const Wrapper: React.ComponentType<any> = inline ? View : ScrollView;
  const wrapperProps = inline
    ? { style: [styles.container, containerStyle] }
    : { style: styles.container, contentContainerStyle: [styles.content, containerStyle] };

  return (
    <Wrapper {...wrapperProps}>
      <Text style={styles.title}>{trail.title}</Text>
      <Text style={styles.mood}>{trail.mood}</Text>
      <Text style={styles.duration}>{trail.duration}</Text>
      <Text style={styles.description}>{trail.description}</Text>

      <Text style={styles.stopsTitle}>Stops</Text>
      {stops.map((stop) => (
        <View key={`${stop.position}-${stop.stop_name}`} style={styles.stopCard}>
          <View style={styles.stopHeader}>
            <View style={styles.stopNumberContainer}>
              <Text style={styles.stopPosition}>{stop.position}</Text>
            </View>
            <View style={styles.stopTitleBlock}>
              <Text style={styles.stopMeta}>
                Stop {stop.position} of {totalStops}
              </Text>
              <Text style={styles.stopName}>{stop.stop_name}</Text>
            </View>
          </View>
          {stop.note && <Text style={styles.stopNote}>{stop.note}</Text>}
        </View>
      ))}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: '#222', marginBottom: 8 },
  mood: { fontSize: 14, color: '#666', marginBottom: 4 },
  duration: { fontSize: 14, color: '#888', marginBottom: 12 },
  description: { fontSize: 14, color: '#3C3C3C', lineHeight: 20, marginBottom: 20 },
  stopsTitle: { fontSize: 17, fontWeight: '700', color: '#3C3C3C', marginBottom: 12 },
  stopCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  stopHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  stopNumberContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  stopPosition: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  stopTitleBlock: {
    flex: 1,
  },
  stopMeta: {
    fontSize: 11,
    color: '#888',
    marginBottom: 2,
  },
  stopName: { fontSize: 15, fontWeight: '600', color: '#222' },
  stopNote: { fontSize: 13, color: '#555', lineHeight: 18, marginLeft: 38, marginTop: 4 },
});

