import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useCity } from '@/contexts/CityContext';
import { trackEvent } from '@/lib/analytics';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { renderSafeText } from '@/lib/renderSafeText';
import { fetchScamAlerts, type ScamAlertRow } from '@/services/scamAlerts';

const PREVIEW_MAX = 2;

/**
 * Compact home card: bandiTEAM traveler tips (premium tone — not a fear banner).
 */
export default function BandiTeamLiveAlertsCard() {
  const router = useRouter();
  const { selectedCity } = useCity();
  const city = useMemo(() => renderSafeText(selectedCity, '').trim(), [selectedCity]);

  const [rows, setRows] = useState<ScamAlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const data = await fetchScamAlerts({ city: city || null });
      setRows(data.slice(0, PREVIEW_MAX));
    } catch (e: unknown) {
      const msg = e instanceof Error ? renderSafeText(e.message, 'Could not load') : 'Could not load alerts';
      setErr(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [city]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const openFeed = () => {
    void trackEvent({
      eventName: 'banditeam_home_card_cta',
      referenceType: 'view_alerts',
      referenceId: city || 'all',
    });
    if (city) router.push({ pathname: '/scam-alerts', params: { city } } as never);
    else router.push('/scam-alerts' as never);
  };

  const openReport = () => {
    void trackEvent({
      eventName: 'banditeam_home_card_cta',
      referenceType: 'report',
      referenceId: city || 'all',
    });
    router.push('/bandiTeam/report' as never);
  };

  return (
    <View style={styles.card} testID="banditeam-home-alerts-card">
      <Text style={styles.kicker}>bandiTEAM</Text>
      <Text style={styles.title}>Travel Scam Alerts Nearby</Text>
      <Text style={styles.subtitle}>
        Scams, unsafe zones, overpricing, and taxi tricks — crowdsourced by travelers near you.
      </Text>

      {loading ? (
        <ActivityIndicator style={styles.loader} color="#888" />
      ) : err ? (
        <Text style={styles.err}>{err}</Text>
      ) : rows.length === 0 ? (
        <Text style={styles.hint}>No tips here yet — open Alerts to browse or add one.</Text>
      ) : (
        <View style={styles.preview}>
          {rows.map((r, index) => (
            <View key={renderSafeText(r.id, String(index))} style={[styles.previewLine, index > 0 && styles.previewDivider]}>
              <Text style={styles.previewTitle} numberOfLines={1}>
                {renderSafeText(r.title, 'Tip')}
              </Text>
              <Text style={styles.previewMeta} numberOfLines={1}>
                {formatRelativeTime(renderSafeText(r.created_at, ''))}
                {city ? ` · ${city}` : r.city ? ` · ${renderSafeText(r.city, '')}` : ''}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          onPress={openFeed}
          style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="View alerts"
        >
          <Text style={styles.btnPrimaryText}>View Alerts</Text>
        </Pressable>
        <Pressable
          onPress={openReport}
          style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Report alert"
        >
          <Text style={styles.btnSecondaryText}>Report Alert</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 18,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6E6E6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0a7ea4',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    fontWeight: '500',
    marginBottom: 14,
  },
  loader: { marginVertical: 12 },
  err: { color: '#B00020', fontSize: 13, marginBottom: 8, fontWeight: '600' },
  hint: { fontSize: 13, color: '#777', lineHeight: 19, marginBottom: 8 },
  preview: {
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  previewLine: { paddingVertical: 6 },
  previewDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E0E0',
  },
  previewTitle: { fontSize: 14, fontWeight: '700', color: '#222' },
  previewMeta: { fontSize: 12, color: '#888', marginTop: 2, fontWeight: '500' },
  actions: { flexDirection: 'row', gap: 10 },
  btnPrimary: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  btnSecondary: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  btnSecondaryText: { color: '#111', fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.88 },
});
