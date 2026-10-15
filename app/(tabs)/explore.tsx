import {
  getEventBanditRecommendationsBulk,
  getEvents,
  getUserLikedEvents,
  toggleEventLike,
  type EventBanditRecommendation,
} from '@/app/services/events';
import EventCard from '@/components/EventCard';
import ExploreCategoryChips from '@/components/ExploreCategoryChips';
import { useCity } from '@/contexts/CityContext';
import { exploreEventsCacheKey, hydrateExploreEventsFromDisk, persistExploreEventsSnapshot } from '@/lib/exploreEventsCache';
import { fetchSWR, readCacheStale } from '@/lib/appDataCache';
import { Database } from '@/lib/database.types';
import {
  exploreChipFromGenreParam,
  filterEventsByExploreCategory,
  type ExploreCategoryChip,
} from '@/lib/exploreCategoryFilter';
import { useUpperTabHost } from '@/contexts/UpperTabHostContext';
import { useTabActiveDataLoad } from '@/lib/useTabActiveDataLoad';
import { useScreenFocused } from '@/lib/useScreenFocused';
import { useGuestLiveSurface } from '@/lib/orchestra/useGuestLiveSurface';
import { usePremiumRefreshControl } from '@/lib/mobilePullToRefresh';
import { navigateToBanditProfile, runSafeNavigation } from '@/lib/appNavigation';
import { buildEventListImagePlan, type EventListImageScope } from '@/lib/eventListImagePlan';
import { eventHasVenueMediaSource, getSpotDetailHeroUri } from '@/lib/eventVenueGallery';
import {
  fetchGooglePlacePhotoUrls,
  fetchTrustedPlaceIdPhotoUrls,
  isDurableVenuePhotoUri,
  isEphemeralPlacesMediaUrl,
  isGooglePlacesDerivedPhotoUrl,
  normalizeEventImageUri,
} from '@/lib/placePhoto';
import { resolveApprovedListHeroUrisByEventId } from '@/lib/recommendationImages';
import { logNativeNav } from '@/lib/nativeNavLog';
import { perfMark } from '@/lib/perfTiming';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ExploreMapPanel from '@/components/ExploreMapPanel';
import ExploreBanditLane from '@/components/ExploreBanditLane';

type Event = Database['public']['Tables']['event']['Row'];

const EXPLORE_CACHE_TTL_MS = 5 * 60 * 1000;
/** Avoid per-card recommendation fetches storming the JS thread on Android. */
const ANDROID_BANDIT_BULK_DEBOUNCE_MS = 200;
const BANDIT_BULK_DEBOUNCE_MS = Platform.OS === 'android' ? ANDROID_BANDIT_BULK_DEBOUNCE_MS : 80;
const ANDROID_BANDIT_BULK_FIRST_BATCH = 10;

type ExploreRowProps = {
  item: Event;
  columns: number;
  banditId?: string;
  isLiked: boolean;
  onLike: () => void;
  onPressSpot: () => void;
  recommendingBandits?: EventBanditRecommendation[];
  onBanditPress: (banditId: string) => void;
  listImageScope?: EventListImageScope;
  resolvedRecommendationImageUri?: string | null;
  recommendationHeroResolverReady?: boolean;
  onHeroUnavailable?: (eventId: string) => void;
};

