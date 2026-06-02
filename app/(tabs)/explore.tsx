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
import { usePremiumRefreshControl } from '@/lib/mobilePullToRefresh';
import { perfDumpSummary, perfMark, perfStart } from '@/lib/perfTiming';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  InteractionManager,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Event = Database['public']['Tables']['event']['Row'];

const EXPLORE_CACHE_TTL_MS = 5 * 60 * 1000;

const ExploreMapPanelLazy = React.lazy(() => import('@/components/ExploreMapPanel'));

type ExploreRowProps = {
  item: Event;
  columns: number;
  banditId?: string;
  isLiked: boolean;
  onLike: () => void;
  onPressSpot: () => void;
  recommendingBandits?: EventBanditRecommendation[];
  onBanditPress: (banditId: string) => void;
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
}: ExploreRowProps) {
  return (
    <View style={[styles.cardWrap, columns > 1 && styles.cardWrapMulti]}>
      <EventCard
        event={item}
        onLike={onLike}
        isLiked={isLiked}
        variant="horizontal"
        fillHorizontalCell
        showRecommendations
        skipGooglePhotoFetch
        splitTouchTargets={Platform.OS === 'android'}
        preloadedRecommendingBandits={recommendingBandits}
        onBanditPress={onBanditPress}
        banditId={banditId}
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

  useEffect(() => {
    setCategoryChip(exploreChipFromGenreParam(selectedGenre));
  }, [selectedGenre]);

  useEffect(() => {
    if (openMapParam === 'map') setViewMode('map');
  }, [openMapParam]);

  const [banditsByEventId, setBanditsByEventId] = useState<Map<string, EventBanditRecommendation[]>>(
    () => new Map(),
  );
  const [banditsBulkLoaded, setBanditsBulkLoaded] = useState(false);

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
    if (viewMode === 'map') {
      void import('@/components/ExploreMapPanel');
    }
  }, [viewMode]);

  useEffect(() => {
    if (!screenActive) return;
    perfMark('explore_screen_active', 'render');
    const t = setTimeout(() => perfDumpSummary(), 800);
    return () => clearTimeout(t);
  }, [screenActive]);

  useEffect(() => {
    if (!screenActive || events.length === 0) return;
    perfMark('explore_events_painted', 'render', { count: events.length });
  }, [screenActive, events.length]);

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

  useEffect(() => {
    if (viewMode !== 'map') return;
    perfMark('explore_map_mode_opened', 'map', { eventCount: filteredEvents.length });
  }, [viewMode, filteredEvents.length]);

  const filteredEventIdsKey = useMemo(
    () => filteredEvents.map((e) => e.id).join(','),
    [filteredEvents],
  );

  useEffect(() => {
    if (!screenActive || !filteredEventIdsKey) {
      setBanditsByEventId(new Map());
      setBanditsBulkLoaded(false);
      return;
    }
    let cancelled = false;
    setBanditsBulkLoaded(false);
    const ids = filteredEventIdsKey.split(',').filter(Boolean);
    const load = () => {
      void getEventBanditRecommendationsBulk(ids)
        .then((map) => {
          if (!cancelled) {
            setBanditsByEventId(map);
            setBanditsBulkLoaded(true);
          }
        })
        .catch(() => {
          if (!cancelled) setBanditsBulkLoaded(true);
        });
    };
    const handle =
      Platform.OS === 'android'
        ? InteractionManager.runAfterInteractions(load)
        : (load(), undefined);
    return () => {
      cancelled = true;
      handle?.cancel?.();
    };
  }, [screenActive, filteredEventIdsKey]);

  const handleBanditPress = useCallback(
    (id: string) => {
      router.push(`/bandit/${encodeURIComponent(id)}` as any);
    },
    [router],
  );

  const goBackToBanditHome = useCallback(() => {
    if (!banditId) return;
    router.push(`/bandits?focusBanditId=${encodeURIComponent(banditId)}` as any);
  }, [banditId, router]);

  const keyExtractor = useCallback((item: Event) => item.id, []);

  const handleNavigateToSpot = useCallback(
    (eventId: string) => {
      router.push(
        `${banditId ? `/spot/${eventId}?banditId=${encodeURIComponent(banditId)}` : `/spot/${eventId}`}` as any,
      );
    },
    [banditId, router],
  );

  const renderEventRow = useCallback(
    ({ item }: { item: Event }) => (
      <ExploreEventRow
        item={item}
        columns={columns}
        banditId={banditId}
        isLiked={likedEventIds.has(item.id)}
        onLike={() => void toggleLike(item.id)}
        onPressSpot={() => handleNavigateToSpot(item.id)}
        recommendingBandits={
          banditsBulkLoaded ? banditsByEventId.get(item.id) ?? [] : undefined
        }
        onBanditPress={handleBanditPress}
      />
    ),
    [columns, likesEpoch, banditId, banditsBulkLoaded, banditsByEventId, toggleLike, handleNavigateToSpot, handleBanditPress],
  );

  const toggleViewMode = useCallback(() => {
    setViewMode((m) => {
      const next = m === 'list' ? 'map' : 'list';
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
            style={[styles.mapBtn, viewMode === 'map' && styles.mapBtnActive]}
            onPress={toggleViewMode}
            delayPressIn={0}
            hitSlop={8}
          >
            <Text style={[styles.mapBtnText, viewMode === 'map' && styles.mapBtnTextActive]}>
              {viewMode === 'map' ? 'List' : 'Map'}
            </Text>
          </Pressable>
          {backgroundLoading && events.length === 0 ? (
            <ActivityIndicator size="small" color="#0a7ea4" style={styles.headerSpinner} />
          ) : null}
        </View>
      </View>
      <ExploreCategoryChips selected={categoryChip} onSelect={setCategoryChip} />

      <View style={styles.body}>
        {viewMode === 'list' ? (
          <FlatList
            style={styles.listFlex}
            data={filteredEvents}
            extraData={{ categoryChip, likesEpoch, banditsBulkLoaded, banditsByEventId }}
            keyExtractor={keyExtractor}
            numColumns={columns}
            refreshControl={exploreRefreshControl}
            columnWrapperStyle={columns > 1 ? styles.row : undefined}
            contentContainerStyle={[styles.gridContent, { paddingBottom: listBottomPad }]}
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
            initialNumToRender={Platform.OS === 'web' ? 8 : Platform.OS === 'android' ? 4 : 5}
            maxToRenderPerBatch={Platform.OS === 'android' ? 3 : 4}
            windowSize={Platform.OS === 'android' ? 4 : 5}
            updateCellsBatchingPeriod={Platform.OS === 'android' ? 80 : 50}
            removeClippedSubviews={Platform.OS === 'android'}
            renderItem={renderEventRow}
          />
        ) : (
          <Suspense
            fallback={
              <View style={styles.mapLoading}>
                <ActivityIndicator size="large" color="#0a7ea4" />
              </View>
            }
          >
            <ExploreMapPanelLazy
              events={filteredEvents}
              banditId={banditId}
              onOpenSpot={handleNavigateToSpot}
              onBanditPress={handleBanditPress}
              banditsByEventId={banditsByEventId}
              banditsBulkLoaded={banditsBulkLoaded}
              listBottomPad={Math.max(insets.bottom, 8)}
              isLiked={(eventId) => likedEventIds.has(eventId)}
              onLike={(eventId) => void toggleLike(eventId)}
              visible
            />
          </Suspense>
        )}
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
    color: '#0a7ea4',
  },
  mapBtn: {
    backgroundColor: '#111',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  mapBtnActive: {
    backgroundColor: '#0a7ea4',
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
