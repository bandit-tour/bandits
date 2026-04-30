import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { usePremiumRefreshControl } from '@/lib/mobilePullToRefresh';
import { buildTrustBadges, buildTrustContextFromRows, severityAccent, type TrustBadge } from '@/lib/scamAlertTrust';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { trackEvent } from '@/lib/analytics';
import { renderSafeText } from '@/lib/renderSafeText';
import {
  fetchRelatedScamAlerts,
  fetchScamAlertById,
  fetchScamAlerts,
  type ScamAlertRow,
} from '@/services/scamAlerts';

function TrustPill({ badge }: { badge: TrustBadge }) {
  const bg =
    badge.tone === 'gold'
      ? 'rgba(255,213,79,0.22)'
      : badge.tone === 'navy'
        ? '#E8EAF6'
        : badge.tone === 'amber'
          ? 'rgba(245,124,0,0.18)'
          : badge.tone === 'rose'
            ? 'rgba(198,40,40,0.12)'
            : 'rgba(15,23,42,0.08)';
  const fg =
    badge.tone === 'gold'
      ? '#6D4C00'
      : badge.tone === 'navy'
        ? '#1a237e'
        : badge.tone === 'amber'
          ? '#B45309'
          : badge.tone === 'rose'
            ? '#B71C1C'
            : '#334155';
  return (
    <View style={[styles.trustPill, { backgroundColor: bg }]}>
      <Text style={[styles.trustPillText, { color: fg }]}>{badge.label}</Text>
    </View>
  );
}

