import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getSpotsByBanditId } from '@/app/services/spots';
import { getEvents } from '@/app/services/events';
import { getTrailsByBanditId, TrailWithStops } from '@/app/services/trails';
import { generateAiTrailFromSpots, GeneratedTrail } from '@/app/services/aiTrails';
import EventCategories from '@/components/EventCategories';
import EventList from '@/components/EventList';
import TrailCard from '@/components/TrailCard';
import { EventGenre } from '@/constants/Genres';
import { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

type Bandit = Database['public']['Tables']['bandit']['Row'];
type Event = Database['public']['Tables']['event']['Row'];
type Spot = Database['public']['Tables']['spots']['Row'];

const EVENT_GENRES = ['Food', 'Culture', 'Nightlife', 'Shopping', 'Coffee'] as const;

function categoryToGenre(category: string): Event['genre'] {
  const cap = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
  return EVENT_GENRES.includes(cap as Event['genre']) ? (cap as Event['genre']) : 'Food';
}

export default function CityGuideScreen() {
  const { banditId, genre } = useLocalSearchParams();
  const router = useRouter();
  const [bandit, setBandit] = useState<Bandit | null>(null);
  const [allSpots, setAllSpots] = useState<Spot[]>([]); // for AI vibes only
  const [events, setEvents] = useState<Event[]>([]);
  const [trails, setTrails] = useState<TrailWithStops[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>(genre as string || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiTrail, setAiTrail] = useState<GeneratedTrail | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const { data: banditData, error: banditError } = await supabase
          .from('bandit')
          .select('*')
          .eq('id', banditId as string)
          .single();

        if (banditError) throw banditError;
        setBandit(banditData);

        const [spotsData, trailsData, eventsData] = await Promise.all([
          getSpotsByBanditId(banditId as string), // AI-only
          getTrailsByBanditId(banditId as string),
          getEvents({ banditId: banditId as string }), // primary city guide source
        ]);
        console.log('[CityGuide] loaded', {
          banditId,
          spotsCount: spotsData?.length ?? 0,
          eventsCount: eventsData?.length ?? 0,
          trailsCount: trailsData?.length ?? 0,
        });
        setAllSpots(spotsData);
        setTrails(trailsData);
        setEvents(eventsData ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [banditId]);

  const filteredEvents = useMemo(() => {
    const base = events;
    if (!selectedGenre) return base;
    return base.filter((e) => e.genre === selectedGenre);
  }, [events, selectedGenre]);

  const eventCategories = useMemo(() => {
    const categoryCounts: { [key: string]: number } = {};
    events.forEach((e) => {
      if (e.genre) categoryCounts[e.genre] = (categoryCounts[e.genre] || 0) + 1;
    });
    return Object.entries(categoryCounts).map(([g, count]) => ({
      genre: g as EventGenre,
      count,
    }));
  }, [events]);

  const handleGetVibe = () => {
    if (!allSpots.length) {
      setAiTrail(null);
      return;
    }
    setAiLoading(true);
    try {
      // Simple mapping: use selected genre to influence mood, otherwise default to hidden gems
      const moodHint =
        (selectedGenre || '').toLowerCase() === 'coffee'
          ? 'coffee morning'
          : (selectedGenre || '').toLowerCase() === 'nightlife'
          ? 'after dark'
          : (selectedGenre || '').toLowerCase() === 'culture'
          ? 'art day'
          : (selectedGenre || '').toLowerCase() === 'food'
          ? 'food crawl'
          : 'hidden gems';

      const generated = generateAiTrailFromSpots(moodHint, allSpots);
      setAiTrail(generated);
    } finally {
      setAiLoading(false);
    }
  };
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!bandit) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Bandit not found</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: '' }} />

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <Text style={styles.headerText}>City Guide</Text>

        {/* Bandit Profile Section */}
        <View style={styles.profileSection}>


          <View style={styles.descriptionContent}>

            <Text style={styles.descriptionText}>
              Yo, traveler. Your adventure just got upgraded.{'\n'}
              Welcome to the side of the city locals don't usually share.{'\n'}
              You've officially entered the bandiVerse. Let's go rogue.
            </Text>

            <View style={styles.profileImageContainer}>
              <Image
                source={{ uri: bandit.image_url }}
                style={styles.profileImage}
              />
            </View>

          </View>
        </View>

        {/* Event Categories - Only show if there are spots in DB */}
        {allSpots.length > 0 && eventCategories.length > 0 && (
          <>
            <Text style={styles.interestsText}>Select Your Interests</Text>
            <EventCategories
              categories={eventCategories}
              selectedGenre={selectedGenre}
              onCategoryPress={(genre) => setSelectedGenre(selectedGenre === genre ? '' : genre)}
            />
          </>
        )}

        {/* Curated Trails */}
        {trails.length > 0 && (
          <>
            <Text style={styles.interestsText}>Curated Trails</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.trailsContainer}
            >
              {trails.map((t) => (
                <TrailCard key={t.id} trail={t} />
              ))}
            </ScrollView>
          </>
        )}

        {/* AI vibe button + inline trail */}
        <View style={styles.aiSection}>
          <Text style={styles.aiPunchline}>For when the map feels too clean.</Text>
          <Text style={styles.aiPunchlineText}>
            No bus tours. No best‑of lists.
            Just a loose thread into the parts of Athens locals don’t post about.
          </Text>
          <Pressable style={styles.aiButton} onPress={handleGetVibe}>
            <Text style={styles.aiButtonText}>{aiLoading ? 'Finding a vibe…' : 'Get a vibe'}</Text>
            <Text style={styles.aiButtonSubtext}>Pull a trail from local‑coded spots.</Text>
          </Pressable>
          {aiTrail && (
            <View style={styles.aiTrailContainer}>
              <Text style={styles.aiTrailLabel}>AI trail idea</Text>
              {/* Reuse the trail detail layout inline */}
              <TrailDetailView
                trail={{
                  title: aiTrail.title,
                  description: aiTrail.description,
                  mood: aiTrail.mood,
                  duration: aiTrail.duration,
                  stops: aiTrail.stops.map((s) => ({
                    position: s.position,
                    stop_name: s.stop_name,
                    note: s.note,
                  })),
                }}
                inline
                containerStyle={{ padding: 0 }}
              />
            </View>
          )}
        </View>

        {/* Spots List (mapped to Event-like for card UI) */}
        <EventList
          events={filteredEvents}
          variant="horizontal"
          showButton={false}
          imageHeight={120}
          banditId={banditId as string}
          showRecommendations={false}
          likedEventIds={new Set()}
          onEventPress={(e) => router.push(`/spot/${e.id}` as any)}
          contentContainerStyle={styles.eventsContainer}
        />

      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: 'red',
  },
  headerText: {
    fontFamily: 'Caros',
    fontWeight: '800',
    fontSize: 24,
    color: '#3C3C3C',
    textAlign: 'center',
    marginBottom: 20,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileImageContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: 'hidden',
    marginBottom: 16,
    // Removed red border as requested
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },

  descriptionContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
  },
  banditIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  descriptionText: {
    fontFamily: 'Caros',
    fontWeight: '400',
    fontSize: 14,
    color: '#3C3C3C',
    textAlign: 'left', // Left align the text
    lineHeight: 20,
    flex: 1, // Take up available space
    marginRight: 16, // Add some space between text and image
  },
  interestsText: {
    fontFamily: 'Caros',
    fontWeight: '700',
    fontSize: 17,
    color: '#3C3C3C',
    marginBottom: 16,
  },
  eventsContainer: {
    paddingHorizontal: 8,
    marginBottom: 20,
    marginTop: 8,
  },
  trailsContainer: {
    paddingHorizontal: 8,
    marginBottom: 20,
    paddingTop: 4,
  },
  aiSection: {
    marginBottom: 24,
  },
  aiButton: {
    backgroundColor: '#111',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  aiButtonText: {
    fontFamily: 'Caros',
    fontWeight: '700',
    fontSize: 15,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  aiButtonSubtext: {
    fontFamily: 'Caros',
    fontWeight: '400',
    fontSize: 12,
    color: '#D0D0D0',
  },
  aiPunchline: {
    fontFamily: 'Caros',
    fontWeight: '700',
    fontSize: 14,
    color: '#111',
    marginBottom: 4,
  },
  aiPunchlineText: {
    fontFamily: 'Caros',
    fontWeight: '400',
    fontSize: 12,
    color: '#4A4A4A',
    marginBottom: 10,
    lineHeight: 18,
  },
  aiTrailContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    padding: 12,
  },
  aiTrailLabel: {
    fontFamily: 'Caros',
    fontWeight: '600',
    fontSize: 13,
    color: '#555',
    marginBottom: 8,
  },
}); 

import TrailDetailView from '@/components/TrailDetailView';
