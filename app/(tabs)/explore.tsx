import { getEvents, toggleEventLike } from '@/app/services/events';
import EventCard from '@/components/EventCard';
import { useCity } from '@/contexts/CityContext';
import { Database } from '@/lib/database.types';
import { usePremiumRefreshControl } from '@/lib/mobilePullToRefresh';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Event = Database['public']['Tables']['event']['Row'];

export default function Explore() {
  const router = useRouter();
  const { selectedCity } = useCity();
  const params = useLocalSearchParams<{ banditId?: string; genre?: string }>();
  const rawBanditId = params.banditId;
  const banditId = Array.isArray(rawBanditId) ? rawBanditId[0] : rawBanditId;
  const rawGenre = params.genre;
  const selectedGenre = Array.isArray(rawGenre) ? rawGenre[0] : rawGenre;
  const hasExploreDataRef = useRef(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [likedEventIds, setLikedEventIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    try {
      if (!silent) setLoading(true);
      setError(null);
      const rows = await getEvents({
        ...(selectedCity ? { city: selectedCity } : {}),
        ...(banditId ? { banditId } : {}),
        ...(selectedGenre ? { genre: selectedGenre } : {}),
      });
      setEvents(rows || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load Explore.');
    } finally {
      if (!silent) setLoading(false);
      setLoadedOnce(true);
    }
  }, [selectedCity, banditId, selectedGenre]);

  useEffect(() => {
    hasExploreDataRef.current = events.length > 0;
  }, [events.length]);

  const exploreFilterKey = useMemo(
    () => `${selectedCity ?? ''}|${banditId ?? ''}|${selectedGenre ?? ''}`,
    [selectedCity, banditId, selectedGenre],
  );
  const prevExploreFilterKeyRef = useRef<string | null>(null);

  /** City / bandit / genre can change while Explore stays focused — refetch without waiting for tab blur. */
  useEffect(() => {
    if (prevExploreFilterKeyRef.current === null) {
      prevExploreFilterKeyRef.current = exploreFilterKey;
      return;
    }
    if (prevExploreFilterKeyRef.current === exploreFilterKey) return;
    prevExploreFilterKeyRef.current = exploreFilterKey;
    let cancelled = false;
    void (async () => {
      setRefreshing(true);
      try {
        await loadEvents({ silent: true });
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [exploreFilterKey, loadEvents]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        if (hasExploreDataRef.current) {
          setRefreshing(true);
          try {
            await loadEvents({ silent: true });
          } finally {
            setRefreshing(false);
          }
          return;
        }
        await loadEvents();
      })();
    }, [loadEvents]),
  );

  const toggleLike = useCallback(async (eventId: string) => {
    const currentlyLiked = likedEventIds.has(eventId);
    setLikedEventIds((prev) => {
      const next = new Set(prev);
      if (currentlyLiked) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
    try {
      await toggleEventLike(eventId, currentlyLiked);
    } catch {
      setLikedEventIds((prev) => {
        const next = new Set(prev);
        if (currentlyLiked) {
          next.add(eventId);
        } else {
          next.delete(eventId);
        }
        return next;
      });
    }
  }, [likedEventIds]);

  const onPullRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadEvents({ silent: true });
    } finally {
      setRefreshing(false);
    }
  }, [loadEvents]);

  const exploreRefreshControl = usePremiumRefreshControl(refreshing, onPullRefresh);

  const title = useMemo(() => {
    if (selectedGenre) return `Explore · ${selectedGenre}`;
    return selectedCity ? `Explore in ${selectedCity}` : 'Explore';
  }, [selectedCity, selectedGenre]);

  const goBackToBanditHome = useCallback(() => {
    if (!banditId) return;
    router.push(`/bandits?focusBanditId=${encodeURIComponent(banditId)}` as any);
  }, [banditId, router]);

  if (loading && !loadedOnce) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error && events.length === 0) {
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
        <View style={styles.headerSide}>
          <Pressable
            style={styles.mapBtn}
            onPress={() => router.push(`/cityMap${banditId ? `?banditId=${encodeURIComponent(banditId)}` : ''}` as any)}
          >
            <Text style={styles.mapBtnText}>Map</Text>
          </Pressable>
        </View>
      </View>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        numColumns={2}
        refreshControl={exploreRefreshControl}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.gridContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No places found in Explore yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <EventCard
              event={item}
              onLike={() => void toggleLike(item.id)}
              isLiked={likedEventIds.has(item.id)}
              variant="horizontal"
              showRecommendations
              banditId={banditId}
              onPress={() =>
                router.push(
                  `${banditId ? `/spot/${item.id}?banditId=${encodeURIComponent(banditId)}` : `/spot/${item.id}`}` as any,
                )
              }
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    paddingHorizontal: 10,
    paddingBottom: 108,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardWrap: {
    width: '48%',
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

