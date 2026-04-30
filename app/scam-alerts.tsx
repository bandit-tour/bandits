import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useFocusEffect } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  FlatList,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import { useCity } from '@/contexts/CityContext';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { trackEvent } from '@/lib/analytics';
import { usePremiumRefreshControl } from '@/lib/mobilePullToRefresh';
import { getSavedAlertIds, toggleSavedAlertId } from '@/lib/banditeamSavedAlerts';
import { renderSafeText } from '@/lib/renderSafeText';
import { severityAccent } from '@/lib/scamAlertTrust';
import { BANDITS_NOTIFICATIONS_REFRESH } from '@/lib/notificationEvents';
import { supabase } from '@/lib/supabase';
import { fetchScamAlerts, type ScamAlertRow } from '@/services/scamAlerts';

function asTrimmedString(v: unknown): string {
  return renderSafeText(v, '').trim();
}

function categoryIcon(category: string): keyof typeof Ionicons.glyphMap {
  const c = (category || '').toLowerCase();
  if (c.includes('taxi') || c.includes('transport')) return 'car-outline';
  if (c.includes('night')) return 'moon-outline';
  if (c.includes('pickpocket') || c.includes('theft')) return 'hand-left-outline';
  if (c.includes('tourist')) return 'alert-circle-outline';
  if (c.includes('venue')) return 'wine-outline';
  return 'shield-outline';
}

function ReportAlertHeaderButton() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push('/bandiTeam/report' as never)}
      style={styles.headerReportBtn}
      accessibilityRole="button"
      accessibilityLabel="Report a new safety alert"
    >
      <Text style={styles.headerReportBtnText}>Report Alert</Text>
    </Pressable>
  );
}

function ScamAlertsHeaderActions({ filterCity }: { filterCity: string }) {
  const router = useRouter();
  const openMap = () => {
    void trackEvent({
      eventName: 'banditeam_feed_map_opened',
      referenceType: filterCity ? 'city' : 'all',
      referenceId: filterCity || 'all',
    });
    if (filterCity) {
      router.push({ pathname: '/scam-alerts-map', params: { city: filterCity } } as never);
    } else {
      router.push('/scam-alerts-map' as never);
    }
  };
  return (
    <View style={styles.headerActions}>
      <Pressable onPress={openMap} style={styles.headerMapBtn} accessibilityLabel="Open safety map">
        <Ionicons name="map-outline" size={22} color="#111" />
      </Pressable>
      <ReportAlertHeaderButton />
    </View>
  );
}

function SeverityMeter({ severity }: { severity: number }) {
  const raw = Number(severity);
  const s = raw >= 3 ? 3 : raw <= 1 ? 1 : 2;
  const { bar } = severityAccent(s);
  return (
    <View style={styles.severityMeter} accessibilityLabel={`Severity ${s} of 3`}>
      {[1, 2, 3].map((i) => (
        <View
          key={i}
          style={[
            styles.severitySeg,
            { backgroundColor: i <= s ? bar : 'rgba(0,0,0,0.08)' },
          ]}
        />
      ))}
    </View>
  );
}

type RowProps = {
  item: ScamAlertRow;
  saved: boolean;
  onPress: () => void;
  onShare: () => void;
  onToggleSave: () => void;
};

