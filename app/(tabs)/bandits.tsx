import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { getBanditsWithTags, toggleBanditLike } from '@/app/services/bandits';
import { getBanditEventCategories, getEvents } from '@/app/services/events';
import BanditHeader from '@/components/BanditHeader';
import BanditsHomeHeader from '@/components/BanditsHomeHeader';
import EventCard from '@/components/EventCard';
import EventCardSkeleton from '@/components/EventCardSkeleton';
import { fetchSWR, invalidateAppDataCache, readCacheStale } from '@/lib/appDataCache';
import { Database } from '@/lib/database.types';
import { getHotelEntry } from '@/lib/pilotSession';
import { usePremiumRefreshControl } from '@/lib/mobilePullToRefresh';
import { buildEventListImagePlan, getEventDbImageCandidatesOrdered } from '@/lib/eventListImagePlan';
import {
  enforceUniqueRecommendationImagesByEventId,
  resolveStrictRecommendationImagesByEventId,
} from '@/lib/recommendationImages';

const BANDITS_ROWS_CACHE_KEY = 'bandits:rows:withCategories';
const BANDITS_ROWS_TTL_MS = 90 * 1000;

type BanditRow = Database['public']['Tables']['bandit']['Row'];

type BanditWithTags = BanditRow & {
  bandit_tags?: { tags: { id: string; name: string } | null }[] | null;
};

type EventCategory = {
  genre: 'Food' | 'Culture' | 'Nightlife' | 'Shopping' | 'Coffee';
  count: number;
};

type Row = { bandit: BanditWithTags; categories: EventCategory[] };

type EventItem = Database['public']['Tables']['event']['Row'];
type CategoryExpand = { genre: string; events: EventItem[]; loading: boolean };

