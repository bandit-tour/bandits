import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getUserLikedBanditIds, getBandits } from '@/app/services/bandits';
import { getUserLikedEvents } from '@/app/services/events';
import { supabase } from '@/lib/supabase';
import { Database } from '@/lib/database.types';
import EventCard from '@/components/EventCard';

type Event = Database['public']['Tables']['event']['Row'];

type ProfileData = {
  email: string | null;
  likedBandits: number;
  likedEvents: number;
};

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProfileData | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<Event[]>([]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('[Profile] load start');

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError) throw userError;

        const [likedBanditIds, likedEvents, allBandits] = await Promise.all([
          getUserLikedBanditIds(),
          getUserLikedEvents(),
          getBandits(),
        ]);

        const likedBandits = allBandits.filter((b: any) => likedBanditIds.has(b.id));
        const places = likedEvents?.slice(0, 10) ?? [];

        console.log('[Profile] loaded', {
          userId: user?.id ?? null,
          likedBandits: likedBandits.length,
          likedEvents: likedEvents.length,
          placesShown: places.length,
        });

        setData({
          email: user?.email ?? null,
          likedBandits: likedBandits.length,
          likedEvents: likedEvents.length,
        });
        setSavedPlaces(places as Event[]);
      } catch (e: any) {
        console.error('[Profile] load failed', e);
        setError(e?.message ?? 'Failed to load profile data');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const empty = useMemo(() => !loading && !error && data != null && savedPlaces.length === 0, [loading, error, data, savedPlaces.length]);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Profile' }} />
      <View style={styles.container}>
        {loading && (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
          </View>
        )}

        {!loading && error && (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!loading && !error && data && (
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title}>Your Profile</Text>
            <Text style={styles.meta}>Email: {data.email ?? 'No email available'}</Text>
            <Text style={styles.meta}>Liked bandits: {data.likedBandits}</Text>
            <Text style={styles.meta}>Saved events: {data.likedEvents}</Text>

            <Text style={styles.sectionTitle}>Saved places</Text>
            {empty ? (
              <Text style={styles.emptyText}>No saved places yet.</Text>
            ) : (
              <View style={styles.cards}>
                {savedPlaces.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onLike={() => {}}
                    isLiked
                    showButton={false}
                    variant="default"
                    imageHeight={120}
                  />
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111',
    marginBottom: 10,
  },
  meta: {
    fontSize: 14,
    color: '#444',
    marginBottom: 6,
  },
  sectionTitle: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
  },
  row: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  cards: {
    flexDirection: 'column',
    paddingBottom: 24,
  },
  emptyText: {
    fontSize: 13,
    color: '#666',
  },
  errorText: {
    fontSize: 14,
    color: '#D92C2C',
    textAlign: 'center',
  },
});
