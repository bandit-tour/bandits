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
import { invalidateAppDataCache } from '@/lib/appDataCache';
import { buildEventListImagePlan, type EventListImageScope } from '@/lib/eventListImagePlan';
import { eventHasVenueMediaSource, getSpotDetailHeroUri } from '@/lib/eventVenueGallery';
import {
  fetchGooglePlacePhotoUrls,
  fetchTrustedPlaceIdPhotoUrls,
  normalizeEventImageUri,
} from '@/lib/placePhoto';
import { resolveApprovedListHeroUrisByEventId } from '@/lib/recommendationImages';
import {
  eventNeedsLivePlacesHeroRecovery,
  isPreservedApprovedDurableHero,
  markHeroUriFailed,
  selectViewportVenueHeroUri,
} from '@/lib/venueHeroRecovery';
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
  onHeroUriFailed?: (eventId: string, uri: string) => void;
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
  onHeroUriFailed,
}: ExploreRowProps) {
  const resolved = resolvedRecommendationImageUri ?? null;
  // Only skip per-card Places when parent already has a preserved approved durable hero.
  const skipGoogle = isPreservedApprovedDurableHero(resolved);

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
        onHeroUriFailed={onHeroUriFailed}
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
    prev.onHeroUriFailed === next.onHeroUriFailed &&
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
  /** Keep list warm under parked overlay — remounting FlatList costs ~2s on return. */
  const keepWarmRef = useRef(false);
  const likesFetchedAtRef = useRef(0);

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
  /** FlatList extraData only — bumps when bandit bulk loads (not on hero URI writes). */
  const [banditsEpoch, setBanditsEpoch] = useState(0);
  /** Cards that exhausted gallery + Places recovery — omit from feed (never "Photo unavailable"). */
  const [hiddenHeroEventIds, setHiddenHeroEventIds] = useState<Set<string>>(() => new Set());
  /** Live Place Details heroes for rows whose stored image_url/gallery are expired Places resources. */
  const [liveHeroByEventId, setLiveHeroByEventId] = useState<Record<string, string>>({});
  /** Broken URIs must never be re-selected or re-fetched indefinitely. */
  const [failedHeroUris, setFailedHeroUris] = useState<Record<string, true>>({});
  /** Events whose Places recovery batch already ran (success or empty). */
  const [liveRecoveryDoneIds, setLiveRecoveryDoneIds] = useState<Record<string, true>>({});

  useEffect(() => {
    setCategoryChip(exploreChipFromGenreParam(selectedGenre));
  }, [selectedGenre]);

  useEffect(() => {
    // New city / genre list → allow previously hidden rows to retry.
    setHiddenHeroEventIds(new Set());
    setLiveHeroByEventId({});
    setLiveRecoveryDoneIds({});
  }, [exploreCacheKey]);

  const liveHeroByEventIdRef = useRef(liveHeroByEventId);
  liveHeroByEventIdRef.current = liveHeroByEventId;
  const liveRecoveryDoneIdsRef = useRef(liveRecoveryDoneIds);
  liveRecoveryDoneIdsRef.current = liveRecoveryDoneIds;
  const failedHeroUrisRef = useRef(failedHeroUris);
  failedHeroUrisRef.current = failedHeroUris;
  /** Bump when a live URI dies so parent can retry without depending on hero maps. */
  const [recoveryKick, setRecoveryKick] = useState(0);

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
      const staleCached = readCacheStale<Event[]>(cacheKey) ?? [];
      /** Empty arrays from pre-auth RLS misses must not block a real feed forever. */
      if (Array.isArray(staleCached) && staleCached.length === 0) {
        invalidateAppDataCache(cacheKey);
      }
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
          if (!meta.fromCache && rows.length > 0) {
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
    const LIKES_TTL_MS = 5 * 60 * 1000;
    if (Date.now() - likesFetchedAtRef.current < LIKES_TTL_MS && likedEventIdsRef.current.size >= 0 && likesFetchedAtRef.current > 0) {
      return;
    }
    let cancelled = false;
    void getUserLikedEvents()
      .then((liked) => {
        if (cancelled) return;
        likesFetchedAtRef.current = Date.now();
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

  const [banditLaneReady, setBanditLaneReady] = useState(false);
  useEffect(() => {
    if (!screenActive) return;
    if (banditLaneReady) return;
    const t = setTimeout(() => setBanditLaneReady(true), 450);
    return () => clearTimeout(t);
  }, [screenActive, banditLaneReady]);

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
  const listEvents = useMemo(() => {
    const visible = filteredEvents.filter((e) => !hiddenHeroEventIds.has(e.id));
    const withMedia = visible.filter((e) => eventHasVenueMediaSource(e));
    /** Prefer media-ready rows; never leave the feed empty while Places recovery runs. */
    if (withMedia.length > 0) return withMedia;
    return visible.slice(0, 12);
  }, [filteredEvents, hiddenHeroEventIds]);

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
      out[e.id] = selectViewportVenueHeroUri({
        liveUri: liveHeroByEventId[e.id],
        approvedUri: approvedHeroById[e.id],
        storedUri: getSpotDetailHeroUri(e),
        failedUris: failedHeroUris,
      });
    }
    return out;
  }, [filteredEvents, approvedHeroById, liveHeroByEventId, failedHeroUris]);

  /**
   * Prefer durable heroes; live-refresh missing / ephemeral / Google-derived / failed URLs.
   * Sequential batches of 4 — cancel on category / inactive so switches never overlap storms.
   * Do not depend on liveHero / done maps (that restarts recovery after every URI write).
   */
  useEffect(() => {
    if (!screenActive) return;
    let cancelled = false;
    /** Let the tab paint and respond before Places recovery steals the network. */
    const start = setTimeout(() => {
      const needLive = filteredEvents.filter((e) => {
        if (liveRecoveryDoneIdsRef.current[e.id]) return false;
        return eventNeedsLivePlacesHeroRecovery(e, {
          liveUri: liveHeroByEventIdRef.current[e.id],
          approvedUri: approvedHeroById[e.id],
          failedUris: failedHeroUrisRef.current,
        });
      });
      /** Cap first wave — rest drains later. */
      const wave = needLive.slice(0, 4);
      if (wave.length === 0) return;

      void (async () => {
        const heroUpdates: Record<string, string> = {};
        const doneUpdates: Record<string, true> = {};
        for (let i = 0; i < wave.length; i += 2) {
          if (cancelled) return;
          const batch = wave.slice(i, i + 2);
          for (const event of batch) {
            if (cancelled) return;
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
              const failed = failedHeroUrisRef.current;
              const cleaned = urls
                .map((u) => normalizeEventImageUri(u) ?? u)
                .filter((u) => /^https?:\/\//i.test(u) && !failed[u]);
              if (cleaned.length === 0) continue;
              heroUpdates[event.id] = cleaned[0];
            } catch {
              /* EventCard may still recover */
            }
          }
          if (!cancelled) {
            if (Object.keys(heroUpdates).length > 0) {
              setLiveHeroByEventId((prev) => ({ ...prev, ...heroUpdates }));
            }
            setLiveRecoveryDoneIds((prev) => ({ ...prev, ...doneUpdates }));
          }
        }
        if (!cancelled && needLive.length > wave.length) {
          setRecoveryKick((k) => k + 1);
        }
      })();
    }, 900);

    return () => {
      cancelled = true;
      clearTimeout(start);
    };
  }, [screenActive, filteredEventIdsKey, filteredEvents, approvedHeroById, recoveryKick]);

  useEffect(() => {
    if (viewMode !== 'map') return;
    perfMark('explore_map_mode_opened', 'map', { eventCount: filteredEvents.length });
  }, [viewMode, filteredEvents.length]);

  const banditBulkKeyRef = useRef<string>('');
  useEffect(() => {
    if (!screenActive || !filteredEventIdsKey) return;
    if (banditBulkKeyRef.current === filteredEventIdsKey) return;
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
          banditBulkKeyRef.current = filteredEventIdsKey;
          setBanditsByEventId((prev) => {
            const next = new Map(prev);
            for (const [id, rows] of map.entries()) next.set(id, rows);
            return next;
          });
          setBanditsEpoch((v) => v + 1);
          if (Platform.OS === 'android' && ids.length > loadIds.length) {
            const rest = ids.slice(loadIds.length);
            void getEventBanditRecommendationsBulk(rest).then((restMap) => {
              if (cancelled) return;
              setBanditsByEventId((prev) => {
                const next = new Map(prev);
                for (const [id, rows] of restMap.entries()) next.set(id, rows);
                return next;
              });
              setBanditsEpoch((v) => v + 1);
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

  const handleHeroUriFailed = useCallback((eventId: string, uri: string) => {
    const id = String(eventId || '').trim();
    const n = normalizeEventImageUri(uri) ?? uri;
    if (!n) return;
    setFailedHeroUris((prev) => markHeroUriFailed(prev, n));
    setLiveHeroByEventId((prev) => {
      if (prev[id] !== n && normalizeEventImageUri(prev[id] ?? '') !== n) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    // Allow one more parent recovery pass after a live URI dies.
    setLiveRecoveryDoneIds((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setRecoveryKick((k) => k + 1);
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
        onHeroUriFailed={handleHeroUriFailed}
      />
    ),
    [
      columns,
      likesEpoch,
      banditId,
      toggleLike,
      handleNavigateToSpot,
      handleBanditPress,
      handleHeroUnavailable,
      handleHeroUriFailed,
    ],
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

  if (screenActive) keepWarmRef.current = true;
  /**
   * First visit while inactive: stay empty (do not steal JS).
   * After a warm paint: keep FlatList mounted under the parked overlay so return is instant.
   */
  if (!screenActive && !keepWarmRef.current && events.length === 0) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container} pointerEvents={screenActive ? 'auto' : 'none'}>
      <View style={styles.headerContainer}>
        <View style={styles.headerSide}>
          {banditId ? (
            <Pressable onPress={goBackToBanditHome} style={styles.backBtn} hitSlop={10}>
              <Text style={styles.backBtnText}>← Back</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.headerText} numberOfLines={1} testID="explore-screen-title">
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
            key={columns > 1 ? 'explore-list-multi' : 'explore-list-single'}
            extraData={`${categoryChip}:${likesEpoch}:${banditsEpoch}`}
            keyExtractor={keyExtractor}
            numColumns={columns}
            refreshControl={exploreRefreshControl}
            columnWrapperStyle={columns > 1 ? styles.row : undefined}
            contentContainerStyle={[styles.gridContent, { paddingBottom: listBottomPad }]}
            ListHeaderComponent={
              !banditId && banditLaneReady ? (
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
              onHeroUriFailed={handleHeroUriFailed}
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
