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
import { getBanditEventCategories } from '@/app/services/events';
import BanditHeader from '@/components/BanditHeader';
import BanditsHomeHeader from '@/components/BanditsHomeHeader';
import { Database } from '@/lib/database.types';
import { bootstrapMainAppSession, getHotelEntry } from '@/lib/pilotSession';
import { isSupabaseConfigured } from '@/lib/supabase';
import { usePremiumRefreshControl } from '@/lib/mobilePullToRefresh';

type BanditRow = Database['public']['Tables']['bandit']['Row'];

type BanditWithTags = BanditRow & {
  bandit_tags?: { tags: { id: string; name: string } | null }[] | null;
};

type EventCategory = {
  genre: 'Food' | 'Culture' | 'Nightlife' | 'Shopping' | 'Coffee';
  count: number;
};

type Row = { bandit: BanditWithTags; categories: EventCategory[] };

export default function BanditsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ focusBanditId?: string }>();
  const rawFocus = params.focusBanditId;
  const focusBanditId = Array.isArray(rawFocus) ? rawFocus[0] : rawFocus;
  const listRef = useRef<FlatList<Row>>(null);
  const hasBanditsDataRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [updatingLikeId, setUpdatingLikeId] = useState<string | null>(null);
  const [hotelSlug, setHotelSlug] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 1100;

  const fetchRows = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    try {
      if (!silent) setLoading(true);
      setLoadError(null);
      if (isSupabaseConfigured()) {
        await bootstrapMainAppSession();
      }
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
      setRows(withCats);
    } catch (e) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.error('[bandits] fetchRows failed', e);
      }
      const msg = e instanceof Error ? e.message : 'Could not load banDits.';
      setLoadError(msg);
    } finally {
      if (!silent) setLoading(false);
      setLoadedOnce(true);
    }
  }, []);

  useEffect(() => {
    hasBanditsDataRef.current = rows.length > 0;
  }, [rows.length]);

  useEffect(() => {
    void getHotelEntry().then((entry) => {
      setHotelSlug(entry?.slug ?? null);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        if (hasBanditsDataRef.current) {
          setRefreshing(true);
          try {
            await fetchRows({ silent: true });
          } finally {
            setRefreshing(false);
          }
          return;
        }
        await fetchRows();
      })();
    }, [fetchRows]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchRows({ silent: true });
    } finally {
      setRefreshing(false);
    }
  }, [fetchRows]);

  const listRefreshControl = usePremiumRefreshControl(refreshing, onRefresh);

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
    const showSkeleton = !loadedOnce || (loading && rows.length === 0);
    if (showSkeleton) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingHint}>Loading Local banDits…</Text>
        </View>
      );
    }
    if (loadedOnce && loadError && rows.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.errorText}>{loadError}</Text>
          <Pressable
            onPress={() => void fetchRows()}
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
  }, [loadedOnce, loading, rows.length, loadError, fetchRows]);

  const listHeader = useMemo(
    () => <BanditsHomeHeader hotelSlug={hotelSlug} loadingContext={false} />,
    [hotelSlug],
  );

  return (
    <View style={styles.screen}>
      {listHeader}
      <FlatList
        ref={listRef}
        style={styles.listFlex}
        key={isDesktopWeb ? 'desktop-grid' : 'mobile-list'}
        data={rows}
        numColumns={isDesktopWeb ? 2 : 1}
        keyExtractor={(item) => item.bandit.id}
        columnWrapperStyle={isDesktopWeb ? styles.desktopColumns : undefined}
        contentContainerStyle={[
          styles.listContent,
          isDesktopWeb && styles.listContentDesktop,
        ]}
        ListEmptyComponent={listEmpty}
        refreshControl={listRefreshControl}
        onScrollToIndexFailed={({ index }) => {
          setTimeout(() => {
            listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.15 });
          }, 200);
        }}
        renderItem={({ item }) => (
          <View style={isDesktopWeb ? styles.desktopCardCell : undefined}>
            <BanditHeader
              bandit={item.bandit as any}
              categories={item.categories}
              variant="list"
              showActionButtons
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
              onCategoryPress={(genre) =>
                router.push(`/explore?banditId=${item.bandit.id}&genre=${encodeURIComponent(genre)}` as any)
              }
            />
          </View>
        )}
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
  loadingContainer: {
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
});