export default function BanditsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ focusBanditId?: string }>();
  const rawFocus = params.focusBanditId;
  const focusBanditId = Array.isArray(rawFocus) ? rawFocus[0] : rawFocus;
  const listRef = useRef<FlatList<Row>>(null);
  const banditsInitialFocusDoneRef = useRef(false);
  // Seed from cache so a re-mount paints instantly.
  const cachedRows = useMemo(() => readCacheStale<Row[]>(BANDITS_ROWS_CACHE_KEY), []);
  const [loadedOnce, setLoadedOnce] = useState(cachedRows !== undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<Row[]>(cachedRows ?? []);
  const [updatingLikeId, setUpdatingLikeId] = useState<string | null>(null);
  const [hotelSlug, setHotelSlug] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 1100;
  const [categoryExpandByBanditId, setCategoryExpandByBanditId] = useState<
    Record<string, CategoryExpand | undefined>
  >({});
  const [recommendationImageByBanditId, setRecommendationImageByBanditId] = useState<
    Record<string, Record<string, string>>
  >({});
  const categoryImageAuditRef = useRef<Record<string, string>>({});

  /**
   * Pre-compute the per-expanded-bandit image plan once per state change
   * instead of inside `renderItem`. The previous IIFE inside `renderItem`
   * rebuilt this plan on every row render of the FlatList — and with
   * virtualization recycling that meant N times per scroll frame.
   */
  const imagePlanByBanditId = useMemo(() => {
    const m = new Map<string, ReturnType<typeof buildEventListImagePlan>>();
    for (const [banditId, exp] of Object.entries(categoryExpandByBanditId)) {
      if (!exp || exp.loading || exp.events.length === 0) continue;
      m.set(banditId, buildEventListImagePlan(exp.events));
    }
    return m;
  }, [categoryExpandByBanditId]);

  /**
   * Native FlatList only re-runs `renderItem` when `data` or `extraData` changes.
   * Category accordion state lives outside `rows`, so without `extraData` chip taps
   * update state on native but the expanded panel never paints (web FlatList is laxer).
   */
  const listExpandExtra = useMemo(
    () => ({ categoryExpandByBanditId, recommendationImageByBanditId }),
    [categoryExpandByBanditId, recommendationImageByBanditId],
  );

  const hasCategoryExpanded = useMemo(
    () => Object.values(categoryExpandByBanditId).some((exp) => exp != null),
    [categoryExpandByBanditId],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const busyPairs = Object.entries(categoryExpandByBanditId).filter(
        ([, exp]) => exp && !exp.loading && exp.events.length > 0,
      );
      if (busyPairs.length === 0) {
        if (!cancelled) setRecommendationImageByBanditId({});
        return;
      }
      setRecommendationImageByBanditId((prev) => {
        const next = { ...prev };
        for (const [banditId] of busyPairs) delete next[banditId];
        return next;
      });
      const next: Record<string, Record<string, string>> = {};
      for (const [banditId, exp] of busyPairs) {
        const out = await resolveStrictRecommendationImagesByEventId(exp!.events as any);
        next[banditId] = enforceUniqueRecommendationImagesByEventId(exp!.events as any, out);
      }
      if (!cancelled) setRecommendationImageByBanditId((prev) => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
  }, [categoryExpandByBanditId]);

  const handleListCategoryPress = useCallback((banditId: string, genre: string) => {
    void (async () => {
      let collapsed = false;
      setCategoryExpandByBanditId((prev) => {
        const cur = prev[banditId];
        if (cur?.genre === genre) {
          collapsed = true;
          const next = { ...prev };
          delete next[banditId];
          return next;
        }
        return { ...prev, [banditId]: { genre, events: [], loading: true } };
      });
      if (collapsed) return;
      try {
        const events = await getEvents({ banditId, genre });
        setCategoryExpandByBanditId((prev) =>
          prev[banditId]?.genre === genre
            ? { ...prev, [banditId]: { genre, events: events ?? [], loading: false } }
            : prev,
        );
      } catch {
        setCategoryExpandByBanditId((prev) =>
          prev[banditId]?.genre === genre
            ? { ...prev, [banditId]: { genre, events: [], loading: false } }
            : prev,
        );
      }
    })();
  }, []);

  const fetchRows = useCallback((asRefresh: boolean) => {
    if (asRefresh) setRefreshing(true);
    setLoadError(null);
    const handle = fetchSWR<Row[]>(
      BANDITS_ROWS_CACHE_KEY,
      BANDITS_ROWS_TTL_MS,
      async () => {
        // Note: session bootstrap is performed in `app/_layout.tsx` (root) and
        // `app/(tabs)/_layout.tsx`. Calling it here too just queued through
        // the serialized auth lock and added latency on every tab focus.
        const data = await getBanditsWithTags();
        const list = (data || []) as BanditWithTags[];
        const withCats = await Promise.all(
          list.map(async (b): Promise<Row> => {
            try {
              const categories = await getBanditEventCategories(b.id);
              return { bandit: b, categories };
            } catch {
              return { bandit: b, categories: [] };
            }
          }),
        );
        return withCats;
      },
      (data) => {
        setRows(data);
        setLoadedOnce(true);
        setRefreshing(false);
      },
      (e) => {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.error('[bandits] fetchRows failed', e);
        }
        const msg = e instanceof Error ? e.message : 'Could not load banDits.';
        setLoadError(msg);
        setLoadedOnce(true);
        setRefreshing(false);
      },
    );
    return handle;
  }, []);

  useEffect(() => {
    void getHotelEntry().then((entry) => {
      setHotelSlug(entry?.slug ?? null);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      const asRefresh = banditsInitialFocusDoneRef.current;
      const handle = fetchRows(asRefresh);
      banditsInitialFocusDoneRef.current = true;
      return () => handle.cancel();
    }, [fetchRows]),
  );

  const onRefresh = useCallback(async () => {
    invalidateAppDataCache(BANDITS_ROWS_CACHE_KEY);
    fetchRows(true);
  }, [fetchRows]);

  const listRefreshControl = usePremiumRefreshControl(refreshing, onRefresh);

  useEffect(() => {
    Object.entries(categoryExpandByBanditId).forEach(([banditId, expanded]) => {
      if (!expanded || expanded.loading || expanded.events.length === 0) return;
      const assignedByUri = new Map<string, string>();
      const duplicates: Array<{ eventId: string; duplicateOf: string; uri: string }> = [];
      const missingImageEventIds: string[] = [];
      expanded.events.forEach((event) => {
        const uri = getEventDbImageCandidatesOrdered(event)[0] ?? null;
        if (!uri) {
          missingImageEventIds.push(event.id);
          return;
        }
        const duplicateOf = assignedByUri.get(uri);
        if (duplicateOf && duplicateOf !== event.id) {
          duplicates.push({ eventId: event.id, duplicateOf, uri });
          return;
        }
        assignedByUri.set(uri, event.id);
      });
      const signature = JSON.stringify({ missingImageEventIds, duplicates });
      const dedupeKey = `${banditId}:${expanded.genre}`;
      if (categoryImageAuditRef.current[dedupeKey] === signature) return;
      categoryImageAuditRef.current[dedupeKey] = signature;
      if (missingImageEventIds.length > 0) {
        console.warn('[Bandits] category expand missing recommendation image(s)', {
          banditId,
          genre: expanded.genre,
          eventIds: missingImageEventIds,
        });
      }
      if (duplicates.length > 0) {
        console.warn('[Bandits] category expand duplicate recommendation image(s) suppressed', {
          banditId,
          genre: expanded.genre,
          duplicates,
        });
      }
    });
  }, [categoryExpandByBanditId]);

  useEffect(() => {
    if (!focusBanditId || rows.length === 0) return;
    const index = rows.findIndex((r) => r.bandit.id === focusBanditId);
    if (index < 0) return;
    const t = setTimeout(() => {
      listRef.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.15,
      });
    }, 120);
    return () => clearTimeout(t);
  }, [focusBanditId, rows]);

  const listEmpty = useMemo(() => {
    if (loadedOnce && loadError && rows.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.errorText}>{loadError}</Text>
          <Pressable
            onPress={() => void fetchRows(true)}
            style={styles.retryBtn}
            accessibilityRole="button"
            accessibilityLabel="Retry loading banDits"
          >
            <Text style={styles.retryBtnText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No bandits found</Text>
      </View>
    );
  }, [loadedOnce, rows.length, loadError, fetchRows]);

  const listHeader = useMemo(
    () => <BanditsHomeHeader hotelSlug={hotelSlug} loadingContext={false} />,
    [hotelSlug],
  );

  /** First-ever load: skeleton placeholders so users see structure instead of a blank spinner. */
  if (!loadedOnce) {
    return (
      <View style={styles.screen}>
        {listHeader}
        <View style={[styles.listContent, { gap: 14 }]}>
          {[0, 1, 2].map((i) => (
            <EventCardSkeleton key={i} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {listHeader}
      <FlatList
        ref={listRef}
        style={styles.listFlex}
        key={isDesktopWeb ? 'desktop-grid' : 'mobile-list'}
        data={rows}
        extraData={listExpandExtra}
        numColumns={isDesktopWeb ? 2 : 1}
        keyExtractor={(item) => item.bandit.id}
        columnWrapperStyle={isDesktopWeb ? styles.desktopColumns : undefined}
        contentContainerStyle={[
          styles.listContent,
          isDesktopWeb && styles.listContentDesktop,
        ]}
        {...(Platform.OS !== 'web'
          ? {
              keyboardShouldPersistTaps: 'always' as const,
            }
          : {})}
        ListEmptyComponent={listEmpty}
        refreshControl={listRefreshControl}
        // Virtualization tuning for mobile smoothness.
        initialNumToRender={4}
        maxToRenderPerBatch={3}
        windowSize={5}
        removeClippedSubviews={false}
        disableVirtualization={hasCategoryExpanded}
        onScrollToIndexFailed={({ index }) => {
          setTimeout(() => {
            listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.15 });
          }, 200);
        }}
        renderItem={({ item }) => {
          const exp = categoryExpandByBanditId[item.bandit.id];
          const categoryExpandBelow = exp ? (
            <View style={styles.inlineCategorySection} pointerEvents="box-none">
              <View style={styles.inlineCategoryHeader}>
                <Text style={styles.inlineCategoryTitle}>{exp.genre} picks</Text>
                <Pressable
                  onPress={() =>
                    setCategoryExpandByBanditId((prev) => {
                      const next = { ...prev };
                      delete next[item.bandit.id];
                      return next;
                    })
                  }
                  hitSlop={6}
                >
                  <Text style={styles.inlineCategoryCollapse}>Hide</Text>
                </Pressable>
              </View>
              {exp.loading ? (
                <ActivityIndicator size="small" />
              ) : exp.events.length === 0 ? (
                <Text style={styles.inlineCategoryEmpty}>No spots in this category yet.</Text>
              ) : (
                <View style={styles.inlineCategoryGrid} pointerEvents="box-none">
                  {exp.events.map((event) => {
                    const plan = imagePlanByBanditId.get(item.bandit.id);
                    return (
                      <View
                        key={event.id}
                        style={[styles.inlineSpotCardWrap, isDesktopWeb && styles.inlineSpotCardWrapDesktop]}
                      >
                        <EventCard
                          event={event}
                          onLike={() => undefined}
                          isLiked={false}
                          showButton={false}
                          variant="horizontal"
                          fillHorizontalCell
                          showRecommendations
                          prioritizeCardPress
                          banditId={item.bandit.id}
                          listImageScope={plan?.get(event.id)}
                          resolvedRecommendationImageUri={
                            recommendationImageByBanditId[item.bandit.id]?.[event.id] ?? null
                          }
                          recommendationHeroResolverReady={
                            !exp.loading &&
                            recommendationImageByBanditId[item.bandit.id] !== undefined
                          }
                          strictRecommendationImagePolicy
                          onPress={() =>
                            router.push(
                              `/spot/${event.id}?banditId=${encodeURIComponent(item.bandit.id)}` as any,
                            )
                          }
                        />
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          ) : null;

          return (
            <View
              key={`${item.bandit.id}:${exp?.genre ?? 'collapsed'}`}
              style={isDesktopWeb ? styles.desktopCardCell : undefined}
              collapsable={false}
            >
              <BanditHeader
                bandit={item.bandit as any}
                categories={item.categories}
                selectedGenre={exp?.genre ?? null}
                variant="list"
                showActionButtons
                categoryExpandBelow={categoryExpandBelow}
                onLike={async (id, currentLikeStatus) => {
                  if (updatingLikeId) return;
                  setUpdatingLikeId(id);
                  setRows((prev) =>
                    prev.map((r) =>
                      r.bandit.id === id ? { ...r, bandit: { ...r.bandit, is_liked: !currentLikeStatus } } : r,
                    ),
                  );
                  try {
                    await toggleBanditLike(id, currentLikeStatus);
                  } catch (e) {
                    setRows((prev) =>
                      prev.map((r) =>
                        r.bandit.id === id
                          ? { ...r, bandit: { ...r.bandit, is_liked: currentLikeStatus } }
                          : r,
                      ),
                    );
                    const msg = e instanceof Error ? e.message : '';
                    Alert.alert('Follow unavailable', msg || 'Could not update follow state.');
                  } finally {
                    setUpdatingLikeId(null);
                  }
                }}
                onCategoryPress={(genre) => handleListCategoryPress(item.bandit.id, genre)}
              />
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f6f6f6',
  },
  listFlex: {
    flex: 1,
  },
  fullScreenLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f6f6f6',
  },
  listContent: {
    padding: 16,
    paddingBottom: 28,
    backgroundColor: '#f6f6f6',
  },
  listContentDesktop: {
    maxWidth: 1320,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 24,
  },
  desktopColumns: {
    gap: 14,
  },
  desktopCardCell: {
    flex: 1,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  loadingHint: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  errorText: {
    fontSize: 15,
    color: '#b00020',
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  retryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  categoryInlineWrap: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    marginTop: -2,
    backgroundColor: '#f6f6f6',
  },
  inlineCategorySection: {
    marginBottom: 4,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F7F7F7',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E2E2',
    gap: 10,
  },
  inlineCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  inlineCategoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#202020',
  },
  inlineCategoryCollapse: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0a7ea4',
  },
  inlineCategoryEmpty: {
    fontSize: 13,
    color: '#666',
  },
  inlineCategoryGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'flex-start',
  },
  inlineSpotCardWrap: {
    width: '100%',
  },
  inlineSpotCardWrapDesktop: {
    width: '48.8%',
  },
});
