import { ATHENS_CENTER } from '@/lib/mapCoordinates';
import type { Database } from '@/lib/database.types';
import { buildLeafletBootHtml } from '@/lib/leafletMapHtml';
import { eventsToMapMarkers } from '@/lib/eventsToMapMarkers';
import { injectMapCatalog, injectMapSelection } from '@/lib/mapWebViewBridge';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  InteractionManager,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type ViewToken,
} from 'react-native';
import { WebView } from 'react-native-webview';

import EventCard from '@/components/EventCard';

type Event = Database['public']['Tables']['event']['Row'];

type Props = {
  events: Event[];
  banditId?: string;
  onOpenSpot: (eventId: string) => void;
  listBottomPad: number;
  isLiked: (eventId: string) => boolean;
  onLike: (eventId: string) => void;
  /** When false, skip mounting the WebView (saves memory while user stays on list). */
  visible?: boolean;
};

const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 55, minimumViewTime: 80 };

export default function ExploreMapPanel({
  events,
  banditId,
  onOpenSpot,
  listBottomPad,
  isLiked,
  onLike,
  visible = true,
}: Props) {
  const webViewRef = useRef<WebView>(null);
  const listRef = useRef<FlatList<Event>>(null);
  const catalogPayloadRef = useRef<string>('');
  const selectedIdRef = useRef<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [webViewMounted, setWebViewMounted] = useState(visible);

  const markersData = useMemo(() => eventsToMapMarkers(events), [events]);
  const mappableEvents = useMemo(
    () => events.filter((e) => markersData.some((m) => m.id === e.id)),
    [events, markersData],
  );

  const bootHtml = useMemo(
    () =>
      buildLeafletBootHtml({
        initialLat: ATHENS_CENTER.latitude,
        initialLng: ATHENS_CENTER.longitude,
        initialZoom: 13,
        athensLat: ATHENS_CENTER.latitude,
        athensLng: ATHENS_CENTER.longitude,
      }),
    [],
  );

  useEffect(() => {
    if (!visible) return;
    const task = InteractionManager.runAfterInteractions(() => {
      setWebViewMounted(true);
    });
    return () => task.cancel();
  }, [visible]);

  const applySelection = useCallback(
    (eventId: string | null, scrollList = false) => {
      if (!eventId) return;
      selectedIdRef.current = eventId;
      setSelectedId(eventId);
      if (mapReady) injectMapSelection(webViewRef.current, eventId);
      if (scrollList) {
        const index = mappableEvents.findIndex((e) => e.id === eventId);
        if (index >= 0) {
          listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
        }
      }
    },
    [mapReady, mappableEvents],
  );

  useEffect(() => {
    if (!mapReady || !webViewRef.current) return;
    const payload = JSON.stringify(markersData);
    if (payload === catalogPayloadRef.current) return;
    catalogPayloadRef.current = payload;
    injectMapCatalog(webViewRef.current, payload);
    const nextId = selectedIdRef.current ?? mappableEvents[0]?.id ?? null;
    if (nextId) applySelection(nextId, false);
  }, [mapReady, markersData, mappableEvents, applySelection]);

  useEffect(() => {
    if (!mapReady || mappableEvents.length === 0) return;
    if (selectedIdRef.current && mappableEvents.some((e) => e.id === selectedIdRef.current)) return;
    applySelection(mappableEvents[0].id, false);
  }, [mapReady, mappableEvents, applySelection]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const lead = viewableItems.find((v) => v.isViewable && v.item);
      const event = lead?.item as Event | undefined;
      if (!event?.id || event.id === selectedIdRef.current) return;
      applySelection(event.id, false);
    },
    [applySelection],
  );

  const handleWebViewMessage = useCallback(
    (raw: { nativeEvent: { data: string } }) => {
      try {
        const data = JSON.parse(raw.nativeEvent.data) as { type?: string; eventId?: string };
        if (data.type === 'mapReady') {
          setMapReady(true);
          return;
        }
        if (data.type === 'markerClick' && data.eventId) {
          applySelection(data.eventId, true);
        }
      } catch {
        /* ignore */
      }
    },
    [applySelection],
  );

  const renderMapCard = useCallback(
    ({ item }: { item: Event }) => {
      const active = selectedId === item.id;
      return (
        <Pressable
          onPress={() => applySelection(item.id, false)}
          style={[styles.cardWrap, active && styles.cardSelected]}
        >
          <EventCard
            event={item}
            onLike={() => onLike(item.id)}
            isLiked={isLiked(item.id)}
            variant="horizontal"
            fillHorizontalCell
            showRecommendations={false}
            banditId={banditId}
            onPress={() => onOpenSpot(item.id)}
            isHighlighted={active}
          />
        </Pressable>
      );
    },
    [applySelection, banditId, isLiked, onLike, onOpenSpot, selectedId],
  );

  return (
    <View style={styles.root}>
      <View style={styles.mapPane}>
        {webViewMounted ? (
          <WebView
            ref={webViewRef}
            source={{ html: bootHtml }}
            style={styles.webview}
            onMessage={handleWebViewMessage}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={['*']}
            cacheEnabled
            androidLayerType="hardware"
            startInLoadingState={false}
            mixedContentMode="always"
          />
        ) : (
          <View style={styles.webview} />
        )}
        {!mapReady ? (
          <View style={styles.mapLoading} pointerEvents="none">
            <ActivityIndicator size="large" color="#0a7ea4" />
          </View>
        ) : null}
      </View>
      <FlatList
        ref={listRef}
        data={mappableEvents}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.strip, { paddingBottom: listBottomPad }]}
        renderItem={renderMapCard}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={VIEWABILITY_CONFIG}
        onScrollToIndexFailed={({ index }) => {
          setTimeout(() => listRef.current?.scrollToIndex({ index, animated: true }), 100);
        }}
        initialNumToRender={3}
        maxToRenderPerBatch={2}
        windowSize={3}
        removeClippedSubviews={Platform.OS === 'android'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  mapPane: {
    flex: 1,
    minHeight: 220,
    backgroundColor: '#eef1f4',
    position: 'relative',
  },
  webview: { flex: 1 },
  mapLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(238,241,244,0.55)',
  },
  strip: {
    paddingHorizontal: 10,
    paddingTop: 8,
    gap: 10,
    maxHeight: Platform.OS === 'ios' ? 200 : 210,
  },
  cardWrap: {
    width: 280,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e0e0e0',
  },
  cardSelected: {
    borderColor: '#0a7ea4',
    borderWidth: 2,
  },
});
