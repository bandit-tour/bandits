/**
 * Menu → **bandiTEAM** combined hub: read preview + open full feed + jump to **dedicated report form** (`/bandiTeam/report`).
 * Full alerts-only feed: `/scam-alerts` or bottom tab `/alerts`. Alert detail: `/scam-alert/[id]`.
 */
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AppEscapeNav from '@/components/AppEscapeNav';
import { useCity } from '@/contexts/CityContext';
import { useAppBackScreenOptions } from '@/hooks/useAppBackScreenOptions';
import { usePremiumRefreshControl } from '@/lib/mobilePullToRefresh';
import { useScamAlertsFeedRefresh } from '@/lib/scamAlertsRefresh';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { renderSafeText } from '@/lib/renderSafeText';
import { fetchScamAlerts, type ScamAlertRow } from '@/services/scamAlerts';

const PREVIEW_MAX = 20;

type HubProps = {
  /** When hosted under Explore upper-rail, only apply header while this pane is active. */
  tabActive?: boolean;
};

export default function BandiTeamHubScreen({ tabActive = true }: HubProps) {
  const router = useRouter();
  const { selectedCity } = useCity();
  const previewCity = useMemo(() => renderSafeText(selectedCity, '').trim(), [selectedCity]);

  const [rows, setRows] = useState<ScamAlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) setErr(null);
    try {
      const data = await fetchScamAlerts({ city: previewCity || null });
      setRows(data.slice(0, PREVIEW_MAX));
    } catch (e: unknown) {
      if (!silent) {
        setErr(e instanceof Error ? renderSafeText(e.message, 'Could not load alerts.') : 'Could not load alerts.');
        setRows([]);
      }
    } finally {
      if (silent) setRefreshing(false);
      else {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [previewCity]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useScamAlertsFeedRefresh(load);

  const onPullRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);
  const hubRefreshControl = usePremiumRefreshControl(refreshing, onPullRefresh);

  const openFullFeed = () => {
    if (previewCity) router.push({ pathname: '/scam-alerts', params: { city: previewCity } } as never);
    else router.push('/scam-alerts' as never);
  };

  const openDetail = (id: string) => {
    router.push(`/scam-alert/${id}` as never);
  };

  const screenOptions = useAppBackScreenOptions({
    title: tabActive ? 'bandiTEAM' : '',
    fallback: '/menu',
    escapeShortcuts: true,
    headerShown: tabActive,
  });

  return (
    <>
      {tabActive ? <Stack.Screen options={screenOptions} /> : null}
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={hubRefreshControl}
      >
        <AppEscapeNav />

        <Text style={styles.brand}>bandiTEAM</Text>
        <Text style={styles.title}>Good locals look out for each other.</Text>
        <Text style={styles.subtitle}>
          Scams, tourist traps, and things worth knowing — shared by people who've been there.
        </Text>

        <View style={styles.actions}>
          <Pressable
            style={styles.feedBtn}
            onPress={openFullFeed}
            accessibilityRole="button"
            accessibilityLabel="See Reports"
            testID="banditeam-see-reports"
          >
            <Text style={styles.feedBtnText}>See Reports</Text>
          </Pressable>
          <Pressable
            style={styles.reportBtn}
            onPress={() => router.push('/bandiTeam/report' as never)}
            accessibilityRole="button"
            accessibilityLabel="Share a Warning"
            testID="banditeam-share-warning"
          >
            <Text style={styles.reportBtnText}>Share a Warning</Text>
          </Pressable>
        </View>

        {loading && rows.length === 0 ? <ActivityIndicator style={{ marginVertical: 20 }} color="#111" /> : null}
        {!!err && <Text style={styles.err}>{err}</Text>}

        {!loading && !err && rows.length === 0 ? (
          <View style={styles.emptyBox} testID="banditeam-empty">
            <Text style={styles.emptyTitle}>Nothing shared here yet</Text>
            <Text style={styles.empty}>
              When someone nearby shares a warning, it will show up here. Be the first to look out for others.
            </Text>
          </View>
        ) : null}

        {rows.map((item, idx) => (
          <Pressable
            key={renderSafeText(item.id, `row-${idx}`)}
            testID={`banditeam-preview-row-${renderSafeText(item.id, String(idx))}`}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.88 }]}
            onPress={() => openDetail(item.id)}
            accessibilityRole="button"
            accessibilityLabel={`Open alert ${renderSafeText(item.title, '')}`}
          >
            <Text style={styles.cardTitle} numberOfLines={2}>
              {renderSafeText(item.title, 'Alert')}
            </Text>
            {!!renderSafeText(item.description, '').trim() && (
              <Text style={styles.cardDesc} numberOfLines={3}>
                {renderSafeText(item.description, '').trim()}
              </Text>
            )}
            <View style={styles.meta}>
              <Text style={styles.metaText}>{renderSafeText(item.category, 'Other') || 'Other'}</Text>
              <Text style={styles.metaText}>{formatRelativeTime(renderSafeText(item.created_at, ''))}</Text>
            </View>
            <Text style={styles.area} numberOfLines={2}>
              {[renderSafeText(item.city, '').trim(), renderSafeText(item.location, '').trim()]
                .filter(Boolean)
                .join(' · ') || 'Area not specified'}
            </Text>
          </Pressable>
        ))}

        <Text style={styles.closing}>Real stories. Safer travels. Stronger community.</Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 48 },
  brand: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#C62828',
    marginBottom: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111',
    lineHeight: 32,
    marginBottom: 10,
    maxWidth: 340,
  },
  subtitle: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
    marginBottom: 22,
    maxWidth: 360,
  },
  actions: {
    flexDirection: 'column',
    gap: 10,
    marginBottom: 24,
  },
  reportBtn: {
    backgroundColor: '#FFD54F',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  reportBtnText: { color: '#111', fontSize: 15, fontWeight: '900' },
  feedBtn: {
    borderWidth: 1.5,
    borderColor: '#111',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#111',
    alignItems: 'center',
  },
  feedBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  err: { color: '#C62828', marginBottom: 12, fontSize: 14, lineHeight: 20 },
  emptyBox: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 6,
  },
  empty: { fontSize: 14, color: '#666', lineHeight: 21 },
  card: {
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    backgroundColor: '#FAFAFA',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 6 },
  cardDesc: { fontSize: 14, color: '#333', lineHeight: 20, marginBottom: 8 },
  meta: { flexDirection: 'row', justifyContent: 'space-between' },
  metaText: { fontSize: 12, color: '#666', fontWeight: '600' },
  area: { marginTop: 6, fontSize: 13, color: '#444', fontWeight: '600' },
  closing: {
    marginTop: 20,
    fontSize: 13,
    color: '#888',
    lineHeight: 19,
    fontWeight: '600',
    textAlign: 'center',
  },
});