export default function ScamAlertDetailScreen() {
  const router = useRouter();
  const { id: rawId } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = typeof rawId === 'string' ? rawId.trim() : Array.isArray(rawId) ? String(rawId[0] ?? '').trim() : '';

  const [row, setRow] = useState<ScamAlertRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [related, setRelated] = useState<ScamAlertRow[]>([]);
  const [cityRows, setCityRows] = useState<ScamAlertRow[]>([]);
  const [openedTracked, setOpenedTracked] = useState(false);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!id) {
      setError('Missing alert id.');
      setRow(null);
      if (!silent) setLoading(false);
      return;
    }
    setError(null);
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await fetchScamAlertById(id);
      setRow(data);
      if (!data) setError('This alert is no longer available.');
    } catch (e: unknown) {
      setError(e instanceof Error ? renderSafeText(e.message, 'Could not load this alert.') : 'Could not load this alert.');
      setRow(null);
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!row || openedTracked) return;
    setOpenedTracked(true);
    void trackEvent({
      eventName: 'banditeam_alert_opened',
      referenceType: 'alert',
      referenceId: row.id,
    });
  }, [row, openedTracked]);

  useEffect(() => {
    if (!row) return;
    let cancelled = false;
    void (async () => {
      try {
        const all = await fetchScamAlerts({ city: row.city });
        if (cancelled) return;
        setCityRows(all);
        const rel = await fetchRelatedScamAlerts({
          excludeId: row.id,
          city: row.city,
          location: row.location,
          category: row.category,
          limit: 8,
        });
        if (cancelled) return;
        setRelated(rel);
      } catch {
        if (!cancelled) {
          setRelated([]);
          setCityRows([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [row]);

  const trustBadges = useMemo(() => {
    if (!row) return [];
    const ctx = buildTrustContextFromRows(row, cityRows.length > 0 ? cityRows : [row]);
    return buildTrustBadges(row, ctx);
  }, [row, cityRows]);

  const accent = row ? severityAccent(row.severity) : severityAccent(2);
  const postedAbsolute = row
    ? new Date(renderSafeText(row.created_at, '')).toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const openMaps = () => {
    if (!row?.location_lat || !row?.location_lng) return;
    const q = `${row.location_lat},${row.location_lng}`;
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`);
  };

  const shareAlert = async () => {
    if (!row) return;
    const path = `/scam-alert/${row.id}`;
    const url = Linking.createURL(path);
    try {
      await Share.share({
        message: `${renderSafeText(row.title, 'Travel scam alert')}\n${url}`,
        ...(Platform.OS === 'web' ? { url } : {}),
      });
      void trackEvent({
        eventName: 'banditeam_alert_shared',
        referenceType: 'alert',
        referenceId: row.id,
      });
    } catch {
      // user dismissed
    }
  };

  const onRefreshAlert = useCallback(() => {
    void load({ silent: true });
  }, [load]);
  const scamAlertDetailRefresh = usePremiumRefreshControl(refreshing, onRefreshAlert);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Alert',
          headerBackTitle: 'Back',
          headerRight: () =>
            row ? (
              <Pressable onPress={() => void shareAlert()} style={styles.headerIconBtn} accessibilityLabel="Share alert">
                <Ionicons name="share-outline" size={22} color="#111" />
              </Pressable>
            ) : null,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        testID="scam-alert-detail-root"
        refreshControl={scamAlertDetailRefresh}
      >
        {loading ? (
          <ActivityIndicator style={{ marginTop: 32 }} color="#111" />
        ) : error && !row ? (
          <View style={styles.centerBlock}>
            <Text style={styles.err}>{error}</Text>
            <Pressable style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button">
              <Text style={styles.backBtnText}>Go back</Text>
            </Pressable>
          </View>
        ) : row ? (
          <View>
            <View style={[styles.severityBar, { backgroundColor: accent.bar }]} />

            <View style={styles.heroCard}>
              <View style={styles.badgeRow}>
                <View style={styles.communityBadge}>
                  <Ionicons name="people-outline" size={14} color="#1a237e" style={{ marginRight: 4 }} />
                  <Text style={styles.communityBadgeText}>Community report</Text>
                </View>
                {row.admin_verified === true ? (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="shield-checkmark" size={14} color="#0D47A1" />
                    <Text style={styles.verifiedBadgeText}>Verified</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.title}>{renderSafeText(row.title, 'Alert')}</Text>

              <View style={styles.metaGrid}>
                <View style={[styles.metaTile, { backgroundColor: accent.soft }]}>
                  <Text style={styles.metaLabel}>Severity</Text>
                  <Text style={[styles.metaValue, { color: accent.bar }]}>{accent.label}</Text>
                  <Text style={styles.metaHint}>Level {Math.min(3, Math.max(1, Math.round(Number(row.severity) || 2)))} of 3</Text>
                </View>
                <View style={styles.metaTile}>
                  <Text style={styles.metaLabel}>Posted</Text>
                  <Text style={styles.metaValue}>{formatRelativeTime(renderSafeText(row.created_at, ''))}</Text>
                  <Text style={styles.metaHint}>{postedAbsolute}</Text>
                </View>
              </View>

              <View style={styles.areaBlock}>
                <Text style={styles.areaLabel}>Exact area</Text>
                <Text style={styles.areaValue}>
                  {[renderSafeText(row.city, '').trim(), renderSafeText(row.location, '').trim()]
                    .filter(Boolean)
                    .join(' · ') || 'Area not specified'}
                </Text>
              </View>

              {row.location_lat != null && row.location_lng != null ? (
                <Pressable style={styles.mapsBtn} onPress={openMaps} accessibilityRole="button">
                  <Ionicons name="map-outline" size={18} color="#111" />
                  <Text style={styles.mapsBtnText}>Open in Maps</Text>
                </Pressable>
              ) : null}
            </View>

            {trustBadges.length > 0 ? (
              <View style={styles.trustSection}>
                <Text style={styles.sectionTitle}>Trust signals</Text>
                <View style={styles.trustWrap}>
                  {trustBadges.map((b) => (
                    <TrustPill key={b.key} badge={b} />
                  ))}
                </View>
                {trustBadges.some((b) => b.hint) ? (
                  <Text style={styles.trustFoot}>
                    {trustBadges.map((b) => b.hint).filter(Boolean).slice(0, 2).join(' ')}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Full report</Text>
              {!!renderSafeText(row.description, '').trim() ? (
                <Text style={styles.body}>{renderSafeText(row.description, '').trim()}</Text>
              ) : (
                <Text style={styles.bodyMuted}>No additional description.</Text>
              )}
              {!!renderSafeText(row.image_url, '').trim() && (
                <Image
                  source={{ uri: renderSafeText(row.image_url, '').trim() }}
                  style={styles.heroImg}
                  resizeMode="cover"
                />
              )}
              <View style={styles.catRow}>
                <Ionicons name="pricetag-outline" size={16} color="#555" />
                <Text style={styles.category}>{renderSafeText(row.category, 'Other') || 'Other'}</Text>
              </View>
            </View>

            {related.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Related nearby</Text>
                <Text style={styles.sectionSub}>Same city · overlapping area or category</Text>
                {related.map((r) => (
                  <Pressable
                    key={r.id}
                    style={({ pressed }) => [styles.relatedRow, pressed && { opacity: 0.85 }]}
                    onPress={() => router.push(`/scam-alert/${r.id}` as never)}
                  >
                    <View style={[styles.relatedAccent, { backgroundColor: severityAccent(r.severity).bar }]} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.relatedTitle} numberOfLines={2}>
                        {renderSafeText(r.title, 'Alert')}
                      </Text>
                      <Text style={styles.relatedMeta} numberOfLines={1}>
                        {formatRelativeTime(renderSafeText(r.created_at, ''))} · {renderSafeText(r.location, '')}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#999" />
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View style={styles.growthCard}>
              <Text style={styles.growthTitle}>Seen something too?</Text>
              <Text style={styles.growthSub}>Help travelers — add a quick warning for the same area or category.</Text>
              <Pressable
                style={styles.growthCta}
                onPress={() => router.push('/bandiTeam/report' as never)}
                accessibilityRole="button"
              >
                <Text style={styles.growthCtaText}>Report alert</Text>
                <Ionicons name="arrow-forward" size={18} color="#111" />
              </Pressable>
            </View>

            <View style={styles.similarRow}>
              <Pressable
                style={styles.secondaryCta}
                onPress={() => router.push('/bandiTeam/report' as never)}
                accessibilityRole="button"
                accessibilityLabel="Report a similar issue"
              >
                <Ionicons name="warning-outline" size={18} color="#111" />
                <Text style={styles.secondaryCtaText}>Report similar issue</Text>
              </Pressable>
            </View>

            <Text style={styles.disclaimer}>
              Crowdsourced traveler safety. bandiTEAM does not independently verify every report unless marked verified.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 48 },
  centerBlock: { marginTop: 32, alignItems: 'center', paddingHorizontal: 24 },
  err: { color: '#C62828', fontSize: 15, textAlign: 'center', marginBottom: 16, fontWeight: '600' },
  backBtn: {
    borderWidth: 1,
    borderColor: '#111',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backBtnText: { fontSize: 15, fontWeight: '700', color: '#111' },
  headerIconBtn: { paddingHorizontal: 14, paddingVertical: 8 },
  severityBar: { height: 5, width: '100%' },
  heroCard: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  communityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8EAF6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  communityBadgeText: { fontSize: 12, fontWeight: '800', color: '#1a237e' },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  verifiedBadgeText: { fontSize: 12, fontWeight: '800', color: '#0D47A1' },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111',
    letterSpacing: -0.5,
    lineHeight: 30,
    marginBottom: 16,
  },
  metaGrid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  metaTile: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#FFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E8E8',
  },
  metaLabel: { fontSize: 11, fontWeight: '700', color: '#777', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  metaValue: { fontSize: 16, fontWeight: '800', color: '#111' },
  metaHint: { fontSize: 12, color: '#666', marginTop: 4, fontWeight: '500' },
  areaBlock: { marginBottom: 12 },
  areaLabel: { fontSize: 11, fontWeight: '700', color: '#777', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  areaValue: { fontSize: 16, fontWeight: '700', color: '#222', lineHeight: 22 },
  mapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#FFD54F',
  },
  mapsBtnText: { fontSize: 14, fontWeight: '900', color: '#111' },
  trustSection: { paddingHorizontal: 20, paddingTop: 18 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#111', letterSpacing: 0.4, marginBottom: 10, textTransform: 'uppercase' },
  sectionSub: { fontSize: 12, color: '#777', marginTop: -6, marginBottom: 10, fontWeight: '500' },
  trustWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  trustPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  trustPillText: { fontSize: 12, fontWeight: '800' },
  trustFoot: { fontSize: 12, color: '#666', marginTop: 10, lineHeight: 17 },
  section: { paddingHorizontal: 20, paddingTop: 22 },
  body: { fontSize: 16, color: '#222', lineHeight: 24, fontWeight: '500' },
  bodyMuted: { fontSize: 15, color: '#888', fontStyle: 'italic' },
  heroImg: { width: '100%', height: 220, borderRadius: 16, marginTop: 16, backgroundColor: '#EEE' },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  category: { fontSize: 14, fontWeight: '700', color: '#444' },
  relatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEE',
    gap: 10,
  },
  relatedAccent: { width: 4, borderRadius: 2, minHeight: 40 },
  relatedTitle: { fontSize: 15, fontWeight: '700', color: '#111' },
  relatedMeta: { fontSize: 12, color: '#777', marginTop: 2 },
  growthCard: {
    marginHorizontal: 20,
    marginTop: 28,
    padding: 20,
    borderRadius: 18,
    backgroundColor: '#111',
  },
  growthTitle: { color: '#FFF', fontSize: 18, fontWeight: '800', marginBottom: 6 },
  growthSub: { color: 'rgba(255,255,255,0.78)', fontSize: 14, lineHeight: 20, marginBottom: 14, fontWeight: '500' },
  growthCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFD54F',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  growthCtaText: { fontSize: 16, fontWeight: '900', color: '#111' },
  similarRow: { paddingHorizontal: 20, marginTop: 12 },
  secondaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#111',
    backgroundColor: '#FFF',
  },
  secondaryCtaText: { fontSize: 15, fontWeight: '800', color: '#111' },
  disclaimer: {
    marginHorizontal: 20,
    marginTop: 20,
    fontSize: 11,
    color: '#999',
    lineHeight: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
});
