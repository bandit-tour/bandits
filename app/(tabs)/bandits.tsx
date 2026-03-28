import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { getBanditsWithTags, toggleBanditLike } from '@/app/services/bandits';
import { getBanditEventCategories } from '@/app/services/events';
import BanditHeader from '@/components/BanditHeader';
import { Database } from '@/lib/database.types';

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [updatingLikeId, setUpdatingLikeId] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      try {
        await fetchRows();
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [fetchRows]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchRows();
    } finally {
      setRefreshing(false);
    }
  }, [fetchRows]);

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

  const empty = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No bandits found</Text>
      </View>
    ),
    [],
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      ref={listRef}
      data={rows}
      keyExtractor={(item) => item.bandit.id}
      contentContainerStyle={styles.listContent}
      ListEmptyComponent={empty}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
      onScrollToIndexFailed={({ index }) => {
        setTimeout(() => {
          listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.15 });
        }, 200);
      }}
      renderItem={({ item }) => (
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
      )}
    />
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
    backgroundColor: '#f6f6f6',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
});
