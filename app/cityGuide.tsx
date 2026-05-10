import { useFocusEffect } from '@react-navigation/native';
import { HeaderBackButton } from '@react-navigation/elements';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { usePremiumRefreshControl } from '@/lib/mobilePullToRefresh';
import { Image as ExpoImage } from 'expo-image';

import { getSpotsByBanditId } from '@/services/spots';
import { getEvents, getUserLikedEventIds, toggleEventLike } from '@/app/services/events';
import { getTrailsByBanditId, TrailWithStops } from '@/services/trails';
import type { GeneratedTrail } from '@/services/aiTrails';
import BanditProfileHeroMedia from '@/components/BanditProfileHeroMedia';
import EventCategories from '@/components/EventCategories';
import LocalBanditOctopusIcon from '@/components/LocalBanditOctopusIcon';
import TrailCard from '@/components/TrailCard';
import TrailDetailView from '@/components/TrailDetailView';
import { EVENT_GENRES, EventGenre } from '@/constants/Genres';
import { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { trackEvent } from '@/lib/analytics';
import {
  canonicalRecommendationImageIdentity,
  enforceUniqueRecommendationImagesByEventId,
  resolveStrictRecommendationImagesByEventId,
} from '@/lib/recommendationImages';

type Bandit = Database['public']['Tables']['bandit']['Row'];
type Event = Database['public']['Tables']['event']['Row'];
type Spot = Database['public']['Tables']['spots']['Row'];

function normalizeGenre(raw: unknown): EventGenre | null {
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return null;
  const cap = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return (EVENT_GENRES as readonly string[]).includes(cap) ? (cap as EventGenre) : null;
}

function RecommendationHeroImage({
  sourceUri,
  eventId,
  onInvalid,
}: {
  sourceUri: string;
  eventId: string;
  onInvalid: () => void;
}) {
  return (
    <ExpoImage
      source={{ uri: sourceUri }}
      style={styles.recommendationImage}
      contentFit="cover"
      transition={120}
      accessibilityLabel={`recommendation-hero:${eventId}`}
      accessibilityRole="image"
      onError={onInvalid}
    />
  );
}

export default function CityGuideScreen() {
  const { width } = useWindowDimensions();
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
  const [likedEventIds, setLikedEventIds] = useState<Set<string>>(new Set());
  const [activeRecommendationIndex, setActiveRecommendationIndex] = useState(0);
  const [resolvedRecommendationImageById, setResolvedRecommendationImageById] = useState<Record<string, string | null>>({});
  const [hiddenHeroEventIds, setHiddenHeroEventIds] = useState<Set<string>>(new Set());
  const recommendationScrollRef = useRef<ScrollView>(null);

  const refreshLikedIds = useCallback(async () => {
    try {
      const ids = await getUserLikedEventIds();
      setLikedEventIds(ids);
    } catch {
      setLikedEventIds(new Set());
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshLikedIds();
    }, [refreshLikedIds]),
  );

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

  const onToggleEventLike = useCallback(
    async (eventId: string) => {
      const wasLiked = likedEventIds.has(eventId);
      setLikedEventIds((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.delete(eventId);
        else next.add(eventId);
        return next;
      });
      try {
        await toggleEventLike(eventId, wasLiked);
      } catch {
        setLikedEventIds((prev) => {
          const next = new Set(prev);
          if (wasLiked) next.add(eventId);
          else next.delete(eventId);
          return next;
        });
      }
    },
    [likedEventIds],
  );

  const refreshNow = useCallback(async () => {
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
  }, [effectiveBanditId]);

  const onCityGuideRefresh = useCallback(() => {
    void refreshNow();
  }, [refreshNow]);
  const cityGuideRefresh = usePremiumRefreshControl(refreshing, onCityGuideRefresh);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [bandit?.id]);

  const filteredEvents = useMemo(() => {
    const base = events;
    if (!selectedGenre) return base;
    return base.filter((e) => e.genre === selectedGenre);
  }, [events, selectedGenre]);
  const isDesktopWeb = Platform.OS === 'web' && width >= 1024;
  const recommendationsContainerMaxWidth = 980;
  const recommendationsContainerWidth = Math.min(width - 32, recommendationsContainerMaxWidth);
  const recommendationCardWidth = Math.max(
    280,
    Math.min(420, Math.round(recommendationsContainerWidth * 0.86)),
  );
  const recommendationGap = isDesktopWeb ? 20 : 14;
  useEffect(() => {
    let cancelled = false;
    setResolvedRecommendationImageById({});
    void (async () => {
      const out = await resolveStrictRecommendationImagesByEventId(filteredEvents as any);
      const uniqueOut = enforceUniqueRecommendationImagesByEventId(filteredEvents as any, out);
      if (!cancelled) setResolvedRecommendationImageById(uniqueOut);
    })();
    return () => {
      cancelled = true;
    };
  }, [filteredEvents]);
  /** Dedupe neutral SVG placeholders only so real venue URLs (incl. duplicates) stay visible like /spot detail. */
  const finalUniqueRecommendationImageById = useMemo(() => {
    const used = new Set<string>();
    const out: Record<string, string | null> = {};
    for (const e of filteredEvents) {
      const src = resolvedRecommendationImageById[e.id] ?? null;
      if (!src) {
        out[e.id] = null;
        continue;
      }
      if (!src.startsWith('data:image/svg+xml')) {
        out[e.id] = src;
        continue;
      }
      const id = canonicalRecommendationImageIdentity(src);
      if (!id || used.has(id)) {
        out[e.id] = null;
        continue;
      }
      used.add(id);
      out[e.id] = src;
    }
    return out;
  }, [filteredEvents, resolvedRecommendationImageById]);

  useEffect(() => {
    const missingHeroIds = filteredEvents
      .map((e) => e.id)
      .filter((id) => !finalUniqueRecommendationImageById[id]);
    if (missingHeroIds.length > 0) {
      console.warn('[CityGuide] recommendation hero hidden (unique pool exhausted)', {
        banditId: effectiveBanditId,
        eventIds: missingHeroIds,
      });
    }
  }, [effectiveBanditId, filteredEvents, finalUniqueRecommendationImageById]);

  useEffect(() => {
    if (activeRecommendationIndex >= filteredEvents.length) {
      setActiveRecommendationIndex(0);
    }
  }, [filteredEvents.length, activeRecommendationIndex]);

  useEffect(() => {
    setHiddenHeroEventIds(new Set());
  }, [filteredEvents]);

  const eventCategories = useMemo(() => {
    const categoryCounts: { [key: string]: number } = {};
    events.forEach((e) => {
      const genre = normalizeGenre(e.genre);
      if (genre) categoryCounts[genre] = (categoryCounts[genre] || 0) + 1;
    });
    return Object.entries(categoryCounts).map(([g, count]) => ({
      genre: g as EventGenre,
      count,
    }));
  }, [events]);

  const exitCityGuide = useCallback(() => {
    const bid = String(banditIdParam ?? effectiveBanditId ?? bandit?.id ?? '').trim();
    if (router.canGoBack()) router.back();
    else if (bid) router.replace(`/bandit/${bid}` as never);
    else router.replace('/bandits' as never);
  }, [router, banditIdParam, effectiveBanditId, bandit?.id]);

  const cityGuideHeaderOptions = useMemo(
    () => ({
      headerShown: true as const,
      title: 'City Guide' as const,
      headerBackTitle: 'Back' as const,
      headerLeft: (props: any) => (
        <HeaderBackButton {...props} onPress={exitCityGuide} />
      ),
    }),
    [exitCityGuide],
  );

  if (loading) {
    return (
      <>
        <Stack.Screen options={cityGuideHeaderOptions} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen options={cityGuideHeaderOptions} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </>
    );
  }

  if (!bandit) {
    return (
      <>
        <Stack.Screen options={cityGuideHeaderOptions} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Bandit not found</Text>
        </View>
      </>
    );
  }

  const scrollToRecommendationIndex = (index: number) => {
    if (!recommendationScrollRef.current) return;
    const clamped = Math.max(0, Math.min(filteredEvents.length - 1, index));
    const offsetX = clamped * (recommendationCardWidth + recommendationGap);
    recommendationScrollRef.current.scrollTo({ x: offsetX, animated: true });
    setActiveRecommendationIndex(clamped);
  };

  const renderRecommendationCard = (event: Event, index: number) => {
    const imageUri = finalUniqueRecommendationImageById[event.id] ?? null;
    const showHero = Boolean(imageUri) && !hiddenHeroEventIds.has(event.id);
    const locationLine = [event.neighborhood, event.city].filter(Boolean).join(' · ') || 'Athens';
    const vibeLine = (event.description?.trim() || 'Curated local pick from your banDit guide.').slice(0, 110);
    return (
      <Pressable
        key={event.id}
        style={[
          styles.recommendationCard,
          {
            width: recommendationCardWidth,
            marginRight: isDesktopWeb ? 0 : index === filteredEvents.length - 1 ? 0 : recommendationGap,
            marginBottom: isDesktopWeb ? 16 : 0,
          },
        ]}
        onPress={() =>
          router.push(`/spot/${event.id}?banditId=${encodeURIComponent(bandit.id)}` as never)
        }
      >
        {showHero ? (
          <RecommendationHeroImage
            sourceUri={imageUri as string}
            eventId={event.id}
            onInvalid={() =>
              setHiddenHeroEventIds((prev) => {
                const next = new Set(prev);
                next.add(event.id);
                return next;
              })
            }
          />
        ) : null}
        <View style={styles.recommendationBody}>
          <View style={styles.recommendationTopMetaRow}>
            <Text style={styles.recommendationCategory}>{event.genre || 'Spot'}</Text>
            <Text style={styles.recommendationLocation} numberOfLines={1}>
              {locationLine}
            </Text>
          </View>
          <Text style={styles.recommendationTitle} numberOfLines={2}>
            {event.name}
          </Text>
          <Text style={styles.recommendationVibe} numberOfLines={2}>
            {vibeLine}
          </Text>
          <View style={styles.recommendationFooterRow}>
            <View style={styles.recommendationCtaPill}>
              <Text style={styles.recommendationCta}>Open</Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <>
      <Stack.Screen options={cityGuideHeaderOptions} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={cityGuideRefresh}
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
              {`Yo, traveler. Your adventure just got upgraded.\nWelcome to the side of the city locals don't usually share.\nYou've officially entered the bandiVerse. Let's go rogue.`}
            </Text>

            <View style={styles.profileImageContainer}>
              {(() => {
                const raw = bandit.image_url?.trim();
                const validUrl = raw && /^https?:\/\//i.test(raw) ? raw : null;
                if (!avatarLoadFailed && validUrl) {
                  return (
                    <BanditProfileHeroMedia
                      variant="fixedSquare"
                      squareSize={88}
                      source={{ uri: validUrl }}
                      accessibilityLabel={`${bandit.name ?? ''} portrait`.trim()}
                      onError={() => setAvatarLoadFailed(true)}
                    />
                  );
                }
                return (
                  <View style={styles.profileImageFallback}>
                    <LocalBanditOctopusIcon />
                  </View>
                );
              })()}
            </View>

          </View>
        </View>

        {/* Event Categories - driven by event data (do not gate on separate spots dataset). */}
        {eventCategories.length > 0 && (
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

        {/* Recommendations carousel */}
        <View style={styles.recommendationsSection}>
          <View style={styles.recommendationsHeadRow}>
            <Text style={styles.recommendationsTitle}>
              {selectedGenre ? `${selectedGenre} picks` : 'Recommended picks'}
            </Text>
            {isDesktopWeb && filteredEvents.length > 1 ? (
              <View style={styles.recommendationArrowsRow}>
                <Pressable
                  style={[styles.recommendationArrowBtn, activeRecommendationIndex === 0 && styles.recommendationArrowBtnDisabled]}
                  disabled={activeRecommendationIndex === 0}
                  onPress={() => scrollToRecommendationIndex(activeRecommendationIndex - 1)}
                >
                  <Text style={styles.recommendationArrowText}>‹</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.recommendationArrowBtn,
                    activeRecommendationIndex >= filteredEvents.length - 1 && styles.recommendationArrowBtnDisabled,
                  ]}
                  disabled={activeRecommendationIndex >= filteredEvents.length - 1}
                  onPress={() => scrollToRecommendationIndex(activeRecommendationIndex + 1)}
                >
                  <Text style={styles.recommendationArrowText}>›</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
          <Text style={styles.recommendationsHint}>
            {isDesktopWeb ? 'Expanded inline grid of curated local picks.' : 'Swipe left to browse curated local picks.'}
          </Text>
          {filteredEvents.length === 0 ? (
            <Text style={styles.recommendationsEmpty}>No recommendations in this category yet.</Text>
          ) : (
            <>
              {isDesktopWeb ? (
                <View style={styles.recommendationsDesktopGrid}>
                  {filteredEvents.map((event, index) => renderRecommendationCard(event, index))}
                </View>
              ) : (
                <View style={styles.recommendationsCarouselFrame}>
                  <ScrollView
                    ref={recommendationScrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={[
                      styles.recommendationsTrack,
                      {
                        paddingRight: Math.max(20, recommendationsContainerWidth - recommendationCardWidth - 18),
                      },
                    ]}
                    decelerationRate="fast"
                    snapToInterval={recommendationCardWidth + recommendationGap}
                    snapToAlignment="start"
                    disableIntervalMomentum
                    onMomentumScrollEnd={(e) => {
                      const x = e.nativeEvent.contentOffset.x;
                      const idx = Math.round(x / (recommendationCardWidth + recommendationGap));
                      setActiveRecommendationIndex(Math.max(0, Math.min(filteredEvents.length - 1, idx)));
                    }}
                  >
                    {filteredEvents.map((event, index) => renderRecommendationCard(event, index))}
                  </ScrollView>
                </View>
              )}
              {!isDesktopWeb && filteredEvents.length > 1 ? (
                <View style={styles.recommendationDotsRow}>
                  {filteredEvents.map((e, idx) => (
                    <View
                      key={e.id}
                      style={[styles.recommendationDot, idx === activeRecommendationIndex && styles.recommendationDotActive]}
                    />
                  ))}
                </View>
              ) : null}
            </>
          )}
        </View>

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
    paddingBottom: 36,
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
    marginBottom: 16,
  },
  profileImageFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFEFEF',
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
  recommendationsSection: {
    marginTop: 10,
    marginBottom: 20,
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
  },
  recommendationsHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  recommendationsTitle: {
    fontFamily: 'Caros',
    fontWeight: '800',
    fontSize: 18,
    color: '#1e1e1e',
  },
  recommendationsHint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  recommendationsCarouselFrame: {
    width: '100%',
    overflow: 'visible',
  },
  recommendationsTrack: {
    paddingLeft: 2,
  },
  recommendationsDesktopGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  recommendationCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  recommendationImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: 'transparent',
  },
  recommendationBody: {
    padding: 14,
  },
  recommendationTopMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    alignItems: 'center',
    gap: 8,
  },
  recommendationCategory: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B6B6B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    backgroundColor: '#F1F1F1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  recommendationTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#161616',
    marginBottom: 8,
  },
  recommendationVibe: {
    fontSize: 14,
    color: '#4f4f4f',
    lineHeight: 20,
    marginBottom: 12,
  },
  recommendationFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  recommendationLocation: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  recommendationCtaPill: {
    backgroundColor: '#111',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  recommendationCta: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  recommendationArrowsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  recommendationArrowBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#D8D8D8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  recommendationArrowBtnDisabled: {
    opacity: 0.35,
  },
  recommendationArrowText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f1f1f',
    marginTop: -2,
  },
  recommendationDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  recommendationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D0D0D0',
  },
  recommendationDotActive: {
    width: 16,
    backgroundColor: '#303030',
  },
  recommendationsEmpty: {
    fontSize: 14,
    color: '#777',
    paddingVertical: 6,
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
