import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

function formatDateTime(iso?: string): string {
  const v = String(iso || '').trim();
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function NotificationDetailScreen() {
  const { title, message, createdAt } = useLocalSearchParams<{
    title?: string;
    message?: string;
    createdAt?: string;
  }>();

  const safeTitle = useMemo(() => {
    const t = Array.isArray(title) ? title[0] : title;
    return (t && t.trim()) || 'Notification';
  }, [title]);

  const safeMessage = useMemo(() => {
    const m = Array.isArray(message) ? message[0] : message;
    return (m && m.trim()) || 'No details provided.';
  }, [message]);

  const createdLabel = useMemo(() => {
    const c = Array.isArray(createdAt) ? createdAt[0] : createdAt;
    return formatDateTime(c);
  }, [createdAt]);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Notification', headerBackTitle: 'Back' }} />
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.typePill}>Live Alert</Text>
          <Text style={styles.title}>{safeTitle}</Text>
          <Text style={styles.message}>{safeMessage}</Text>
          {!!createdLabel && <Text style={styles.time}>{createdLabel}</Text>}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F7F9',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E4E4E7',
  },
  typePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#EAF4FF',
    color: '#0A7EA4',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    color: '#2C2C2C',
  },
  time: {
    marginTop: 16,
    fontSize: 12,
    color: '#6A6A6A',
    fontWeight: '600',
  },
});