function ScamAlertSwipeRow({ item, saved, onPress, onShare, onToggleSave }: RowProps) {
  const swipeRef = useRef<Swipeable | null>(null);
  const accent = severityAccent(item.severity);

  const renderRight = useCallback(
    () => (
      <Pressable
        onPress={() => {
          swipeRef.current?.close();
          onShare();
        }}
        style={styles.swipeShare}
        accessibilityRole="button"
        accessibilityLabel="Share alert"
      >
        <Ionicons name="share-outline" size={22} color="#FFF" />
        <Text style={styles.swipeShareText}>Share</Text>
      </Pressable>
    ),
    [onShare],
  );

  const renderLeft = useCallback(
    () => (
      <Pressable
        onPress={() => {
          swipeRef.current?.close();
          onToggleSave();
        }}
        style={styles.swipeSave}
        accessibilityRole="button"
        accessibilityLabel={saved ? 'Remove saved' : 'Save alert'}
      >
        <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={22} color="#111" />
        <Text style={styles.swipeSaveText}>{saved ? 'Saved' : 'Save'}</Text>
      </Pressable>
    ),
    [onToggleSave, saved],
  );

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRight}
      renderLeftActions={renderLeft}
      overshootRight={false}
      overshootLeft={false}
    >
      <Pressable
        testID={`scam-alert-feed-row-${item.id}`}
        style={({ pressed }) => [
          styles.card,
          { borderLeftColor: accent.bar, borderLeftWidth: 4 },
          pressed && { opacity: 0.92 },
        ]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Open alert ${asTrimmedString(item.title)}`}
      >
        <View style={styles.cardInner}>
          <View style={styles.cardHeader}>
            <View style={styles.iconBubble}>
              <Ionicons name={categoryIcon(asTrimmedString(item.category))} size={20} color="#111" />
            </View>
            <View style={styles.badgeVerifiedRow}>
              <Text style={styles.communityBadge}>Community</Text>
              <SeverityMeter severity={item.severity} />
            </View>
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {asTrimmedString(item.title) || 'Alert'}
          </Text>
          {!!asTrimmedString(item.description) && (
            <Text style={styles.desc} numberOfLines={3}>
              {asTrimmedString(item.description)}
            </Text>
          )}
          <View style={styles.metaRow}>
            <View style={[styles.catChip, { borderColor: accent.bar }]}>
              <Text style={styles.catChipText}>{asTrimmedString(item.category) || 'Other'}</Text>
            </View>
            <Text style={styles.time}>{formatRelativeTime(asTrimmedString(item.created_at))}</Text>
          </View>
          <View style={styles.areaRow}>
            <Ionicons name="location-outline" size={16} color="#555" />
            <Text style={styles.areaLine} numberOfLines={2}>
              {[asTrimmedString(item.city), asTrimmedString(item.location)].filter(Boolean).join(' · ') ||
                'Area not specified'}
            </Text>
          </View>
        </View>
      </Pressable>
    </Swipeable>
  );
}

export default function ScamAlertsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ city?: string | string[] }>();
  const { selectedCity } = useCity();

  const cityFromParams = useMemo(() => {
    const raw = params.city;
    const s = Array.isArray(raw) ? raw[0] : raw;
    return typeof s === 'string' ? s.trim() : '';
  }, [params.city]);

  const filterCity = cityFromParams || asTrimmedString(selectedCity);
  const scopeLabel = filterCity ? asTrimmedString(filterCity) : 'All destinations';

  const [rows, setRows] = useState<ScamAlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());
  const analyticsBootRef = useRef(false);

  const loadSaved = useCallback(async () => {
    const ids = await getSavedAlertIds();
    setSavedSet(new Set(ids));
  }, []);

  useEffect(() => {
    void loadSaved();
  }, [loadSaved]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchScamAlerts({ city: filterCity || null });
      setRows(data);
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : 'Could not load alerts.';
      const msg = asTrimmedString(raw) || 'Could not load alerts.';
      setError(msg);
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterCity]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(BANDITS_NOTIFICATIONS_REFRESH, () => void load());
    return () => sub.remove();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void loadSaved();
    }, [loadSaved]),
  );

  useEffect(() => {
    void trackEvent({
      eventName: 'banditeam_feed_viewed',
      referenceType: filterCity ? 'city' : 'all',
      referenceId: filterCity || 'all',
    });
  }, [filterCity]);

  useEffect(() => {
    if (analyticsBootRef.current) return;
    analyticsBootRef.current = true;
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id ?? 'guest';
      const day = new Date().toISOString().slice(0, 10);
      void trackEvent({
        eventName: 'banditeam_session_day_active',
        referenceId: uid,
        onceKey: `banditeam_day_${day}_${uid}`,
      });
    })();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const listRefreshControl = usePremiumRefreshControl(refreshing, onRefresh);

  const shareItem = useCallback(
    async (item: ScamAlertRow) => {
      const url = Linking.createURL(`/scam-alert/${item.id}`);
      try {
        await Share.share({
          message: `${asTrimmedString(item.title) || 'Travel scam alert'}\n${url}`,
          ...(Platform.OS === 'web' ? { url } : {}),
        });
        void trackEvent({
          eventName: 'banditeam_alert_shared',
          referenceType: 'alert',
          referenceId: item.id,
        });
      } catch {
        // dismissed
      }
    },
    [],
  );

  const toggleSave = useCallback(
    async (item: ScamAlertRow) => {
      const next = await toggleSavedAlertId(item.id);
      setSavedSet((prev) => {
        const n = new Set(prev);
        if (next) n.add(item.id);
        else n.delete(item.id);
        return n;
      });
      void trackEvent({
        eventName: 'banditeam_alert_saved_toggle',
        referenceType: next ? 'save' : 'unsave',
        referenceId: item.id,
      });
    },
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: ScamAlertRow }) => (
      <View style={styles.rowWrap}>
        <ScamAlertSwipeRow
          item={item}
          saved={savedSet.has(item.id)}
          onPress={() => router.push(`/scam-alert/${item.id}` as never)}
          onShare={() => void shareItem(item)}
          onToggleSave={() => void toggleSave(item)}
        />
      </View>
    ),
    [router, savedSet, shareItem, toggleSave],
  );

  const listHeader = useMemo(
    () => {
      const dest = filterCity || asTrimmedString(selectedCity);
      const openDestinationFeed = () => {
        if (dest) {
          router.push({ pathname: '/scam-alerts', params: { city: dest } } as never);
        } else {
          router.push('/scam-alerts' as never);
        }
      };
      return (
        <View style={styles.listHeaderBlock}>
          <Text style={styles.poweredBy}>bandiTEAM</Text>
          <View style={styles.reportHero}>
            <Text style={styles.reportHeroTitle}>Community safety alerts</Text>
            <Text style={styles.reportHeroSub}>
              Real travelers helping real travelers stay safe.{'\n\n'}
              Report scams, fake taxis, tourist traps, pickpocket zones, and unsafe situations.{'\n\n'}
              Together we protect the holiday experience.
            </Text>
            <View style={styles.heroButtonsRow}>
              <Pressable
                style={styles.reportHeroBtn}
                onPress={() => router.push('/bandiTeam/report' as never)}
                accessibilityRole="button"
                accessibilityLabel="Report Alert"
              >
                <Text style={styles.reportHeroBtnText}>Report Alert</Text>
              </Pressable>
              <Pressable
                style={styles.openFeedBtn}
                onPress={openDestinationFeed}
                accessibilityRole="button"
                accessibilityLabel="Open Full Feed"
              >
                <Text style={styles.openFeedBtnText}>Open Full Feed</Text>
              </Pressable>
            </View>
          </View>
          <Pressable
            style={styles.destinationRead}
            testID="scam-alerts-destination-read"
            onPress={openDestinationFeed}
            accessibilityRole="button"
            accessibilityLabel="Open scam alerts for your destination"
          >
            <Text style={styles.destinationReadTitle}>Trusted local context for smart travelers</Text>
            <Text style={styles.destinationReadBody}>Concierge-level banDit protection, updated by bandiTEAM.</Text>
          </Pressable>
        </View>
      );
    },
    [router, filterCity, selectedCity],
  );

  const listFooter = useMemo(
    () => (
      <View style={styles.listFooter}>
        <Text style={styles.listFooterText}>Powered by bandiTEAM</Text>
      </View>
    ),
    [],
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'bandiTEAM',
          headerBackTitle: 'Back',
          headerRight: () => <ScamAlertsHeaderActions filterCity={filterCity} />,
        }}
      />
      <View style={styles.screen}>
        <Text style={styles.scope}>{scopeLabel}</Text>
        <Text style={styles.hint}>{filterCity ? 'Destination protection view' : 'Global protection view'}</Text>

        {loading && rows.length === 0 ? (
          <ActivityIndicator style={{ marginTop: 24 }} color="#111" />
        ) : null}
        {!!error && <Text style={styles.err}>{error}</Text>}

        <FlatList
          testID="scam-alerts-feed-list"
          data={rows}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          extraData={savedSet}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          contentContainerStyle={styles.listContent}
          refreshControl={listRefreshControl}
          ListEmptyComponent={
            !loading ? (
              <Text style={styles.empty}>
                No alerts yet.{'\n'}
                Stay sharp. If something happens, report it first.
              </Text>
            ) : null
          }
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F7F8',
  },
  scope: {
    fontSize: 11,
    fontWeight: '800',
    color: '#111',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    paddingHorizontal: 18,
    paddingTop: 16,
    maxWidth: 840,
    width: '100%',
    alignSelf: 'center',
  },
  hint: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 12,
    fontWeight: '600',
    maxWidth: 840,
    width: '100%',
    alignSelf: 'center',
  },
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 36,
    flexGrow: 1,
    width: '100%',
    maxWidth: 840,
    alignSelf: 'center',
  },
  listHeaderBlock: { marginBottom: 8 },
  destinationRead: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    padding: 16,
    marginBottom: 14,
  },
  destinationReadTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  destinationReadBody: {
    fontSize: 14,
    color: '#444',
    lineHeight: 21,
    fontWeight: '500',
  },
  poweredBy: { fontSize: 14, fontWeight: '800', color: '#111', letterSpacing: 0.2, marginBottom: 10, textAlign: 'left' },
  listFooter: { paddingVertical: 20, alignItems: 'center' },
  listFooterText: { fontSize: 12, fontWeight: '700', color: '#999', letterSpacing: 0.6 },
  rowWrap: { marginBottom: 14 },
  card: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  cardInner: { padding: 16, paddingLeft: 14 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeVerifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  communityBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1a237e',
    backgroundColor: '#E8EAF6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  severityMeter: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  severitySeg: { width: 14, height: 5, borderRadius: 3 },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  desc: {
    marginTop: 8,
    fontSize: 14,
    color: '#444',
    lineHeight: 21,
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  catChip: {
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FFF',
  },
  catChipText: { fontSize: 12, fontWeight: '800', color: '#222' },
  time: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
  },
  areaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10 },
  areaLine: {
    flex: 1,
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
    lineHeight: 18,
  },
  swipeShare: {
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    width: 88,
    marginBottom: 14,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
  },
  swipeShareText: { color: '#FFF', fontSize: 12, fontWeight: '800', marginTop: 4 },
  swipeSave: {
    backgroundColor: '#FFD54F',
    justifyContent: 'center',
    alignItems: 'center',
    width: 88,
    marginBottom: 14,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  swipeSaveText: { color: '#111', fontSize: 12, fontWeight: '800', marginTop: 4 },
  err: {
    color: '#C62828',
    fontSize: 13,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  empty: {
    fontSize: 15,
    color: '#4A4A4A',
    textAlign: 'center',
    marginTop: 36,
    paddingHorizontal: 24,
    lineHeight: 23,
    fontWeight: '600',
  },
  headerReportBtn: {
    marginRight: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  headerReportBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0a7ea4',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerMapBtn: {
    marginRight: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reportHero: {
    backgroundColor: '#111',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },
  reportHeroTitle: { color: '#FFF', fontSize: 25, fontWeight: '800', marginBottom: 10, lineHeight: 31 },
  reportHeroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 15, lineHeight: 24, marginBottom: 16, fontWeight: '500' },
  heroButtonsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  reportHeroBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFD54F',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  reportHeroBtnText: { color: '#111', fontSize: 14, fontWeight: '900' },
  openFeedBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  openFeedBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
});
