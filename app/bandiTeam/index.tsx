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

import { useCity } from '@/contexts/CityContext';
import { useAppBackScreenOptions } from '@/hooks/useAppBackScreenOptions';
import { usePremiumRefreshControl } from '@/lib/mobilePullToRefresh';
import { useScamAlertsFeedRefresh } from '@/lib/scamAlertsRefresh';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { renderSafeText } from '@/lib/renderSafeText';
import { fetchScamAlerts, type ScamAlertRow } from '@/services/scamAlerts';

const PREVIEW_MAX = 20;

export default function BandiTeamHubScreen() {
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
    title: 'bandiTEAM',
    fallback: '/menu',
  });

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={hubRefreshControl}
      >
        <Text style={styles.title}>Community safety alerts</Text>
        <Text style={styles.hint}>
          {previewCity
            ? `Preview for ${previewCity} (from your destination). Tap a row for full details.`
            : 'Preview across destinations. Set your city in the app to narrow, or open the full feed.'}
        </Text>

        <View style={styles.actions}>
          <Pressable style={styles.reportBtn} onPress={() => router.push('/bandiTeam/report' as never)} accessibilityRole="button">
            <Text style={styles.reportBtnText}>Report alert</Text>
          </Pressable>
          <Pressable style={styles.feedBtn} onPress={openFullFeed} accessibilityRole="button">
            <Text style={styles.feedBtnText}>Open full feed</Text>
          </Pressable>
        </View>

        {loading && rows.length === 0 ? <ActivityIndicator style={{ marginVertical: 16 }} color="#111" /> : null}
        {!!err && <Text style={styles.err}>{err}</Text>}
        {!loading && !err && rows.length === 0 ? (
          <Text style={styles.empty}>No alerts yet. Report the first one with Report alert.</Text>
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
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: '800', color: '#111', marginBottom: 8 },
  hint: { fontSize: 13, color: '#555', lineHeight: 19, marginBottom: 14 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  reportBtn: {
    backgroundColor: '#FFD54F',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  reportBtnText: { color: '#111', fontSize: 14, fontWeight: '900' },
  feedBtn: {
    borderWidth: 1,
    borderColor: '#111',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#111',
  },
  feedBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  err: { color: '#C62828', marginBottom: 8 },
  empty: { fontSize: 14, color: '#666', lineHeight: 20 },
  card: {
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    backgroundColor: '#FAFAFA',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 6 },
  cardDesc: { fontSize: 14, color: '#333', lineHeight: 20, marginBottom: 8 },
  meta: { flexDirection: 'row', justifyContent: 'space-between' },
  metaText: { fontSize: 12, color: '#666', fontWeight: '600' },
  area: { marginTop: 6, fontSize: 13, color: '#444', fontWeight: '600' },
});
