import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

import { useCity } from '@/contexts/CityContext';
import { useAppBackScreenOptions } from '@/hooks/useAppBackScreenOptions';
import { usePremiumRefreshControl } from '@/lib/mobilePullToRefresh';
import { useScamAlertsFeedRefresh } from '@/lib/scamAlertsRefresh';
import { buildScamAlertsLeafletHtml, defaultCenterForCity } from '@/lib/scamAlertsMapHtml';
import { fetchScamAlerts, type ScamAlertRow } from '@/services/scamAlerts';

export default function ScamAlertsMapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ city?: string | string[] }>();
  const { selectedCity } = useCity();

  const cityFromParams = useMemo(() => {
    const raw = params.city;
    const s = Array.isArray(raw) ? raw[0] : raw;
    return typeof s === 'string' ? s.trim() : '';
  }, [params.city]);

  const city = cityFromParams || selectedCity?.trim() || '';

  const [rows, setRows] = useState<ScamAlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true;
      setErr(null);
      try {
        if (silent) setRefreshing(true);
        else setLoading(true);
        const data = await fetchScamAlerts({ city: city || null });
        setRows(data);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : 'Could not load alerts.');
        setRows([]);
      } finally {
        if (silent) setRefreshing(false);
        else setLoading(false);
      }
    },
    [city],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useScamAlertsFeedRefresh(load);

  const onMapRefresh = useCallback(() => {
    void load({ silent: true });
  }, [load]);
  const mapRefreshControl = usePremiumRefreshControl(refreshing, onMapRefresh);

  const markers = useMemo(
    () =>
      rows
        .filter((r) => r.location_lat != null && r.location_lng != null && Number.isFinite(r.location_lat) && Number.isFinite(r.location_lng))
        .map((r) => ({
          id: r.id,
          lat: r.location_lat as number,
          lng: r.location_lng as number,
          title: r.title,
          severity: r.severity,
        })),
    [rows],
  );

  const html = useMemo(() => {
    const fallback = defaultCenterForCity(city || 'Athens');
    if (markers.length === 0) {
      return buildScamAlertsLeafletHtml({
        centerLat: fallback.lat,
        centerLng: fallback.lng,
        zoom: 13,
        markers: [],
      });
    }
    const lats = markers.map((m) => m.lat);
    const lngs = markers.map((m) => m.lng);
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    return buildScamAlertsLeafletHtml({
      centerLat,
      centerLng,
      zoom: markers.length === 1 ? 14 : 12,
      markers,
    });
  }, [markers, city]);

  const screenOptions = useAppBackScreenOptions({
    title: 'Safety map',
    fallback: '/scam-alerts',
    headerRight: () => (
      <Pressable
        onPress={() => router.push('/scam-alerts' as never)}
        style={{ paddingHorizontal: 12, paddingVertical: 8 }}
        accessibilityLabel="Back to list"
      >
        <Text style={{ fontWeight: '800', color: '#0a7ea4', fontSize: 15 }}>List</Text>
      </Pressable>
    ),
  });

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ flexGrow: 1, minHeight: Dimensions.get('window').height }}
        refreshControl={mapRefreshControl}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.banner}>
          <Ionicons name="map-outline" size={18} color="#111" />
          <Text style={styles.bannerText}>
            Pins show geotagged reports. Alerts without coordinates still appear in the list view.
          </Text>
        </View>
        {loading ? <ActivityIndicator style={{ marginTop: 24 }} color="#111" /> : null}
        {!!err && <Text style={styles.err}>{err}</Text>}
        {!loading && markers.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No map pins yet</Text>
            <Text style={styles.emptySub}>
              Reports need saved coordinates to appear as pins. Open the feed to read every warning — or report with a
              precise spot when your schema supports it.
            </Text>
            <Pressable style={styles.emptyBtn} onPress={() => router.push('/scam-alerts' as never)}>
              <Text style={styles.emptyBtnText}>Open feed</Text>
            </Pressable>
          </View>
        ) : null}
        {!loading && markers.length > 0 ? (
          <WebView
            originWhitelist={['*']}
            source={{ html }}
            style={[styles.webview, { minHeight: Dimensions.get('window').height * 0.58 }]}
            startInLoadingState
            setBuiltInZoomControls={Platform.OS === 'android'}
          />
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFF' },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  bannerText: { flex: 1, fontSize: 12, color: '#444', lineHeight: 17, fontWeight: '500' },
  err: { color: '#C62828', padding: 16, fontSize: 13 },
  webview: { flex: 1 },
  empty: { padding: 24, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  emptyBtn: { backgroundColor: '#111', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
});
