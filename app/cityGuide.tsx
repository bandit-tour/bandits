import { useFocusEffect } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { usePremiumRefreshControl } from '@/lib/mobilePullToRefresh';
import { Image as ExpoImage } from 'expo-image';

import { getSpotsByBanditId } from '@/services/spots';
import { getEvents, getUserLikedEventIds, toggleEventLike } from '@/app/services/events';
import { getTrailsByBanditId, TrailWithStops } from '@/services/trails';
import type { GeneratedTrail } from '@/services/aiTrails';
import EventCategories from '@/components/EventCategories';
import LeafletMapView from '@/components/LeafletMapView';
import TrailCard from '@/components/TrailCard';
import TrailDetailView from '@/components/TrailDetailView';
import { EVENT_GENRES, EventGenre } from '@/constants/Genres';
import { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { trackEvent } from '@/lib/analytics';
import { getEventVenueGalleryOrdered } from '@/lib/eventVenueGallery';
import {
  fetchGooglePlacePhotoUrls,
  fetchTrustedPlaceIdPhotoUrls,
  normalizeEventImageUri,
} from '@/lib/placePhoto';
import { markHeroUriFailed } from '@/lib/venueHeroRecovery';
import { buildTastefulCategoryIllustration } from '@/lib/recommendationImages';
import { readGuideView, writeGuideView, markGuideReturn, type GuideCamera } from '@/lib/guideViewMemory';
import { ATHENS_CENTER } from '@/lib/mapCoordinates';
import { ensureAnonymousSession } from '@/lib/pilotSession';
import { repairDisplayText } from '@/lib/repairTextEncoding';
import { useAppBackScreenOptions } from '@/hooks/useAppBackScreenOptions';
import type { Href } from 'expo-router';

type Bandit = Database['public']['Tables']['bandit']['Row'];
type Event = Database['public']['Tables']['event']['Row'];
type Spot = Database['public']['Tables']['spots']['Row'];

function loadableCityGuidePhotoUris(event: Event): string[] {
  const out: string[] = [];
  for (const raw of getEventVenueGalleryOrdered(event)) {
    const n = normalizeEventImageUri(raw) ?? String(raw ?? '').trim();
    if (!n || !/^https?:\/\//i.test(n) || out.includes(n)) continue;
    out.push(n);
  }
  return out;
}

function readableLoadError(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message && err.message !== '[object Object]') return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    const message = String((err as { message?: unknown }).message ?? '');
    if (message && message !== '[object Object]') return message;
  }
  return fallback;
}

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
  // One inline retry for transient mobile network blips before we surface a fallback image.
  // expo-image fires `onError` for any load failure (DNS hiccup, slow 3G timeout, server 5xx);
  // a permanent gray placeholder for an otherwise-valid Google Places URL is worse UX than retrying once.
  const [retryAttempt, setRetryAttempt] = useState(0);
  useEffect(() => {
    setRetryAttempt(0);
  }, [sourceUri]);
  const effectiveUri = sourceUri;
  return (
    <ExpoImage
      key={`${eventId}-${retryAttempt}`}
      source={{ uri: effectiveUri }}
      cachePolicy="memory-disk"
      style={styles.recommendationImage}
      contentFit="cover"
      transition={120}
      accessibilityLabel={`recommendation-hero:${eventId}`}
      accessibilityRole="image"
      onError={() => {
        if (retryAttempt < 1) {
          setRetryAttempt((n) => n + 1);
          return;
        }
        onInvalid();
      }}
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
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [camera, setCamera] = useState<GuideCamera | null>(null);
  /** Live Places refresh when MVP rows only store expired/incomplete Places resource URLs. */
  const [liveHeroByEventId, setLiveHeroByEventId] = useState<Record<string, string>>({});
  const [failedHeroUris, setFailedHeroUris] = useState<Record<string, true>>({});
  const [liveRecoveryDoneIds, setLiveRecoveryDoneIds] = useState<Record<string, true>>({});
  const recommendationScrollRef = useRef<ScrollView>(null);
  const pageScrollRef = useRef<ScrollView>(null);
  const restoredScroll = useRef(false);
  const hydratedGuide = useRef(false);

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
        await ensureAnonymousSession().catch(() => undefined);

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
        const msg = readableLoadError(err, 'Could not load City Guide');
        const soft =
          /failed to fetch|network|load failed|timeout|abort/i.test(msg)
            ? 'Connection issue — pull to refresh or try again in a moment.'
            : msg || 'Could not load City Guide';
        setError(soft);
        setAllSpots([]);
        setTrails([]);
        setEvents([]);
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
  const cityGuideHeroUriById = useMemo(() => {
    const out: Record<string, string | null> = {};
    for (const e of filteredEvents) {
      const liveRaw = liveHeroByEventId[e.id];
      const live = liveRaw ? normalizeEventImageUri(liveRaw) ?? liveRaw : '';
      if (live && !failedHeroUris[live]) {
        out[e.id] = live;
        continue;
      }
      const stored = loadableCityGuidePhotoUris(e).find((u) => !failedHeroUris[u]) ?? null;
      const waitingForFreshPlaces =
        Boolean(stored?.includes('places.googleapis.com')) && !liveRecoveryDoneIds[e.id];
      out[e.id] = waitingForFreshPlaces ? null : stored;
    }
    return out;
  }, [failedHeroUris, filteredEvents, liveHeroByEventId, liveRecoveryDoneIds]);

  useEffect(() => {
    let cancelled = false;
    const needLive = filteredEvents.filter((e) => {
      if (liveRecoveryDoneIds[e.id]) return false;
      const liveRaw = liveHeroByEventId[e.id];
      const live = liveRaw ? normalizeEventImageUri(liveRaw) ?? liveRaw : '';
      if (live && !failedHeroUris[live]) return false;
      const stored = loadableCityGuidePhotoUris(e).find((u) => !failedHeroUris[u]) ?? null;
      if (!stored) return true;
      return stored.includes('places.googleapis.com');
    });
    if (needLive.length === 0) return;

    void (async () => {
      const heroUpdates: Record<string, string> = {};
      const doneUpdates: Record<string, true> = {};
      for (let i = 0; i < needLive.length; i += 4) {
        if (cancelled) return;
        const batch = needLive.slice(i, i + 4);
        const refreshed = await Promise.all(
          batch.map(async (event) => {
            doneUpdates[event.id] = true;
            try {
              const placeId = (event as { google_place_id?: string | null }).google_place_id ?? null;
              let urls = placeId ? await fetchTrustedPlaceIdPhotoUrls(placeId, 4) : [];
              if (urls.length === 0) {
                urls = await fetchGooglePlacePhotoUrls({
                  placeId,
                  name: String(event.name ?? ''),
                  address: String(event.address ?? ''),
                  city: String(event.city ?? ''),
                  neighborhood: String(event.neighborhood ?? ''),
                  limit: 4,
                });
              }
              const cleaned = urls
                .map((u) => normalizeEventImageUri(u) ?? u)
                .filter((u) => /^https?:\/\//i.test(u) && !failedHeroUris[u]);
              return cleaned[0] ? ([event.id, cleaned[0]] as const) : null;
            } catch {
              return null;
            }
          }),
        );
        if (cancelled) return;
        for (const row of refreshed) {
          if (row) heroUpdates[row[0]] = row[1];
        }
        if (!cancelled) {
          if (Object.keys(heroUpdates).length > 0) {
            setLiveHeroByEventId((prev) => ({ ...prev, ...heroUpdates }));
          }
          setLiveRecoveryDoneIds((prev) => ({ ...prev, ...doneUpdates }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filteredEvents, liveHeroByEventId, failedHeroUris, liveRecoveryDoneIds]);

  useEffect(() => {
    if (activeRecommendationIndex >= filteredEvents.length) {
      setActiveRecommendationIndex(0);
    }
  }, [filteredEvents.length, activeRecommendationIndex]);

  useEffect(() => {
    const id = effectiveBanditId;
    if (!id || hydratedGuide.current) return;
    hydratedGuide.current = true;
    const mem = readGuideView('city', id);
    if (!mem) return;
    if (!genreParam && mem.genre) setSelectedGenre(mem.genre);
    if (mem.selectedEventId) setSelectedEventId(mem.selectedEventId);
    if (mem.cardIndex) setActiveRecommendationIndex(mem.cardIndex);
    if (mem.camera && mem.camera.zoom >= 11) setCamera(mem.camera);
  }, [effectiveBanditId, genreParam]);

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

  const backFallback = useMemo(() => {
    const bid = String(banditIdParam ?? effectiveBanditId ?? bandit?.id ?? '').trim();
    return (bid ? `/bandit/${bid}` : '/bandits') as Href;
  }, [banditIdParam, effectiveBanditId, bandit?.id]);

  const firstName = (bandit?.name || 'Local').trim().split(/\s+/)[0] || 'Local';
  const athensTitle = `${firstName}'s Athens`;
  const placeCount = filteredEvents.length;
  const voiceLine =
    repairDisplayText(String(bandit?.description || '').trim()).slice(0, 160) ||
    `Welcome to ${firstName}'s Athens — places locals actually go, not a tourism dump.`;

  const cityGuideHeaderOptions = useAppBackScreenOptions({
    title: bandit ? athensTitle : 'City Guide',
    fallback: backFallback,
    showBack: true,
  });

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
    const next = filteredEvents[clamped];
    if (next) {
      setSelectedEventId(next.id);
      writeGuideView('city', bandit.id, { selectedEventId: next.id, cardIndex: clamped, genre: selectedGenre });
    }
  };

  const renderRecommendationCard = (event: Event, index: number) => {
    const fromGallery = cityGuideHeroUriById[event.id] ?? null;
    const locationLine = [event.neighborhood, event.city].filter(Boolean).join(' · ') || 'Athens';
    const vibeLine = repairDisplayText(
      (event.description?.trim() || 'Curated local pick from your banDit guide.').slice(0, 110),
    );
    const openSpot = () => {
      setSelectedEventId(event.id);
      if (bandit?.id) {
        writeGuideView('city', bandit.id, { selectedEventId: event.id, cardIndex: index, genre: selectedGenre });
        markGuideReturn(`/cityGuide?banditId=${encodeURIComponent(bandit.id)}`);
      }
      const hero = fromGallery ? encodeURIComponent(fromGallery) : '';
      const qs = [
        `banditId=${encodeURIComponent(bandit.id)}`,
        hero ? `heroUri=${hero}` : '',
      ]
        .filter(Boolean)
        .join('&');
      router.push(`/spot/${event.id}?${qs}` as never);
    };
    const selected = selectedEventId === event.id;
    return (
      <Pressable
        key={event.id}
        nativeID={`city-guide-card-${event.id}`}
        testID={`city-guide-card-${event.id}`}
        style={[
          styles.recommendationCard,
          selected && styles.recommendationCardSelected,
          {
            width: recommendationCardWidth,
            marginRight: isDesktopWeb ? 0 : index === filteredEvents.length - 1 ? 0 : recommendationGap,
            marginBottom: isDesktopWeb ? 16 : 0,
          },
        ]}
        onPress={openSpot}
      >
        {fromGallery ? (
          <RecommendationHeroImage
            sourceUri={fromGallery}
            eventId={event.id}
            onInvalid={() => {
              setFailedHeroUris((prev) => markHeroUriFailed(prev, fromGallery));
              setLiveHeroByEventId((prev) => {
                const current = prev[event.id];
                if (!current) return prev;
                const normalized = normalizeEventImageUri(current) ?? current;
                if (current !== fromGallery && normalized !== fromGallery) return prev;
                const next = { ...prev };
                delete next[event.id];
                return next;
              });
            }}
          />
        ) : liveRecoveryDoneIds[event.id] ? (
          <ExpoImage
            source={{ uri: buildTastefulCategoryIllustration(event.name || 'Local place', event.genre) }}
            style={styles.recommendationImage}
            contentFit="cover"
            accessibilityLabel={`recommendation-fallback:${event.id}`}
          />
        ) : (
          <View style={styles.heroPendingApproval}>
            <ActivityIndicator color="#666" />
          </View>
        )}
        <View style={styles.recommendationBody}>
          <View style={styles.recommendationTopMetaRow}>
            <Text style={styles.recommendationCategory}>{event.genre || 'Spot'}</Text>
            <Text style={styles.recommendationLocation} numberOfLines={1}>
              {locationLine}
            </Text>
          </View>
          <Text style={styles.recommendationTitle} numberOfLines={2}>
            {repairDisplayText(event.name || '')}
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
        ref={pageScrollRef}
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={cityGuideRefresh}
        scrollEventThrottle={32}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          if (y === 0 && !restoredScroll.current) return;
          writeGuideView('city', bandit.id, { scrollY: y });
        }}
        onLayout={() => {
          if (restoredScroll.current) return;
          const mem = readGuideView('city', bandit.id);
          if (!mem?.scrollY) return;
          restoredScroll.current = true;
          pageScrollRef.current?.scrollTo({ y: mem.scrollY, animated: false });
        }}
      >
        {/* Header — personal curated, not generic City Guide dump */}
        <Text style={styles.headerText}>{athensTitle}</Text>
        <Text style={styles.placesCountLine}>
          {placeCount > 0
            ? `${firstName}'s ${placeCount} places · photo-led · ${firstName}'s voice`
            : `${firstName}'s curated Athens`}
        </Text>

        {/* Bandit Profile Section — full-bleed portrait, not 88px circle */}
        <View style={styles.profileSection}>
          <View style={styles.heroPortraitWrap}>
            {(() => {
              const raw = (bandit.image_url || bandit.face_image_url)?.trim();
              const validUrl = raw && /^https?:\/\//i.test(raw) ? raw : null;
              if (!avatarLoadFailed && validUrl) {
                return (
                  <ExpoImage
                    source={{ uri: validUrl }}
                    style={styles.heroPortrait}
                    contentFit="cover"
                    contentPosition={{ top: 0, left: '50%' }}
                    transition={160}
                    cachePolicy="memory-disk"
                    accessibilityLabel={`${bandit.name ?? ''} portrait`.trim()}
                    onError={() => setAvatarLoadFailed(true)}
                  />
                );
              }
              return (
                <Image
                  source={require('@/assets/images/play_athens_bg.png')}
                  style={styles.heroPortrait}
                  resizeMode="cover"
                  accessibilityLabel="Athens"
                />
              );
            })()}
          </View>
          <Text style={styles.descriptionText}>{voiceLine}</Text>
        </View>

        {/* Event Categories - driven by event data (do not gate on separate spots dataset). */}
        {eventCategories.length > 0 && (
          <>
            <Text style={styles.interestsText}>{`What ${firstName} knows`}</Text>
            <EventCategories
              categories={eventCategories}
              selectedGenre={selectedGenre}
              onCategoryPress={(genre) => {
              const next = selectedGenre === genre ? '' : genre;
              setSelectedGenre(next);
              writeGuideView('city', bandit.id, { genre: next });
            }}
            />
          </>
        )}

        {/* Curated Trails */}
        {trails.length > 0 && (
          <>
            <Text style={styles.interestsText}>{`${firstName}'s routes`}</Text>
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
          <Text style={styles.aiPunchline}>{`${firstName}'s midnight loop`}</Text>
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
              <Text style={styles.aiButtonText}>{aiLoading ? 'Finding a vibe…' : `Get ${firstName}'s vibe`}</Text>
              <Text style={styles.aiButtonSubtext}>Pull a trail from local‑coded spots.</Text>
            </View>
          </Pressable>
          {aiTrail && (
            <View style={styles.aiTrailContainer}>
              <Text style={styles.aiTrailLabel}>Trail idea</Text>
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

        {/* Map + photographic cards — this banDit's places, not Explore. */}
        <View testID="city-guide-map-and-cards" style={styles.mapAndCards}>
          <Text style={styles.recommendationsTitle}>{`${firstName}'s map`}</Text>
          <Text style={styles.recommendationsHint}>
            Every mapped place in this guide. A pin and its card stay together.
          </Text>
          <View testID="city-guide-map" style={[styles.guideMapFrame, { height: isDesktopWeb ? 380 : 300 }]}>
            <LeafletMapView
              embedded
              preferSeed
              banditId={bandit.id}
              seedEvents={filteredEvents}
              selectedEventId={selectedEventId}
              initialCamera={camera}
              initialRegion={ATHENS_CENTER}
              onMapReady={() => {}}
              onError={() => {}}
              onRegionChange={(region) => {
                if (typeof region?.zoom !== 'number') return;
                const next: GuideCamera = {
                  latitude: region.latitude,
                  longitude: region.longitude,
                  zoom: region.zoom,
                };
                setCamera(next);
                writeGuideView('city', bandit.id, { camera: next });
              }}
              onSelectEvent={(event) => {
                setSelectedEventId(event.id);
                const idx = filteredEvents.findIndex((row) => row.id === event.id);
                if (idx >= 0) scrollToRecommendationIndex(idx);
                writeGuideView('city', bandit.id, { selectedEventId: event.id, cardIndex: Math.max(0, idx) });
              }}
            />
          </View>

        <View style={styles.recommendationsSection}>
          <View style={styles.recommendationsHeadRow}>
            <Text style={styles.recommendationsTitle}>
              {selectedGenre ? `${firstName}'s ${selectedGenre}` : `${firstName}'s picks`}
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
    fontSize: 28,
    color: '#111111',
    textAlign: 'left',
    marginBottom: 4,
  },
  placesCountLine: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B6B6B',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
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
    alignItems: 'stretch',
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  heroPortraitWrap: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 14,
    backgroundColor: '#1A1A1A',
  },
  heroPortrait: {
    width: '100%',
    aspectRatio: 3 / 4,
  },
  profileImageContainer: {
    marginBottom: 16,
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#3C3C3C',
    textAlign: 'left',
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
  recommendationCardSelected: {
    borderColor: '#E03131',
    borderWidth: 2,
  },
  mapAndCards: {
    marginTop: 8,
  },
  guideMapFrame: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: '#E9ECEF',
  },
  recommendationImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: 'transparent',
  },
  heroPendingApproval: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#ECECEC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  heroPendingApprovalText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
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
