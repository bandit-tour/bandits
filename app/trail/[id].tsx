import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { isDemoMode } from '@/lib/demoMode';
import { getTrailById, TrailWithStops } from '@/services/trails';
import TrailDetailView, { BasicTrail, BasicTrailStop } from '@/components/TrailDetailView';
import { trackEvent } from '@/lib/analytics';

export default function TrailDetailScreen() {
  const { id } = useLocalSearchParams();
  const [trail, setTrail] = useState<TrailWithStops | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrail = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const data = await getTrailById(id as string);
        console.log('[TrailDetail] loaded', {
          routeId: id,
          trailId: data?.id,
          stopsCount: data?.trail_stops?.length ?? 0,
        });
        setTrail(data);
        if (data?.id) {
          void trackEvent({
            eventName: 'trail_opened',
            referenceType: 'trail',
            referenceId: data.id,
            onceKey: `trail_opened:${data.id}`,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load trail');
      } finally {
        setLoading(false);
      }
    };

    fetchTrail();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !trail) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Trail not found'}</Text>
      </View>
    );
  }

  const dbStops = trail.trail_stops ?? [];

  let stops: BasicTrailStop[] =
    dbStops.length > 0
      ? dbStops.map((stop, index): BasicTrailStop => ({
          position: index + 1,
          stop_name: stop.stop_name,
          note: stop.note,
          spot_id: stop.spot_id ?? null,
          canOpenSpot: !!(stop.spot_id && stop.spot),
        }))
      : [
          {
            position: 1,
            stop_name: 'O Kostas',
            note: 'Start here. Stand on the pavement with everyone else and eat fast enough that it’s still burning your fingers.',
            spot_id: null,
            canOpenSpot: false,
          },
          {
            position: 2,
            stop_name: 'Exarchia rooftop',
            note: 'Climb up, take one slow look over the city, then put your phone away. This is where you listen to the conversations, not the playlist.',
            spot_id: null,
            canOpenSpot: false,
          },
          {
            position: 3,
            stop_name: 'Midnight bakery',
            note: 'Hit this when the streets start emptying. Point at whatever just came out of the oven and walk home with the box still too hot to hold.',
            spot_id: null,
            canOpenSpot: false,
          },
        ];

  // Give Neo's trail a more personal, non-checklist voice
  if (trail.title.toLowerCase().includes('neo urban stories')) {
    stops = stops.map((stop) => {
      const name = (stop.stop_name || '').toLowerCase();
      if (name === 'jazz in jazz') {
        return {
          ...stop,
          note:
            'Slide into the back, don’t ask what’s “good”, just order something short and listen to the room breathe between solos.',
        };
      }
      if (name.includes('monastiraki') && name.includes('flea')) {
        return {
          ...stop,
          note:
            'Drift through the side alleys, touch nothing for the first ten minutes, then buy the one thing you can’t stop thinking about.',
        };
      }
      if (name === 'feyrouz') {
        return {
          ...stop,
          note:
            'Queue, watch the regulars, then point at whatever just came out of the oven. Eat it standing on the street and keep moving.',
        };
      }
      return stop;
    });
  }

  const basicTrail: BasicTrail = {
    title: trail.title,
    description: trail.description,
    mood: trail.mood,
    duration: trail.duration,
    stops,
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: '' }} />
      {isDemoMode() ? (
        <View style={styles.demoBanner}>
          <Text style={styles.demoBannerText}>
            Pilot demo mode — trail and stops load from your project; scroll feels instant on device.
          </Text>
        </View>
      ) : null}
      <TrailDetailView trail={basicTrail} containerStyle={styles.content} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: '#FF3B30' },
  demoBanner: {
    backgroundColor: '#FFF8E6',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8DCB8',
  },
  demoBannerText: { fontSize: 12, color: '#5a4a00', lineHeight: 17 },
});
