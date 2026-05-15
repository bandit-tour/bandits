import { getEvents, toggleEventLike } from '@/app/services/events';
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
import { buildEventListImagePlan } from '@/lib/eventListImagePlan';
import { usePremiumRefreshControl } from '@/lib/mobilePullToRefresh';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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

type Event = Database['public']['Tables']['event']['Row'];

const EXPLORE_CACHE_TTL_MS = 90 * 1000;

export default function Explore() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { selectedCity } = useCity();
  const params = useLocalSearchParams<{ banditId?: string; genre?: string }>();
  const rawBanditId = params.banditId;
  const banditId = Array.isArray(rawBanditId) ? rawBanditId[0] : rawBanditId;
  const rawGenre = params.genre;
  const selectedGenre = Array.isArray(rawGenre) ? rawGenre[0] : rawGenre;
  const exploreCacheKey = useMemo(
    () => exploreEventsCacheKey(selectedCity, banditId, selectedGenre),
    [selectedCity, banditId, selectedGenre],
  );

  const exploreInitialFocusDoneRef = useRef(false);
  const diskHydratedRef = useRef(false);

  const [events, setEvents] = useState<Event[]>(
    () => readCacheStale<Event[]>(exploreCacheKey) ?? [],
  );
  const [likedEventIds, setLikedEventIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [backgroundLoading, setBackgroundLoading] = useState(
    () => (readCacheStale<Event[]>(exploreCacheKey) ?? []).length === 0,
  );
  const [error, setError] = useState<string | null>(null);
  const [categoryChip, setCategoryChip] = useState<ExploreCategoryChip>(() =>
    exploreChipFromGenreParam(selectedGenre),
  );

  useEffect(() => {
    setCategoryChip(exploreChipFromGenreParam(selectedGenre));
  }, [selectedGenre]);

  const listBottomPad = useMemo(
    () => 72 + (Platform.OS === 'android' ? Math.max(insets.bottom, 12) : Math.max(insets.bottom, 8)) + 16,
    [insets.bottom],
  );

  useLayoutEffect(() => {
    if (diskHydratedRef.current) return;
    diskHydratedRef.current = true;
    void (async () => {
      await hydrateExploreEventsFromDisk();
      const stale = readCacheStale<Event[]>(exploreCacheKey);
      if (stale?.length) {
        setEvents(stale);
        setBackgroundLoading(false);
      }
    })();
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

      const handle = fetchSWR<Event[]>(
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
          exploreInitialFocusDoneRef.current = true;
          if (!meta.fromCache) {
            void persistExploreEventsSnapshot(cacheKey, rows);
          }
        },
        (err) => {
          setError(err instanceof Error ? err.message : 'Could not load Explore.');
          setBackgroundLoading(false);
          setRefreshing(false);
          exploreInitialFocusDoneRef.current = true;
        },
      );
      return handle;
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
    if (!exploreInitialFocusDoneRef.current) return;
    runExploreFetch(true);
  }, [exploreFilterSig, runExploreFetch]);

  useFocusEffect(
    useCallback(() => {
      const handle = runExploreFetch(exploreInitialFocusDoneRef.current);
      return () => handle.cancel();
    }, [runExploreFetch]),
  );

  const toggleLike = useCallback(async (eventId: string) => {
    const currentlyLiked = likedEventIds.has(eventId);
    setLikedEventIds((prev) => {
      const next = new Set(prev);
      if (currentlyLiked) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
    try {
      await toggleEventLike(eventId, currentlyLiked);
    } catch {
      setLikedEventIds((prev) => {
        const next = new Set(prev);
        if (currentlyLiked) next.add(eventId);
        else next.delete(eventId);
        return next;
      });
    }
  }, [likedEventIds]);

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

  const exploreListImagePlan = useMemo(
    () => buildEventListImagePlan(filteredEvents, { w: 900, h: 675 }),
    [filteredEvents],
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
      <View style={[styles.cardWrap, columns > 1 && styles.cardWrapMulti]}>
        <EventCard
          event={item}
          onLike={() => void toggleLike(item.id)}
          isLiked={likedEventIds.has(item.id)}
          variant="horizontal"
          fillHorizontalCell
          showRecommendations
          banditId={banditId}
          listImageScope={exploreListImagePlan.get(item.id)}
          onPress={() => handleNavigateToSpot(item.id)}
        />
      </View>
    ),
    [columns, likedEventIds, banditId, exploreListImagePlan, toggleLike, handleNavigateToSpot],
  );

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
          {backgroundLoading && events.length === 0 ? (
            <ActivityIndicator size="small" color="#0a7ea4" style={styles.headerSpinner} />
          ) : (
            <Pressable
              style={styles.mapBtn}
              onPress={() => router.push(`/cityMap${banditId ? `?banditId=${encodeURIComponent(banditId)}` : ''}` as any)}
            >
              <Text style={styles.mapBtnText}>Map</Text>
            </Pressable>
          )}
        </View>
      </View>
      <ExploreCategoryChips selected={categoryChip} onSelect={setCategoryChip} />
      <FlatList
        style={styles.listFlex}
        data={filteredEvents}
        key={`explore-cols-${columns}-${categoryChip}`}
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
        initialNumToRender={Platform.OS === 'android' ? 6 : 8}
        maxToRenderPerBatch={Platform.OS === 'android' ? 4 : 6}
        windowSize={Platform.OS === 'android' ? 5 : 7}
        /** Android: clipped subviews + images often causes missed taps / sluggish first paint. */
        removeClippedSubviews={Platform.OS === 'ios'}
        renderItem={renderEventRow}
      />
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
    minWidth: 88,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  headerSideRight: {
    alignItems: 'flex-end',
  },
  headerSpinner: {
    marginRight: 8,
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
    alignSelf: 'flex-end',
    backgroundColor: '#111',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  mapBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
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
