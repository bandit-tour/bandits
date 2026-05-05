import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';

import { getBanditEventCategories } from '@/app/services/events';
import { getFollowedBanditsWithTags, toggleBanditLike } from '@/app/services/bandits';
import BanditHeader from '@/components/BanditHeader';
import { Database } from '@/lib/database.types';
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

export default function FollowingScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [updatingLikeId, setUpdatingLikeId] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
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
    setRows(withCats);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        setLoading(true);
        try {
          await fetchRows();
        } catch {
          if (!cancelled) setRows([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [fetchRows]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchRows();
    } finally {
      setRefreshing(false);
    }
  }, [fetchRows]);

  const listRefreshControl = usePremiumRefreshControl(refreshing, onRefresh);

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: 'Following', headerBackTitle: 'Back' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Following', headerBackTitle: 'Back' }} />
      <FlatList
        data={rows}
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
        renderItem={({ item }) => (
          <BanditHeader
            bandit={item.bandit as any}
            categories={item.categories}
            variant="list"
            showActionButtons
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
            onCategoryPress={(genre) =>
              router.push(`/explore?banditId=${item.bandit.id}&genre=${encodeURIComponent(genre)}` as any)
            }
          />
        )}
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
});
