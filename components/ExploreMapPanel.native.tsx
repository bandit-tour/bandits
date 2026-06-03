import { ATHENS_CENTER } from '@/lib/mapCoordinates';
import type { EventBanditRecommendation } from '@/app/services/events';
import type { Database } from '@/lib/database.types';
import { buildLeafletBootHtml } from '@/lib/leafletMapHtml';
import { eventsToMapMarkers } from '@/lib/eventsToMapMarkers';
import { injectMapSync } from '@/lib/mapWebViewBridge';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type ViewToken,
} from 'react-native';
import { WebView } from 'react-native-webview';

import EventCard from '@/components/EventCard';
import { perfMark, perfStart } from '@/lib/perfTiming';

type Event = Database['public']['Tables']['event']['Row'];

type Props = {
  events: Event[];
  banditId?: string;
  onOpenSpot: (eventId: string) => void;
  onBanditPress?: (banditId: string) => void;
  banditsByEventId?: Map<string, EventBanditRecommendation[]>;
  listBottomPad: number;
  isLiked: (eventId: string) => boolean;
  onLike: (eventId: string) => void;
  visible?: boolean;
};

const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 55, minimumViewTime: 80 };

export default function ExploreMapPanel({
  events,
  banditId,
  onOpenSpot,
  onBanditPress,
  banditsByEventId,
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
  const [webViewMounted, setWebViewMounted] = useState(false);
  const mapLoadSpanRef = useRef<(() => void) | null>(null);
  const injectRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!visible) {
      mapLoadSpanRef.current?.();
      mapLoadSpanRef.current = null;
      return;
    }
    mapLoadSpanRef.current = perfStart('explore_map_webview_load', 'map', {
      markerCount: events.length,
    });
    perfMark('explore_map_panel_visible', 'map');
    return () => {
      mapLoadSpanRef.current?.();
      mapLoadSpanRef.current = null;
    };
  }, [visible, events.length]);

  const markersData = useMemo(() => eventsToMapMarkers(events), [events]);
  const markersPayload = useMemo(() => JSON.stringify(markersData), [markersData]);
  const mappableIds = useMemo(() => new Set(markersData.map((m) => m.id)), [markersData]);
  const mappableEvents = useMemo(
    () => events.filter((e) => mappableIds.has(e.id)),
    [events, mappableIds],
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
    if (!visible) {
      setWebViewMounted(false);
      setMapReady(false);
      catalogPayloadRef.current = '';
      selectedIdRef.current = null;
      return;
    }
    setWebViewMounted(true);
    return () => {
      if (injectRafRef.current != null) cancelAnimationFrame(injectRafRef.current);
      setWebViewMounted(false);
      setMapReady(false);
    };
  }, [visible]);

  const pushMapState = useCallback(
    (eventId: string | null) => {
      if (!mapReady || !webViewRef.current) return;
      if (catalogPayloadRef.current === markersPayload && selectedIdRef.current === eventId) return;
      if (injectRafRef.current != null) cancelAnimationFrame(injectRafRef.current);
      injectRafRef.current = requestAnimationFrame(() => {
        injectRafRef.current = null;
        if (!webViewRef.current) return;
        injectMapSync(webViewRef.current, markersPayload, eventId);
        catalogPayloadRef.current = markersPayload;
      });
    },
    [mapReady, markersPayload],
  );

  const applySelection = useCallback(
    (eventId: string | null, scrollList = false) => {
      if (!eventId) return;
      selectedIdRef.current = eventId;
      setSelectedId(eventId);
      pushMapState(eventId);
      if (scrollList) {
        const index = mappableEvents.findIndex((e) => e.id === eventId);
        if (index >= 0) {
          listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
        }
      }
    },
    [mappableEvents, pushMapState],
  );

  useEffect(() => {
    if (!mapReady) return;
    const nextId = selectedIdRef.current ?? mappableEvents[0]?.id ?? null;
    pushMapState(nextId);
    if (nextId && nextId !== selectedIdRef.current) {
      selectedIdRef.current = nextId;
      setSelectedId(nextId);
    }
  }, [mapReady, markersPayload, mappableEvents, pushMapState]);

  useEffect(() => {
    if (!mapReady || mappableEvents.length === 0) return;
    if (selectedIdRef.current && mappableIds.has(selectedIdRef.current)) return;
    applySelection(mappableEvents[0].id, false);
  }, [mapReady, mappableEvents, mappableIds, applySelection]);

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
          mapLoadSpanRef.current?.({ phase: 'mapReady' });
          mapLoadSpanRef.current = null;
          perfMark('explore_map_ready', 'map', { markerCount: markersData.length });
          setMapReady(true);
          const nextId = selectedIdRef.current ?? mappableEvents[0]?.id ?? null;
          if (nextId) {
            selectedIdRef.current = nextId;
            setSelectedId(nextId);
          }
          requestAnimationFrame(() => {
            if (webViewRef.current) {
              catalogPayloadRef.current = '';
              injectMapSync(webViewRef.current, markersPayload, nextId);
              catalogPayloadRef.current = markersPayload;
            }
          });
          return;
        }
        if (data.type === 'markerClick' && data.eventId) {
          applySelection(data.eventId, true);
        }
      } catch {
        /* ignore */
      }
    },
    [applySelection, markersPayload, mappableEvents],
  );

  const renderMapCard = useCallback(
    ({ item }: { item: Event }) => {
      const active = selectedId === item.id;
      return (
        <View style={[styles.cardWrap, active && styles.cardSelected]}>
          <EventCard
            event={item}
            onLike={() => onLike(item.id)}
            isLiked={isLiked(item.id)}
            variant="horizontal"
            fillHorizontalCell
            showRecommendations
            skipGooglePhotoFetch
            splitTouchTargets={Platform.OS !== 'web'}
            preloadedRecommendingBandits={banditsByEventId?.get(item.id) ?? []}
            onBanditPress={onBanditPress}
            banditId={banditId}
            onPress={() => {
              applySelection(item.id, false);
              onOpenSpot(item.id);
            }}
            isHighlighted={active}
          />
        </View>
      );
    },
    [applySelection, banditId, banditsByEventId, isLiked, onBanditPress, onLike, onOpenSpot, selectedId],
  );

  if (!visible) return null;

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
            androidHardwareAccelerationDisabled={false}
            setBuiltInZoomControls={Platform.OS === 'android'}
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
        initialNumToRender={2}
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
