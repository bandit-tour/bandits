import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getEvents } from '@/app/services/events';
import { fetchGooglePlacePhotoUrl, getCategoryFallbackImage } from '@/lib/placePhoto';
import { getSpotsByBanditId } from '@/services/spots';
import { mergeVibeSequence, type VibeStop } from '@/services/vibeRoute';
import { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

type EventRow = Database['public']['Tables']['event']['Row'];
type BanditRow = Database['public']['Tables']['bandit']['Row'];

function VibeStopImage({ stop }: { stop: VibeStop }) {
  const [attempt, setAttempt] = useState(0);
  const [remote, setRemote] = useState<string | null>(null);
  const [remoteDone, setRemoteDone] = useState(false);

  const fallbackPicsum = getCategoryFallbackImage(stop.category, stop.key, 800, 600);

  const uris = useMemo(() => {
    const list = [...stop.imageCandidates];
    if (remote) list.push(remote);
    list.push(fallbackPicsum);
    return list;
  }, [stop.imageCandidates, stop.key, remote, fallbackPicsum]);

  useEffect(() => {
    setAttempt(0);
    setRemote(null);
  }, [stop.key]);

  useEffect(() => {
    setRemoteDone(false);
    let cancelled = false;
    void (async () => {
      if (stop.imageCandidates.length > 0) {
        setRemoteDone(true);
        return;
      }
      if (stop.kind === 'event' && stop.eventId) {
        const { data } = await supabase.from('event').select('*').eq('id', stop.eventId).maybeSingle();
        if (cancelled || !data) {
          setRemoteDone(true);
          return;
        }
        const ev = data as EventRow;
        const url = await fetchGooglePlacePhotoUrl({
          name: ev.name,
          address: ev.address,
          city: ev.city,
          neighborhood: ev.neighborhood,
        });
        if (url && !cancelled) setRemote(url);
        setRemoteDone(true);
        return;
      }
      const url = await fetchGooglePlacePhotoUrl({
        name: stop.name,
        address: stop.address,
        city: '',
        neighborhood: '',
      });
      if (url && !cancelled) setRemote(url);
      setRemoteDone(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [stop.key, stop.kind, stop.eventId, stop.name, stop.address, stop.imageCandidates.length]);

  const safeIndex = Math.min(attempt, uris.length - 1);
  const uri = uris[safeIndex] ?? fallbackPicsum;
  const showLoader = stop.imageCandidates.length === 0 && !remoteDone && !remote;

  if (showLoader) {
    return (
      <View style={[styles.stopImage, styles.vibeImageLoading]}>
        <ActivityIndicator size="small" color="#888" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={styles.stopImage}
      resizeMode="cover"
      onError={() => {
        if (attempt < uris.length - 1) setAttempt((a) => a + 1);
      }}
    />
  );
}

export default function VibeRouteScreen() {
  const { banditId: rawId } = useLocalSearchParams<{ banditId: string }>();
  const banditId = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bandit, setBandit] = useState<BanditRow | null>(null);
  const [stops, setStops] = useState<VibeStop[]>([]);

  useEffect(() => {
    if (!banditId) return;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: b, error: bErr } = await supabase
          .from('bandit')
          .select('*')
          .eq('id', banditId)
          .single();
        if (bErr || !b) throw new Error('Could not load local banDit.');
        setBandit(b as BanditRow);

        const events = await getEvents({ banditId });
        const eventList = (events || []) as EventRow[];

        const { data: tipRows } = await supabase
          .from('bandit_event')
          .select('event_id, personal_tip')
          .eq('bandit_id', banditId);

        const tipsByEventId: Record<string, string | null | undefined> = {};
        (tipRows as { event_id: string; personal_tip: string | null }[] | null)?.forEach((row) => {
          tipsByEventId[row.event_id] = row.personal_tip;
        });

        let spotRows: { id: string; name: string; address?: string; city?: string; description?: string; image_url?: string; category?: string }[] = [];
        try {
          spotRows = await getSpotsByBanditId(banditId);
        } catch {
          spotRows = [];
        }

        const sequence = mergeVibeSequence(eventList, tipsByEventId, spotRows as any);
        setStops(sequence);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [banditId]);

  const title = useMemo(() => {
    if (!bandit) return 'Vibe route';
    return `${bandit.name}’s thread`;
  }, [bandit]);

  const openStop = useCallback(
    (stop: VibeStop) => {
      if (stop.kind === 'event' && stop.eventId) {
        router.push(`/spot/${stop.eventId}?banditId=${encodeURIComponent(banditId!)}` as any);
        return;
      }
      const q = encodeURIComponent(stop.address || stop.name);
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
    },
    [banditId, router],
  );

  if (!banditId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.err}>Missing banDit.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: '' }} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: '' }} />
        <View style={styles.centered}>
          <Text style={styles.err}>{error}</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: '' }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.kicker}>Curated vibe</Text>
        <Text style={styles.headline}>{title}</Text>
        <Text style={styles.intro}>
          A short route in order — tap a stop to open details or maps. Pulled from this local banDit’s picks.
        </Text>

        {stops.length === 0 ? (
          <Text style={styles.empty}>
            No places are linked yet. Add picks in the guide, then try again.
          </Text>
        ) : (
          stops.map((stop) => (
            <Pressable key={stop.key} style={styles.card} onPress={() => openStop(stop)}>
              <View style={styles.stepRow}>
                <Text style={styles.stepNum}>{stop.order}</Text>
                <View style={styles.stepBody}>
                  <View style={styles.imageWrap}>
                    <VibeStopImage stop={stop} />
                  </View>
                  <Text style={styles.category}>{stop.category}</Text>
                  <Text style={styles.placeName}>{stop.name}</Text>
                  <Text style={styles.vibeLine}>{stop.vibeLine}</Text>
                  <Text style={styles.address}>{stop.address}</Text>
                </View>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  err: { color: '#B00020', fontSize: 15, textAlign: 'center' },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF3B30',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  headline: {
    fontFamily: 'Caros',
    fontWeight: '800',
    fontSize: 24,
    color: '#222',
    marginBottom: 8,
  },
  intro: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 20,
  },
  empty: { fontSize: 14, color: '#666' },
  card: {
    backgroundColor: '#F8F8F8',
    borderRadius: 14,
    marginBottom: 14,
    overflow: 'hidden',
  },
  stepRow: { flexDirection: 'row', padding: 12 },
  stepNum: {
    width: 28,
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
    marginRight: 8,
    paddingTop: 4,
  },
  stepBody: { flex: 1 },
  imageWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  stopImage: { width: '100%', height: '100%' },
  vibeImageLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  category: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF3B30',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  placeName: { fontSize: 17, fontWeight: '700', color: '#222', marginBottom: 6 },
  vibeLine: { fontSize: 14, color: '#444', lineHeight: 20, marginBottom: 8 },
  address: { fontSize: 13, color: '#666' },
});
