import { picsumPlaceImage } from '@/lib/placePhoto';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getSpotsByBanditId } from '@/services/spots';
import { getEvents } from '@/app/services/events';
import { getTrailsByBanditId, TrailWithStops } from '@/services/trails';
import type { GeneratedTrail } from '@/services/aiTrails';
import EventCategories from '@/components/EventCategories';
import LocalBanditOctopusIcon from '@/components/LocalBanditOctopusIcon';
import EventList from '@/components/EventList';
import TrailCard from '@/components/TrailCard';
import TrailDetailView from '@/components/TrailDetailView';
import { EventGenre } from '@/constants/Genres';
import { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { trackEvent } from '@/lib/analytics';

type Bandit = Database['public']['Tables']['bandit']['Row'];
type Event = Database['public']['Tables']['event']['Row'];
type Spot = Database['public']['Tables']['spots']['Row'];

const EVENT_GENRES = ['Food', 'Culture', 'Nightlife', 'Shopping', 'Coffee'] as const;

function categoryToGenre(category: string): Event['genre'] {
  const cap = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
  return EVENT_GENRES.includes(cap as Event['genre']) ? (cap as Event['genre']) : 'Food';
}

export default function CityGuideScreen() {
  const params = useLocalSearchParams<{ banditId?: string; genre?: string }>();
  const rawBanditId = params.banditId;
  const banditIdParam = Array.isArray(rawBanditId) ? rawBanditId[0] : rawBanditId;
  const rawGenre = params.genre;
  const genreParam = Array.isArray(rawGenre) ? rawGenre[0] : rawGenre;

  const router = useRouter();
  const [effectiveBanditId, setEffectiveBanditId] = useState<string | null>(
    banditIdParam ?? null,
  );
  const [bandit, setBandit] = useState<Bandit | null>(null);
  const [allSpots, setAllSpots] = useState<Spot[]>([]); // for AI vibes only
  const [events, setEvents] = useState<Event[]>([]);
  const [trails, setTrails] = useState<TrailWithStops[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>(genreParam || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiTrail] = useState<GeneratedTrail | null>(null);
  const [aiLoading] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (banditIdParam) {
      setEffectiveBanditId(banditIdParam);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: neo } = await supabase
        .from('bandit')
        .select('id')
        .ilike('name', '%Neo%')
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (neo?.id) {
        setEffectiveBanditId(neo.id);
        return;
      }
      const { data: anyBandit } = await supabase.from('bandit').select('id').limit(1).maybeSingle();
      if (cancelled) return;
      if (anyBandit?.id) {
        setEffectiveBanditId(anyBandit.id);
        return;
      }
      setError('No bandits available');
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [banditIdParam]);

  useEffect(() => {
    if (!effectiveBanditId) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        const { data: banditData, error: banditError } = await supabase
          .from('bandit')
          .select('*')
          .eq('id', effectiveBanditId)
          .single();

        if (banditError) throw banditError;
        setBandit(banditData);
        void trackEvent({
          eventName: 'city_guide_opened',
          referenceType: 'bandit',
          referenceId: banditData.id,
          onceKey: `city_guide_opened:${banditData.id}`,
        });

        const [spotsData, trailsData, eventsData] = await Promise.all([
          getSpotsByBanditId(effectiveBanditId), // AI-only
          getTrailsByBanditId(effectiveBanditId),
          getEvents({ banditId: effectiveBanditId }), // primary city guide source
        ]);
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
  }, [effectiveBanditId]);

  const refreshNow = async () => {
    if (!effectiveBanditId) return;
    setRefreshing(true);
    try {
      const { data: banditData } = await supabase
        .from('bandit')
        .select('*')
        .eq('id', effectiveBanditId)
        .single();
      if (banditData) setBandit(banditData);
      const [spotsData, trailsData, eventsData] = await Promise.all([
        getSpotsByBanditId(effectiveBanditId),
        getTrailsByBanditId(effectiveBanditId),
        getEvents({ banditId: effectiveBanditId }),
      ]);
      setAllSpots(spotsData);
      setTrails(trailsData);
      setEvents(eventsData ?? []);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [bandit?.id]);

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
      <Stack.Screen options={{ headerShown: true, title: '', headerBackTitle: 'Back' }} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refreshNow()} />}
      >
        {/* Header */}
        <Text style={styles.headerText}>City Guide</Text>
        <View style={styles.banditNameRow}>
          <LocalBanditOctopusIcon />
          <Text style={styles.banditNameLabel}>
            {`${bandit.name} ${bandit.family_name ?? ''}`.trim()}
          </Text>
        </View>

        {/* Bandit Profile Section */}
        <View style={styles.profileSection}>


          <View style={styles.descriptionContent}>

            <Text style={styles.descriptionText}>
              Yo, traveler. Your adventure just got upgraded.{'\n'}
              Welcome to the side of the city locals don't usually share.{'\n'}
              You've officially entered the bandiVerse. Let's go rogue.
            </Text>

            <View style={styles.profileImageContainer}>
              {(() => {
                const raw = bandit.image_url?.trim();
                const validUrl =
                  raw && /^https?:\/\//i.test(raw) ? raw : null;
                const uri =
                  !avatarLoadFailed && validUrl
                    ? validUrl
                    : picsumPlaceImage(`cg-banDit-${bandit.id}`, 400, 400);
                return (
                  <Image
                    source={{ uri }}
                    style={styles.profileImage}
                    resizeMode="cover"
                    onError={() => setAvatarLoadFailed(true)}
                  />
                );
              })()}
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
          <Pressable
            onPress={() => {
              router.push(`/vibe/${encodeURIComponent(bandit.id)}` as any);
            }}
            style={{ alignSelf: 'stretch' }}
          >
            <View style={styles.aiButton}>
              <Text style={styles.aiButtonText}>{aiLoading ? 'Finding a vibe…' : 'Get a vibe'}</Text>
              <Text style={styles.aiButtonSubtext}>Pull a trail from local‑coded spots.</Text>
            </View>
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
          banditId={effectiveBanditId as string}
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
    marginBottom: 8,
  },
  banditNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  banditNameLabel: {
    fontWeight: '700',
    fontSize: 17,
    color: '#222',
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
  profileImagePlaceholder: {
    backgroundColor: '#E8E8E8',
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
