import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { fetchScamAlerts, type ScamAlertRow } from '@/services/scamAlerts';

type Props = {
  city: string;
  areaLabel?: string;
};

const MAX = 4;

/**
 * Contextual bandiTEAM placement on venue / event detail — same public feed, scoped by city.
 */
export function VenueScamWarningsSection({ city, areaLabel }: Props) {
  const router = useRouter();
  const c = city?.trim();
  const [rows, setRows] = useState<ScamAlertRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!c) {
      setRows([]);
      setLoading(false);
      return;
    }
    try {
      const data = await fetchScamAlerts({ city: c });
      setRows(data.slice(0, MAX));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [c]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  if (!c) return null;

  const openFeed = () => router.push({ pathname: '/scam-alerts', params: { city: c } } as never);

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Recent warnings here</Text>
      <Text style={styles.sub}>
        bandiTEAM community reports{areaLabel ? ` · ${areaLabel}` : ''} · {c}
      </Text>
      {loading ? (
        <ActivityIndicator style={{ marginVertical: 10 }} />
      ) : rows.length === 0 ? (
        <Text style={styles.none}>No scam alerts in this city yet. Tap below to see other destinations or report.</Text>
      ) : (
        <View>
          {rows.map((r) => (
            <Pressable key={r.id} onPress={openFeed} style={styles.row}>
              <Text style={styles.rowTitle} numberOfLines={2}>
                {r.title}
              </Text>
              <Text style={styles.rowMeta}>
                {r.location?.trim() || r.city} · {formatRelativeTime(r.created_at)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <Pressable onPress={openFeed} style={styles.linkBtn}>
        <Text style={styles.linkBtnText}>Scam reports nearby — open feed</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FFF8E6',
    borderWidth: 1,
    borderColor: '#F0D78C',
  },
  title: { fontSize: 16, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  sub: { fontSize: 12, color: '#5c4a00', lineHeight: 17, marginBottom: 8 },
  none: { fontSize: 13, color: '#666', lineHeight: 18 },
  row: {
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#FFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8DCB8',
  },
  rowTitle: { fontSize: 14, fontWeight: '700', color: '#222' },
  rowMeta: { fontSize: 11, color: '#777', marginTop: 4 },
  linkBtn: { marginTop: 12, alignSelf: 'flex-start' },
  linkBtnText: { fontSize: 13, fontWeight: '800', color: '#0a7ea4', textDecorationLine: 'underline' },
});
