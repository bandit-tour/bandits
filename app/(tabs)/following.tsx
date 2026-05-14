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
import { Stack } from 'expo-router';

import { getBanditEventCategories, getEvents } from '@/app/services/events';
import { getFollowedBanditsWithTags, toggleBanditLike } from '@/app/services/bandits';
import BanditHeader from '@/components/BanditHeader';
import EventCard from '@/components/EventCard';
import EventCardSkeleton from '@/components/EventCardSkeleton';
import { fetchSWR, invalidateAppDataCache, readCacheStale } from '@/lib/appDataCache';
import { Database } from '@/lib/database.types';
import { buildEventListImagePlan } from '@/lib/eventListImagePlan';
import { usePremiumRefreshControl } from '@/lib/mobilePullToRefresh';
import {
  enforceUniqueRecommendationImagesByEventId,
  resolveStrictRecommendationImagesByEventId,
} from '@/lib/recommendationImages';

const FOLLOWING_ROWS_CACHE_KEY = 'following:rows:withCategories';
const FOLLOWING_ROWS_TTL_MS = 90 * 1000;

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

export default function FollowingScreen() {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 1100;
  const followingInitialFocusDoneRef = useRef(false);
  const cachedFollowingRows = useMemo(
    () => readCacheStale<Row[]>(FOLLOWING_ROWS_CACHE_KEY),
    [],
  );
  const [loadedOnce, setLoadedOnce] = useState(cachedFollowingRows !== undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<Row[]>(cachedFollowingRows ?? []);
  const [updatingLikeId, setUpdatingLikeId] = useState<string | null>(null);
  const [categoryExpandByBanditId, setCategoryExpandByBanditId] = useState<
    Record<string, CategoryExpand | undefined>
  >({});
  const [recommendationImageByBanditId, setRecommendationImageByBanditId] = useState<
    Record<string, Record<string, string>>
  >({});

  const imagePlanByBanditId = useMemo(() => {
    const m = new Map<string, ReturnType<typeof buildEventListImagePlan>>();
    for (const [banditId, exp] of Object.entries(categoryExpandByBanditId)) {
      if (!exp || exp.loading || exp.events.length === 0) continue;
      m.set(banditId, buildEventListImagePlan(exp.events));
    }
    return m;
  }, [categoryExpandByBanditId]);

  const listExpandExtra = useMemo(
    () => ({ categoryExpandByBanditId, recommendationImageByBanditId }),
    [categoryExpandByBanditId, recommendationImageByBanditId],
  );

  const hasCategoryExpanded = useMemo(
    () => Object.values(categoryExpandByBanditId).some((exp) => exp != null),
    [categoryExpandByBanditId],
  );

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

  useEffect(() => {
    // Resolve images in parallel (not sequential `for...of` as before) and
    // use the signature-keyed cache in `lib/recommendationImages.ts` so
    // re-expansions skip the network entirely.
    let cancelled = false;
    void (async () => {
      const entries = Object.entries(categoryExpandByBanditId).filter(
        ([, exp]) => exp && !exp.loading && exp.events.length > 0,
      );
      const results = await Promise.all(
        entries.map(async ([banditId, exp]) => {
          const out = await resolveStrictRecommendationImagesByEventId(exp!.events as any);
          return [banditId, enforceUniqueRecommendationImagesByEventId(exp!.events as any, out)] as const;
        }),
      );
      if (cancelled) return;
      const next: Record<string, Record<string, string>> = {};
      for (const [banditId, map] of results) next[banditId] = map;
      setRecommendationImageByBanditId(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [categoryExpandByBanditId]);

  const fetchRows = useCallback((asRefresh: boolean) => {
    if (asRefresh) setRefreshing(true);
    const handle = fetchSWR<Row[]>(
      FOLLOWING_ROWS_CACHE_KEY,
      FOLLOWING_ROWS_TTL_MS,
      async () => {
        const data = await getFollowedBanditsWithTags();
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
        followingInitialFocusDoneRef.current = true;
      },
      () => {
        setRows([]);
        setLoadedOnce(true);
        setRefreshing(false);
        followingInitialFocusDoneRef.current = true;
      },
    );
    return handle;
  }, []);

  useFocusEffect(
    useCallback(() => {
      const asRefresh = followingInitialFocusDoneRef.current;
      const handle = fetchRows(asRefresh);
      return () => handle.cancel();
    }, [fetchRows]),
  );

  const onRefresh = useCallback(async () => {
    invalidateAppDataCache(FOLLOWING_ROWS_CACHE_KEY);
    fetchRows(true);
  }, [fetchRows]);

  const listRefreshControl = usePremiumRefreshControl(refreshing, onRefresh);

  if (!loadedOnce) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: 'Following', headerBackTitle: 'Back' }} />
        <View style={[styles.listContent, { gap: 12 }]}>
          {[0, 1, 2].map((i) => (
            <EventCardSkeleton key={i} />
          ))}
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Following', headerBackTitle: 'Back' }} />
      <FlatList
        data={rows}
        extraData={listExpandExtra}
        keyExtractor={(item) => item.bandit.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No banDits yet</Text>
            <Text style={styles.emptyText}>
              Open the Local banDits tab, tap Follow on profiles you like, and they will all show up here — same idea as My Spots for saved events.
            </Text>
          </View>
        }
        refreshControl={listRefreshControl}
        initialNumToRender={4}
        maxToRenderPerBatch={3}
        windowSize={5}
        removeClippedSubviews={false}
        disableVirtualization={hasCategoryExpanded}
        {...(Platform.OS !== 'web'
          ? {
              keyboardShouldPersistTaps: 'always' as const,
            }
          : {})}
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
                          !exp.loading && recommendationImageByBanditId[item.bandit.id] !== undefined
                        }
                        strictRecommendationImagePolicy
                        onPress={() => undefined}
                      />
                    </View>
                  );
                  })}
                </View>
              )}
            </View>
          ) : null;

          return (
            <View key={`${item.bandit.id}:${exp?.genre ?? 'collapsed'}`} collapsable={false}>
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
                  try {
                    await toggleBanditLike(id, currentLikeStatus);
                    setRows((prev) => prev.filter((r) => r.bandit.id !== id));
                  } catch (e) {
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
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f6f6f6',
  },
  listContent: {
    padding: 16,
    paddingBottom: 28,
    flexGrow: 1,
    backgroundColor: '#f6f6f6',
  },
  emptyContainer: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
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
  inlineCategoryGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'flex-start',
  },
  inlineCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
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
  inlineSpotCardWrap: {
    marginTop: 2,
    width: '100%',
  },
  inlineSpotCardWrapDesktop: {
    width: '48.8%',
  },
});
