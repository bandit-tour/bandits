import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { getEvents } from '@/app/services/events';
import {
  fetchGooglePlacePhotoUrls,
  fetchTrustedPlaceIdPhotoUrls,
  normalizeEventImageUri,
} from '@/lib/placePhoto';
import { Image as ExpoImage } from 'expo-image';
import LeafletMapView from '@/components/LeafletMapView';
import { ATHENS_CENTER } from '@/lib/mapCoordinates';
import { readGuideView, writeGuideView, markGuideReturn, type GuideCamera } from '@/lib/guideViewMemory';
import { ensureAnonymousSession } from '@/lib/pilotSession';
import { buildTastefulCategoryIllustration } from '@/lib/recommendationImages';
import { getSpotsByBanditId } from '@/services/spots';
import { mergeVibeSequence, type VibeStop } from '@/services/vibeRoute';
import { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { useAppBackScreenOptions } from '@/hooks/useAppBackScreenOptions';

type EventRow = Database['public']['Tables']['event']['Row'];
type BanditRow = Database['public']['Tables']['bandit']['Row'];

function VibeStopImage({ stop }: { stop: VibeStop }) {
  const [attempt, setAttempt] = useState(0);
  const [live, setLive] = useState<string[]>([]);
  const [liveDone, setLiveDone] = useState(false);
  const storedKey = stop.imageCandidates.join('|');

  useEffect(() => {
    setAttempt(0);
    setLive([]);
    setLiveDone(false);
  }, [stop.key, storedKey]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        let urls = stop.placeId ? await fetchTrustedPlaceIdPhotoUrls(stop.placeId, 4) : [];
        if (urls.length === 0) {
          urls = await fetchGooglePlacePhotoUrls({
            placeId: stop.placeId,
            name: stop.name,
            address: stop.address,
            city: 'Athens',
            neighborhood: '',
            limit: 4,
          });
        }
        const cleaned = urls
          .map((u) => normalizeEventImageUri(u) ?? u)
          .filter((u) => /^https?:\/\//i.test(u));
        if (!cancelled && cleaned.length > 0) setLive(cleaned);
      } catch (e) {
        console.warn('[VibeStopImage] place photo fetch failed', stop.key, e instanceof Error ? e.message : e);
      } finally {
        if (!cancelled) setLiveDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stop.address, stop.key, stop.name, stop.placeId]);

  useEffect(() => {
    if (live.length > 0) setAttempt(0);
  }, [live]);

  const realUris = live.length > 0 ? live : stop.imageCandidates;
  const uri = realUris[attempt];
  if (!uri) {
    if (!liveDone) {
      return (
        <View style={[styles.stopImage, styles.vibeImageLoading]}>
          <ActivityIndicator size="small" color="#888" />
        </View>
      );
    }
    return (
      <ExpoImage
        source={{ uri: buildTastefulCategoryIllustration(stop.name, stop.category) }}
        style={styles.stopImage}
        contentFit="cover"
        accessibilityLabel={`vibe-stop-fallback:${stop.key}`}
      />
    );
  }

  return (
    <ExpoImage
      source={{ uri }}
      style={styles.stopImage}
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={180}
      recyclingKey={`${stop.key}:${attempt}`}
      accessibilityLabel={`vibe-stop-photo:${stop.key}`}
      onError={() => setAttempt((a) => a + 1)}
    />
  );
}

export default function VibeRouteScreen() {
  const { banditId: rawId } = useLocalSearchParams<{ banditId: string }>();
  const banditId = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 1024;

  const screenOptions = useAppBackScreenOptions({
    title: 'Vibe Route',
    fallback: (banditId ? `/bandit/${banditId}` : '/bandits') as Href,
    showBack: true,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bandit, setBandit] = useState<BanditRow | null>(null);
  const [stops, setStops] = useState<VibeStop[]>([]);
  const [camera, setCamera] = useState<GuideCamera | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const restoredScroll = useRef(false);

  const mappedStops = useMemo(
    () => stops.filter((stop) => stop.lat != null && stop.lng != null),
    [stops],
  );
  const routeEvents = useMemo(
    () =>
      mappedStops.map(
        (stop) =>
          ({
            id: stop.eventId || stop.key,
            name: stop.name,
            address: stop.address,
            genre: stop.category,
            city: 'Athens',
            location_lat: stop.lat,
            location_lng: stop.lng,
          }) as EventRow,
      ),
    [mappedStops],
  );
  const markerLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const stop of mappedStops) labels[stop.eventId || stop.key] = String(stop.order);
    return labels;
  }, [mappedStops]);

  useEffect(() => {
    if (!banditId) return;
    const mem = readGuideView('vibe', banditId);
    if (mem?.camera && mem.camera.zoom >= 11) setCamera(mem.camera);
  }, [banditId]);

  useEffect(() => {
    if (!banditId) return;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        let b: BanditRow | null = null;
        for (let attempt = 0; attempt < 8; attempt += 1) {
          await ensureAnonymousSession().catch(() => undefined);
          const res = await supabase.from('bandit').select('*').eq('id', banditId).limit(1);
          const row = Array.isArray(res.data) ? res.data[0] : null;
          if (row?.id) {
            b = row as BanditRow;
            break;
          }
          const code =
            res.error && typeof res.error === 'object' && 'code' in res.error
              ? String(res.error.code)
              : '';
          if (res.error && code !== 'PGRST116') throw res.error;
          if (attempt < 7) await new Promise((resolve) => setTimeout(resolve, 8000));
        }
        if (!b) throw new Error('Could not load local banDit.');
        setBandit(b);

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

        let spotRows: Database['public']['Tables']['spots']['Row'][] = [];
        try {
          spotRows = await getSpotsByBanditId(banditId);
        } catch {
          spotRows = [];
        }

        const sequence = mergeVibeSequence(eventList, tipsByEventId, spotRows);
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
    const first = String(bandit.name || '').trim().split(/\s+/)[0] || 'Local';
    return `${first}'s route`;
  }, [bandit]);

  const openStop = useCallback(
    (stop: VibeStop) => {
      if (stop.kind === 'event' && stop.eventId) {
        if (banditId) markGuideReturn(`/vibe/${encodeURIComponent(banditId)}`);
        router.push(`/spot/${stop.eventId}?banditId=${encodeURIComponent(banditId!)}` as any);
        return;
      }
      const q = encodeURIComponent(stop.address || stop.name);
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
    },
    [banditId, router],
  );

  const openRouteNavigation = useCallback(() => {
    if (mappedStops.length === 0) return;
    const path = mappedStops.map((stop) => `${stop.lat},${stop.lng}`).join('/');
    Linking.openURL(`https://www.google.com/maps/dir/${path}`);
  }, [mappedStops]);

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
        <Stack.Screen options={screenOptions} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen options={screenOptions} />
        <View style={styles.centered}>
          <Text style={styles.err}>{error}</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, isDesktopWeb && styles.scrollContentDesktop]}
        onScroll={(e) => {
          if (!banditId) return;
          const y = e.nativeEvent.contentOffset.y;
          if (y === 0 && !restoredScroll.current) return;
          writeGuideView('vibe', banditId, { scrollY: y });
        }}
        scrollEventThrottle={32}
        onLayout={() => {
          if (restoredScroll.current || !banditId) return;
          const mem = readGuideView('vibe', banditId);
          if (!mem?.scrollY) return;
          restoredScroll.current = true;
          scrollRef.current?.scrollTo({ y: mem.scrollY, animated: false });
        }}
      >
        <Text style={styles.kicker}>Routes</Text>
        <Text style={styles.headline}>{title}</Text>
        <Text style={styles.intro}>
          Ordered stops with photographs, and the route on the map.
        </Text>

        {mappedStops.length > 0 ? (
          <View testID="vibe-route-map-and-photos">
            <View testID="vibe-route-map" style={[styles.routeMap, { height: isDesktopWeb ? 380 : 300 }]}>
              <LeafletMapView
                embedded
                preferSeed
                showRouteLine
                banditId={banditId}
                seedEvents={routeEvents}
                markerLabels={markerLabels}
                initialCamera={camera}
                initialRegion={ATHENS_CENTER}
                onMapReady={() => {}}
                onError={() => {}}
                onRegionChange={(region) => {
                  if (!banditId || typeof region?.zoom !== 'number') return;
                  const next = {
                    latitude: region.latitude,
                    longitude: region.longitude,
                    zoom: region.zoom,
                  };
                  setCamera(next);
                  writeGuideView('vibe', banditId, { camera: next });
                }}
                onSelectEvent={() => {}}
              />
            </View>
            {mappedStops.length > 0 ? (
              <Pressable style={styles.navigateBtn} onPress={openRouteNavigation}>
                <Text style={styles.navigateBtnText}>Navigate this route</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {stops.length === 0 ? (
          <Text style={styles.empty}>
            No places are linked yet. Add picks in the guide, then try again.
          </Text>
        ) : (
          stops.map((stop) => (
            <Pressable
              key={stop.key}
              style={[styles.photoStop, isDesktopWeb && styles.cardDesktop]}
              onPress={() => openStop(stop)}
            >
              <View style={styles.photoBleed}>
                <VibeStopImage stop={stop} />
                <View style={styles.photoScrim} />
                <View style={styles.photoCopy}>
                  <Text style={styles.stepBadge}>{`Stop ${stop.order}`}</Text>
                  <Text style={styles.categoryOnPhoto}>{stop.category}</Text>
                  <Text style={styles.placeNameOnPhoto}>{stop.name}</Text>
                  <Text style={styles.vibeOnPhoto} numberOfLines={3}>
                    {stop.vibeLine}
                  </Text>
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
  scroll: { flex: 1, backgroundColor: '#0B0B0B' },
  scrollContent: { padding: 16, paddingBottom: 48 },
  scrollContentDesktop: {
    maxWidth: 980,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 24,
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#0B0B0B' },
  err: { color: '#FF8A80', fontSize: 15, textAlign: 'center' },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E03131',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  headline: {
    fontFamily: 'Caros',
    fontWeight: '800',
    fontSize: 28,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  intro: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 22,
    marginBottom: 16,
  },
  routeMap: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#1A1A1A',
  },
  navigateBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#E03131',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 18,
  },
  navigateBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  empty: { fontSize: 14, color: 'rgba(255,255,255,0.6)' },
  photoStop: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
  },
  cardDesktop: {
    maxWidth: 860,
    alignSelf: 'center',
    width: '100%',
  },
  photoBleed: {
    width: '100%',
    aspectRatio: 16 / 10,
    position: 'relative',
  },
  photoScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  photoCopy: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
  },
  stepBadge: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#FFFFFF',
    backgroundColor: '#E03131',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 10,
  },
  categoryOnPhoto: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  placeNameOnPhoto: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Caros',
    marginBottom: 6,
  },
  vibeOnPhoto: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.88)',
  },
  stopImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  vibeImageLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
  },
});