const ExploreEventRow = React.memo(function ExploreEventRow({
  item,
  columns,
  banditId,
  isLiked,
  onLike,
  onPressSpot,
  recommendingBandits,
  onBanditPress,
  listImageScope,
  resolvedRecommendationImageUri,
  recommendationHeroResolverReady,
  onHeroUnavailable,
}: ExploreRowProps) {
  const resolved = resolvedRecommendationImageUri ?? null;
  // Only skip per-card Places when parent already has a durable (non-Google-ephemeral) hero.
  const skipGoogle =
    Boolean(resolved) &&
    /^https?:\/\//i.test(resolved!) &&
    isDurableVenuePhotoUri(resolved) &&
    !isEphemeralPlacesMediaUrl(resolved) &&
    !isGooglePlacesDerivedPhotoUrl(resolved);

  return (
    <View style={[styles.cardWrap, columns > 1 && styles.cardWrapMulti]}>
      <EventCard
        event={item}
        onLike={onLike}
        isLiked={isLiked}
        variant="horizontal"
        fillHorizontalCell
        showRecommendations
        skipGooglePhotoFetch={skipGoogle}
        omitWhenNoHero
        onHeroUnavailable={onHeroUnavailable}
        splitTouchTargets={Platform.OS !== 'web'}
        preloadedRecommendingBandits={recommendingBandits ?? []}
        onBanditPress={onBanditPress}
        banditId={banditId}
        listImageScope={listImageScope}
        resolvedRecommendationImageUri={resolved}
        recommendationHeroResolverReady={recommendationHeroResolverReady ?? true}
        strictRecommendationImagePolicy={false}
        onPress={onPressSpot}
      />
    </View>
  );
}, (prev, next) => {
  const prevB = prev.recommendingBandits;
  const nextB = next.recommendingBandits;
  const banditsEqual =
    prevB === nextB ||
    (prevB === undefined && nextB === undefined) ||
    (prevB !== undefined &&
      nextB !== undefined &&
      prevB.length === nextB.length &&
      prevB.every((b, i) => b.id === nextB[i]?.id));
  return (
    prev.item.id === next.item.id &&
    prev.isLiked === next.isLiked &&
    prev.columns === next.columns &&
    prev.banditId === next.banditId &&
    prev.listImageScope === next.listImageScope &&
    prev.resolvedRecommendationImageUri === next.resolvedRecommendationImageUri &&
    prev.recommendationHeroResolverReady === next.recommendationHeroResolverReady &&
    prev.onHeroUnavailable === next.onHeroUnavailable &&
    banditsEqual
  );
});

type ExploreScreenProps = {
  tabActive?: boolean;
};

export function ExploreScreen({ tabActive }: ExploreScreenProps = {}) {
  const navFocused = useScreenFocused();
  const screenActive = tabActive ?? navFocused;
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { selectedCity } = useCity();
  const params = useLocalSearchParams<{ banditId?: string; genre?: string; view?: string }>();
  const rawBanditId = params.banditId;
  const banditId = Array.isArray(rawBanditId) ? rawBanditId[0] : rawBanditId;
  const rawGenre = params.genre;
  const selectedGenre = Array.isArray(rawGenre) ? rawGenre[0] : rawGenre;
  const exploreCacheKey = useMemo(
    () => exploreEventsCacheKey(selectedCity, banditId, selectedGenre),
    [selectedCity, banditId, selectedGenre],
  );

  const exploreInitialLoadDoneRef = useRef(false);
  const diskHydratedRef = useRef(false);

  const [events, setEvents] = useState<Event[]>(() => readCacheStale<Event[]>(exploreCacheKey) ?? []);
  const [likedEventIds, setLikedEventIds] = useState<Set<string>>(new Set());
  const likedEventIdsRef = useRef(likedEventIds);
  likedEventIdsRef.current = likedEventIds;
  const [likesEpoch, setLikesEpoch] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [backgroundLoading, setBackgroundLoading] = useState(
    () => (readCacheStale<Event[]>(exploreCacheKey) ?? []).length === 0,
  );
  const [error, setError] = useState<string | null>(null);
  const [categoryChip, setCategoryChip] = useState<ExploreCategoryChip>(() =>
    exploreChipFromGenreParam(selectedGenre),
  );
  const rawView = params.view;
  const openMapParam = Array.isArray(rawView) ? rawView[0] : rawView;
  const [viewMode, setViewMode] = useState<'list' | 'map'>(() =>
    openMapParam === 'map' ? 'map' : 'list',
  );
  /** Defer WebView until user opens Map — mounting under list panes has crashed iOS. */
  const [mapMounted, setMapMounted] = useState(false);
  const [banditsByEventId, setBanditsByEventId] = useState<Map<string, EventBanditRecommendation[]>>(
    () => new Map(),
  );
  const [banditsBulkVersion, setBanditsBulkVersion] = useState(0);
  /** Cards that exhausted gallery + Places recovery — omit from feed (never "Photo unavailable"). */
  const [hiddenHeroEventIds, setHiddenHeroEventIds] = useState<Set<string>>(() => new Set());
  /** Live Place Details heroes for rows whose stored image_url/gallery are expired Places resources. */
  const [liveHeroByEventId, setLiveHeroByEventId] = useState<Record<string, string>>({});

  useEffect(() => {
    setCategoryChip(exploreChipFromGenreParam(selectedGenre));
  }, [selectedGenre]);

  useEffect(() => {
    // New city / genre list → allow previously hidden rows to retry.
    setHiddenHeroEventIds(new Set());
    setLiveHeroByEventId({});
  }, [exploreCacheKey]);

  useEffect(() => {
    if (openMapParam === 'map') {
      setViewMode('map');
      const t = setTimeout(() => setMapMounted(true), Platform.OS === 'ios' ? 400 : 0);
      return () => clearTimeout(t);
    }
  }, [openMapParam]);

  useEffect(() => {
    if (viewMode !== 'map') return;
    const t = setTimeout(() => setMapMounted(true), Platform.OS === 'ios' ? 400 : 0);
    return () => clearTimeout(t);
  }, [viewMode]);

  useEffect(() => {
    if (!screenActive) return;
    void import('@/components/ExploreMapPanel');
  }, [screenActive]);

  const listBottomPad = useMemo(
    () => 72 + (Platform.OS === 'android' ? Math.max(insets.bottom, 12) : Math.max(insets.bottom, 8)) + 16,
    [insets.bottom],
  );

  useEffect(() => {
    if (diskHydratedRef.current) return;
    diskHydratedRef.current = true;
    const timer = setTimeout(() => {
      void (async () => {
        await hydrateExploreEventsFromDisk();
        const stale = readCacheStale<Event[]>(exploreCacheKey);
        if (stale?.length) {
          setEvents(stale);
          setBackgroundLoading(false);
        }
      })();
    }, 0);
    return () => clearTimeout(timer);
  }, [exploreCacheKey]);

  useEffect(() => {
    const stale = readCacheStale<Event[]>(exploreCacheKey);
    if (stale?.length) {
      setEvents(stale);
      setBackgroundLoading(false);
    }
  }, [exploreCacheKey]);

  const runExploreFetch = useCallback(
    (asRefresh: boolean) => {
      if (asRefresh) setRefreshing(true);
      setError(null);
      const cacheKey = exploreEventsCacheKey(selectedCity, banditId, selectedGenre);
      const hadCache = (readCacheStale<Event[]>(cacheKey) ?? []).length > 0;
      if (!hadCache) setBackgroundLoading(true);

      return fetchSWR<Event[]>(
        cacheKey,
        EXPLORE_CACHE_TTL_MS,
        () =>
          getEvents({
            ...(selectedCity ? { city: selectedCity } : {}),
            ...(banditId ? { banditId } : {}),
            ...(selectedGenre ? { genre: selectedGenre } : {}),
          }).then((rows) => rows || []),
        (rows, meta) => {
          setEvents(rows);
          setBackgroundLoading(false);
          setRefreshing(false);
          if (!meta.fromCache) {
            void persistExploreEventsSnapshot(cacheKey, rows);
          }
        },
        (err) => {
          const stale = readCacheStale<Event[]>(cacheKey);
          if (stale?.length) {
            setEvents(stale);
            setError(null);
          } else {
            setError(err instanceof Error ? err.message : 'Could not load Explore.');
          }
          setBackgroundLoading(false);
          setRefreshing(false);
        },
      );
    },
    [selectedCity, banditId, selectedGenre],
  );

  const prevExploreFilterSigRef = useRef<string | null>(null);
  const exploreFilterSig = exploreCacheKey;

  useEffect(() => {
    if (prevExploreFilterSigRef.current === null) {
      prevExploreFilterSigRef.current = exploreFilterSig;
      return;
    }
    if (prevExploreFilterSigRef.current === exploreFilterSig) return;
    prevExploreFilterSigRef.current = exploreFilterSig;
    if (!exploreInitialLoadDoneRef.current) return;
    runExploreFetch(true);
  }, [exploreFilterSig, runExploreFetch]);

  useTabActiveDataLoad(screenActive, exploreInitialLoadDoneRef, runExploreFetch);

  useGuestLiveSurface('experiences', () => {
    runExploreFetch(false);
  });

  useEffect(() => {
    if (!screenActive) return;
    let cancelled = false;
    void getUserLikedEvents()
      .then((liked) => {
        if (cancelled) return;
        setLikedEventIds(new Set(liked.map((e) => e.id)));
        setLikesEpoch((n) => n + 1);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [screenActive]);

  useEffect(() => {
    if (!screenActive) return;
    perfMark('explore_screen_active', 'render');
  }, [screenActive]);

  const toggleLike = useCallback(async (eventId: string) => {
    const currentlyLiked = likedEventIdsRef.current.has(eventId);
    setLikedEventIds((prev) => {
      const next = new Set(prev);
      if (currentlyLiked) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
    setLikesEpoch((n) => n + 1);
    try {
      await toggleEventLike(eventId, currentlyLiked);
    } catch {
      setLikedEventIds((prev) => {
        const next = new Set(prev);
        if (currentlyLiked) next.add(eventId);
        else next.delete(eventId);
        return next;
      });
      setLikesEpoch((n) => n + 1);
    }
  }, []);

  const onPullRefresh = useCallback(async () => {
    const { invalidateAppDataCache } = await import('@/lib/appDataCache');
    invalidateAppDataCache(exploreCacheKey);
    runExploreFetch(true);
  }, [runExploreFetch, exploreCacheKey]);

  const exploreRefreshControl = usePremiumRefreshControl(refreshing, onPullRefresh);

  const title = useMemo(() => {
    if (selectedGenre) return `Explore · ${selectedGenre}`;
    return selectedCity ? `Explore in ${selectedCity}` : 'Explore';
  }, [selectedCity, selectedGenre]);

  const columns = useMemo(() => (width >= 560 ? 2 : 1), [width]);

  const filteredEvents = useMemo(
    () => filterEventsByExploreCategory(events, categoryChip),
    [events, categoryChip],
  );
  const listEvents = useMemo(
    () =>
      filteredEvents.filter(
        (e) => eventHasVenueMediaSource(e) && !hiddenHeroEventIds.has(e.id),
      ),
    [filteredEvents, hiddenHeroEventIds],
  );

  const filteredEventIdsKey = useMemo(
    () => filteredEvents.map((e) => e.id).join('|'),
    [filteredEvents],
  );

  const exploreListImagePlan = useMemo(
    () => buildEventListImagePlan(filteredEvents, { w: 900, h: 675 }),
    [filteredEvents],
  );

  const approvedHeroById = useMemo(
    () => resolveApprovedListHeroUrisByEventId(filteredEvents),
    [filteredEventIdsKey, filteredEvents],
  );

  const resolvedRecommendationImageById = useMemo(() => {
    const out: Record<string, string | null> = {};
    for (const e of filteredEvents) {
      // Live Places refresh wins over stored ephemeral/Google URLs that probes may 200.
      const live = liveHeroByEventId[e.id];
      if (live) {
        out[e.id] = live;
        continue;
      }
      const approved = approvedHeroById[e.id];
      if (approved && isDurableVenuePhotoUri(approved)) {
        out[e.id] = approved;
        continue;
      }
      const stored = getSpotDetailHeroUri(e);
      if (stored && isDurableVenuePhotoUri(stored) && !isGooglePlacesDerivedPhotoUrl(stored)) {
        out[e.id] = stored;
        continue;
      }
      out[e.id] = stored ?? approved ?? null;
    }
    return out;
  }, [filteredEvents, approvedHeroById, liveHeroByEventId]);

  /**
   * Prefer durable heroes; live-refresh missing / ephemeral / Google-derived URLs.
   * Sequential batches of 4 (no Promise.all storm) — drain until queue empty.
   */
  useEffect(() => {
    if (!screenActive) return;
    let cancelled = false;
    const needLive = filteredEvents.filter((e) => {
      if (liveHeroByEventId[e.id]) return false;
      const approved = approvedHeroById[e.id];
      if (approved && isDurableVenuePhotoUri(approved) && !isGooglePlacesDerivedPhotoUrl(approved)) {
        return false;
      }
      const stored = getSpotDetailHeroUri(e);
      if (!stored) return true;
      if (isEphemeralPlacesMediaUrl(stored) || isGooglePlacesDerivedPhotoUrl(stored)) return true;
      return !isDurableVenuePhotoUri(stored);
    });
    if (needLive.length === 0) return;

    void (async () => {
      const heroUpdates: Record<string, string> = {};
      for (let i = 0; i < needLive.length; i += 4) {
        if (cancelled) return;
        const batch = needLive.slice(i, i + 4);
        for (const event of batch) {
          if (cancelled) return;
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
              .filter((u) => /^https?:\/\//i.test(u));
            if (cleaned.length === 0) continue;
            heroUpdates[event.id] = cleaned[0];
          } catch {
            /* EventCard may still recover */
          }
        }
        if (!cancelled && Object.keys(heroUpdates).length > 0) {
          setLiveHeroByEventId((prev) => ({ ...prev, ...heroUpdates }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [screenActive, filteredEventIdsKey, filteredEvents, approvedHeroById, liveHeroByEventId]);

  useEffect(() => {
    if (viewMode !== 'map') return;
    perfMark('explore_map_mode_opened', 'map', { eventCount: filteredEvents.length });
  }, [viewMode, filteredEvents.length]);

  useEffect(() => {
    if (!screenActive || !filteredEventIdsKey) return;
    let cancelled = false;
    const ids = filteredEventIdsKey.split('|').filter(Boolean);
    const timer = setTimeout(() => {
      const loadIds =
        Platform.OS === 'android' && ids.length > ANDROID_BANDIT_BULK_FIRST_BATCH
          ? ids.slice(0, ANDROID_BANDIT_BULK_FIRST_BATCH)
          : ids;
      void getEventBanditRecommendationsBulk(loadIds)
        .then((map) => {
          if (cancelled) return;
          setBanditsByEventId((prev) => {
            const next = new Map(prev);
            for (const [id, rows] of map.entries()) next.set(id, rows);
            return next;
          });
          setBanditsBulkVersion((v) => v + 1);
          if (Platform.OS === 'android' && ids.length > loadIds.length) {
            const rest = ids.slice(loadIds.length);
            void getEventBanditRecommendationsBulk(rest).then((restMap) => {
              if (cancelled) return;
              setBanditsByEventId((prev) => {
                const next = new Map(prev);
                for (const [id, rows] of restMap.entries()) next.set(id, rows);
                return next;
              });
              setBanditsBulkVersion((v) => v + 1);
            });
          }
        })
        .catch(() => {});
    }, BANDIT_BULK_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [screenActive, filteredEventIdsKey]);

  const handleBanditPress = useCallback(
    (id: string) => {
      const trimmed = String(id || '').trim();
      if (!trimmed) return;
      logNativeNav('explore.bandit.press', { banditId: trimmed });
      /** P0 Android: do not defer behind InteractionManager — feels like Explore freeze. */
      runSafeNavigation('explore-bandit-profile', () => {
        navigateToBanditProfile(router, trimmed);
      });
    },
    [router],
  );

  const handleHeroUnavailable = useCallback((eventId: string) => {
    const id = String(eventId || '').trim();
    if (!id) return;
    setHiddenHeroEventIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const goBackToBanditHome = useCallback(() => {
    if (!banditId) return;
    router.push(`/bandits?focusBanditId=${encodeURIComponent(banditId)}` as any);
  }, [banditId, router]);

  const keyExtractor = useCallback((item: Event) => item.id, []);

  const handleNavigateToSpot = useCallback(
    (eventId: string, heroUri?: string | null) => {
      const eid = String(eventId || '').trim();
      if (!eid) return;
      const bid = String(banditId || '').trim();
      const base = bid
        ? `/spot/${encodeURIComponent(eid)}?banditId=${encodeURIComponent(bid)}`
        : `/spot/${encodeURIComponent(eid)}`;
      const hero = String(heroUri || '').trim();
      const url = hero
        ? `${base}${base.includes('?') ? '&' : '?'}heroUri=${encodeURIComponent(hero)}`
        : base;
      runSafeNavigation('explore-spot', () => {
        router.push(url as any);
      });
    },
    [banditId, router],
  );

  const banditsByEventIdRef = useRef(banditsByEventId);
  banditsByEventIdRef.current = banditsByEventId;
  const resolvedHeroRef = useRef(resolvedRecommendationImageById);
  resolvedHeroRef.current = resolvedRecommendationImageById;
  const recoHeroReadyRef = useRef(true);
  recoHeroReadyRef.current = true;
  const exploreListImagePlanRef = useRef(exploreListImagePlan);
  exploreListImagePlanRef.current = exploreListImagePlan;

  const renderEventRow = useCallback(
    ({ item }: { item: Event }) => (
      <ExploreEventRow
        item={item}
        columns={columns}
        banditId={banditId}
        isLiked={likedEventIds.has(item.id)}
        onLike={() => void toggleLike(item.id)}
        onPressSpot={() => handleNavigateToSpot(item.id, resolvedHeroRef.current[item.id] ?? null)}
        recommendingBandits={banditsByEventIdRef.current.get(item.id) ?? []}
        onBanditPress={handleBanditPress}
        listImageScope={exploreListImagePlanRef.current.get(item.id)}
        resolvedRecommendationImageUri={resolvedHeroRef.current[item.id] ?? null}
        recommendationHeroResolverReady={recoHeroReadyRef.current}
        onHeroUnavailable={handleHeroUnavailable}
      />
    ),
    [columns, likesEpoch, banditId, toggleLike, handleNavigateToSpot, handleBanditPress, handleHeroUnavailable],
  );

  const handleCategorySelect = useCallback((chip: ExploreCategoryChip) => {
    if (chip === categoryChip) return;
    setCategoryChip(chip);
  }, [categoryChip]);

  const toggleViewMode = useCallback(() => {
    setViewMode((m) => {
      const next = m === 'list' ? 'map' : 'list';
      if (next === 'map') setMapMounted(true);
      perfMark(`explore_toggle_view:${next}`, 'navigation');
      return next;
    });
  }, []);

  if (error && events.length === 0 && !backgroundLoading) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: '#FFFFFF' }}
        contentContainerStyle={styles.loadingWrap}
        refreshControl={exploreRefreshControl}
      >
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.errorHint}>Pull down to retry.</Text>
      </ScrollView>
    );
  }

  /** Inactive overlay panes must not mount FlatList/WebView (steals JS from navigation). */
  if (!screenActive) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.headerSide}>
          {banditId ? (
            <Pressable onPress={goBackToBanditHome} style={styles.backBtn} hitSlop={10}>
              <Text style={styles.backBtnText}>← Back</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.headerText} numberOfLines={1}>
          {title}
        </Text>
        <View style={[styles.headerSide, styles.headerSideRight]}>
          <Pressable
            style={({ pressed }) => [
              styles.mapBtn,
              viewMode === 'map' && styles.mapBtnActive,
              pressed && styles.mapBtnPressed,
            ]}
            onPress={toggleViewMode}
            delayPressIn={0}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={viewMode === 'map' ? 'List' : 'Map'}
            android_ripple={{ color: 'rgba(255,255,255,0.25)', borderless: false }}
          >
            <Text style={[styles.mapBtnText, viewMode === 'map' && styles.mapBtnTextActive]}>
              {viewMode === 'map' ? 'List' : 'Map'}
            </Text>
          </Pressable>
          {backgroundLoading && events.length === 0 ? (
            <ActivityIndicator size="small" color="#111111" style={styles.headerSpinner} />
          ) : null}
        </View>
      </View>
      <ExploreCategoryChips selected={categoryChip} onSelect={handleCategorySelect} />

      <View style={styles.body}>
        <View
          style={[
            styles.bodyPane,
            viewMode !== 'list' && styles.bodyPaneHidden,
            viewMode === 'list' && styles.bodyPaneActive,
          ]}
          pointerEvents={viewMode === 'list' ? 'auto' : 'none'}
        >
          <FlatList
            style={styles.listFlex}
            data={listEvents}
            key={`explore-list-${columns}`}
            extraData={{ categoryChip, likesEpoch, banditsBulkVersion }}
            keyExtractor={keyExtractor}
            numColumns={columns}
            refreshControl={exploreRefreshControl}
            columnWrapperStyle={columns > 1 ? styles.row : undefined}
            contentContainerStyle={[styles.gridContent, { paddingBottom: listBottomPad }]}
            ListHeaderComponent={
              !banditId ? (
                <ExploreBanditLane
                  onMeet={handleBanditPress}
                  onSeeAll={() =>
                    runSafeNavigation('explore-bandits-all', () => router.push('/bandits' as any))
                  }
                />
              ) : null
            }
            ListEmptyComponent={
              backgroundLoading ? (
                <Text style={styles.emptyText}>Loading places…</Text>
              ) : events.length === 0 ? (
                <Text style={styles.emptyText}>No places found in Explore yet.</Text>
              ) : (
                <Text style={styles.emptyText}>
                  {`No ${categoryChip === 'All' ? '' : `${categoryChip} `}places in this view yet.`}
                </Text>
              )
            }
            initialNumToRender={Platform.OS === 'web' ? 8 : Platform.OS === 'android' ? 3 : 5}
            maxToRenderPerBatch={Platform.OS === 'android' ? 2 : 4}
            windowSize={Platform.OS === 'android' ? 3 : 5}
            updateCellsBatchingPeriod={Platform.OS === 'android' ? 100 : 50}
            removeClippedSubviews={Platform.OS === 'android'}
            renderItem={renderEventRow}
          />
        </View>
        {mapMounted ? (
          <View
            style={[
              styles.bodyPane,
              viewMode !== 'map' && styles.bodyPaneHidden,
              viewMode === 'map' && styles.bodyPaneActive,
              viewMode === 'map' && styles.mapBodyPane,
            ]}
            pointerEvents={viewMode === 'map' ? 'auto' : 'none'}
          >
            <ExploreMapPanel
              events={filteredEvents}
              banditId={banditId}
              onOpenSpot={handleNavigateToSpot}
              onBanditPress={handleBanditPress}
              banditsByEventId={banditsByEventId}
              heroUriByEventId={resolvedRecommendationImageById}
              listBottomPad={Math.max(insets.bottom, 8) + 72}
              isLiked={(eventId) => likedEventIds.has(eventId)}
              onLike={(eventId) => void toggleLike(eventId)}
              visible={viewMode === 'map'}
              onRequestListMode={() => setViewMode('list')}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  body: { flex: 1, minHeight: 0 },
  bodyPane: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
  },
  bodyPaneActive: {
    opacity: 1,
    zIndex: 2,
  },
  bodyPaneHidden: {
    opacity: 0,
    zIndex: 0,
  },
  mapBodyPane: {
    minHeight: 520,
  },
  listFlex: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 12,
    minHeight: 52,
  },
  headerSide: {
    minWidth: 72,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  headerSideRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  headerSpinner: {
    marginLeft: 4,
  },
  headerText: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#3C3C3C',
    textAlign: 'center',
  },
  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  mapBtn: {
    backgroundColor: '#111',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minWidth: 52,
    alignItems: 'center',
  },
  mapBtnActive: {
    backgroundColor: '#111111',
  },
  mapBtnPressed: {
    opacity: 0.88,
  },
  mapBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  mapBtnTextActive: {
    color: '#FFF',
  },
  mapLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  gridContent: {
    paddingHorizontal: 12,
    paddingBottom: 108,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  row: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
    paddingHorizontal: 4,
    maxWidth: '100%',
    width: '100%',
    alignSelf: 'stretch',
  },
  cardWrap: {
    width: '100%',
    minWidth: 0,
    maxWidth: '100%',
  },
  cardWrapMulti: {
    flex: 1,
    flexBasis: 0,
  },
  emptyText: {
    textAlign: 'center',
    color: '#777',
    marginTop: 30,
    fontSize: 14,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  errorText: {
    color: '#CC2A2A',
    fontSize: 14,
    paddingHorizontal: 16,
    textAlign: 'center',
  },
  errorHint: {
    marginTop: 12,
    fontSize: 13,
    color: '#777',
    textAlign: 'center',
  },
});

export default function ExploreTabRoute() {
  const { enabled } = useUpperTabHost();
  if (enabled) return null;
  return <ExploreScreen />;
}
