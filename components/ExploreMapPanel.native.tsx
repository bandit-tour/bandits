import { ATHENS_CENTER } from '@/lib/mapCoordinates';
import type { EventBanditRecommendation } from '@/app/services/events';
import type { Database } from '@/lib/database.types';
import { buildLeafletBootHtml } from '@/lib/leafletMapHtml';
import { eventsToMapMarkers } from '@/lib/eventsToMapMarkers';
import {
  filterEventsInMapBounds,
  isExploreMapDesktopSplit,
  isSignificantMapMove,
  type MapViewportBounds,
  type MapViewportCenter,
} from '@/lib/exploreMapViewport';
import { injectMapInvalidateSize, injectMapSync } from '@/lib/mapWebViewBridge';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewToken,
} from 'react-native';
import { WebView } from 'react-native-webview';

import EventCard from '@/components/EventCard';
import MapPlacePreviewCard from '@/components/MapPlacePreviewCard';
import { perfMark, perfStart } from '@/lib/perfTiming';

type Event = Database['public']['Tables']['event']['Row'];

type Props = {
  events: Event[];
  banditId?: string;
  onOpenSpot: (eventId: string, heroUri?: string | null) => void;
  onBanditPress?: (banditId: string) => void;
  banditsByEventId?: Map<string, EventBanditRecommendation[]>;
  heroUriByEventId?: Record<string, string | null | undefined>;
  listBottomPad: number;
  isLiked: (eventId: string) => boolean;
  onLike: (eventId: string) => void;
  visible?: boolean;
  onRequestListMode?: () => void;
};

const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 55, minimumViewTime: 80 };

export default function ExploreMapPanel({
  events,
  banditId,
  onOpenSpot,
  onBanditPress,
  banditsByEventId,
  heroUriByEventId,
  listBottomPad,
  isLiked,
  onLike,
  visible = true,
  onRequestListMode,
}: Props) {
  const { width, height } = useWindowDimensions();
  const desktopSplit = isExploreMapDesktopSplit(width);
  const webViewRef = useRef<WebView>(null);
  const listRef = useRef<FlatList<Event>>(null);
  const catalogPayloadRef = useRef<string>('');
  const selectedIdRef = useRef<string | null>(null);
  const searchedCenterRef = useRef<MapViewportCenter | null>(null);
  const latestCenterRef = useRef<MapViewportCenter | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [webViewMounted, setWebViewMounted] = useState(false);
  const [viewportBounds, setViewportBounds] = useState<MapViewportBounds | null>(null);
  const [areaFilterActive, setAreaFilterActive] = useState(false);
  const [showSearchArea, setShowSearchArea] = useState(false);
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

  const visibleEvents = useMemo(() => {
    if (!areaFilterActive || !viewportBounds) return mappableEvents;
    return filterEventsInMapBounds(mappableEvents, viewportBounds);
  }, [areaFilterActive, viewportBounds, mappableEvents]);

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
      setShowSearchArea(false);
      setAreaFilterActive(false);
      return;
    }
    setWebViewMounted(true);
    return () => {
      if (injectRafRef.current != null) cancelAnimationFrame(injectRafRef.current);
      setWebViewMounted(false);
      setMapReady(false);
    };
  }, [visible]);

  useEffect(() => {
    if (!mapReady || !webViewRef.current) return;
    const t = setTimeout(() => injectMapInvalidateSize(webViewRef.current), 80);
    return () => clearTimeout(t);
  }, [mapReady, desktopSplit, width, height]);

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
    (eventId: string | null, scrollList = false, showPreview = true) => {
      if (!eventId) return;
      selectedIdRef.current = eventId;
      setSelectedId(eventId);
      pushMapState(eventId);
      if (scrollList) {
        const index = visibleEvents.findIndex((e) => e.id === eventId);
        if (index >= 0) {
          listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.35 });
        }
      }
    },
    [visibleEvents, pushMapState],
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
    applySelection(mappableEvents[0].id, false, false);
  }, [mapReady, mappableEvents, mappableIds, applySelection]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (desktopSplit) return;
      const lead = viewableItems.find((v) => v.isViewable && v.item);
      const event = lead?.item as Event | undefined;
      if (!event?.id || event.id === selectedIdRef.current) return;
      applySelection(event.id, false, true);
    },
    [applySelection, desktopSplit],
  );

  const handleSearchThisArea = useCallback(() => {
    setAreaFilterActive(true);
    setShowSearchArea(false);
    if (latestCenterRef.current) {
      searchedCenterRef.current = latestCenterRef.current;
    }
  }, []);

  const handleWebViewMessage = useCallback(
    (raw: { nativeEvent: { data: string } }) => {
      try {
        const data = JSON.parse(raw.nativeEvent.data) as {
          type?: string;
          eventId?: string;
          bounds?: MapViewportBounds;
          center?: MapViewportCenter;
        };
        if (data.type === 'mapReady') {
          mapLoadSpanRef.current?.({ phase: 'mapReady' } as never);
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
          applySelection(data.eventId, true, true);
          return;
        }
        if (data.type === 'boundsChanged' && data.bounds && data.center) {
          setViewportBounds(data.bounds);
          latestCenterRef.current = data.center;
          if (!searchedCenterRef.current) {
            searchedCenterRef.current = data.center;
            return;
          }
          if (isSignificantMapMove(data.center, searchedCenterRef.current)) {
            setShowSearchArea(true);
          }
        }
      } catch {
        /* ignore */
      }
    },
    [applySelection, markersPayload, mappableEvents, markersData.length],
  );

  useEffect(() => {
    // Reset area filter when the category/event catalog changes.
    setAreaFilterActive(false);
    setShowSearchArea(false);
    searchedCenterRef.current = null;
  }, [markersPayload]);

  const openSelected = useCallback(
    (eventId: string) => {
      onOpenSpot(eventId, heroUriByEventId?.[eventId] ?? null);
    },
    [heroUriByEventId, onOpenSpot],
  );

  const renderMapCard = useCallback(
    ({ item }: { item: Event }) => {
      const active = selectedId === item.id;
      if (!desktopSplit) {
        return (
          <Pressable
            onPress={() => applySelection(item.id, false, true)}
            style={[styles.cardWrapMobile, active && styles.cardSelected]}
          >
            <MapPlacePreviewCard
              name={String(item.name ?? '')}
              category={item.genre}
              rating={(item as { rating?: number | null }).rating}
              imageUri={heroUriByEventId?.[item.id] ?? null}
              bandits={banditsByEventId?.get(item.id)}
              onOpen={() => {
                applySelection(item.id, false, true);
                openSelected(item.id);
              }}
            />
          </Pressable>
        );
      }
      return (
        <View style={[styles.cardWrap, styles.cardWrapDesktop, active && styles.cardSelected]}>
          <EventCard
            event={item}
            onLike={() => onLike(item.id)}
            isLiked={isLiked(item.id)}
            variant="horizontal"
            fillHorizontalCell
            showRecommendations
            splitTouchTargets={Platform.OS !== 'web'}
            preloadedRecommendingBandits={banditsByEventId?.get(item.id) ?? []}
            onBanditPress={onBanditPress}
            banditId={banditId}
            resolvedRecommendationImageUri={heroUriByEventId?.[item.id] ?? null}
            recommendationHeroResolverReady
            strictRecommendationImagePolicy={false}
            skipGooglePhotoFetch={false}
            onPress={() => {
              applySelection(item.id, false, true);
              openSelected(item.id);
            }}
            isHighlighted={active}
          />
        </View>
      );
    },
    [
      applySelection,
      banditId,
      banditsByEventId,
      desktopSplit,
      heroUriByEventId,
      isLiked,
      onBanditPress,
      onLike,
      openSelected,
      selectedId,
    ],
  );

  const mapPane = (
    <View style={[styles.mapPane, desktopSplit && styles.mapPaneDesktop]}>
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
          <ActivityIndicator size="large" color="#111111" />
        </View>
      ) : null}

      {showSearchArea ? (
        <View style={styles.searchAreaWrap} pointerEvents="box-none">
          <Pressable style={styles.searchAreaBtn} onPress={handleSearchThisArea}>
            <Text style={styles.searchAreaText}>Search this area</Text>
          </Pressable>
        </View>
      ) : null}

      {!desktopSplit && onRequestListMode ? (
        <Pressable style={styles.floatingListBtn} onPress={onRequestListMode}>
          <Text style={styles.floatingListText}>List</Text>
        </Pressable>
      ) : null}
    </View>
  );

  if (!visible) return null;

  if (desktopSplit) {
    return (
      <View style={styles.rootDesktop}>
        <View style={styles.listPaneDesktop}>
          <FlatList
            ref={listRef}
            data={visibleEvents}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.desktopListContent, { paddingBottom: listBottomPad + 16 }]}
            renderItem={renderMapCard}
            onScrollToIndexFailed={({ index }) => {
              setTimeout(() => listRef.current?.scrollToIndex({ index, animated: true }), 100);
            }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No places in this map area.</Text>
            }
            initialNumToRender={6}
            maxToRenderPerBatch={4}
            windowSize={7}
          />
        </View>
        {mapPane}
      </View>
    );
  }

  return (
    <View style={styles.rootMobile}>
      <View style={StyleSheet.absoluteFill}>{mapPane}</View>
      <View style={[styles.sheet, { paddingBottom: Math.max(listBottomPad, 12) }]}>
        <FlatList
          ref={listRef}
          data={visibleEvents}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}
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
          ListEmptyComponent={
            <Text style={[styles.emptyText, styles.emptyStrip]}>No places nearby on the map.</Text>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rootDesktop: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 520,
  },
  rootMobile: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  listPaneDesktop: {
    width: '40%',
    maxWidth: 480,
    minWidth: 280,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  desktopListContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 10,
  },
  mapPane: {
    flex: 1,
    minHeight: 220,
    backgroundColor: '#eef1f4',
    position: 'relative',
  },
  mapPaneDesktop: {
    width: '60%',
    flex: 1,
    minHeight: 560,
  },
  webview: { flex: 1 },
  mapLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(238,241,244,0.55)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    backgroundColor: 'transparent',
  },
  strip: {
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 10,
    alignItems: 'flex-end',
  },
  cardWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  cardWrapDesktop: {
    width: '100%',
  },
  cardWrapMobile: {
    width: 300,
    borderRadius: 14,
    overflow: 'hidden',
  },
  cardSelected: {
    borderColor: '#111111',
    borderWidth: 2,
  },
  searchAreaWrap: {
    position: 'absolute',
    top: 14,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5,
  },
  searchAreaBtn: {
    backgroundColor: '#111',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchAreaText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  floatingListBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d0d7de',
    zIndex: 5,
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  floatingListText: {
    color: '#111',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    color: '#777',
    marginTop: 24,
    fontSize: 14,
    paddingHorizontal: 16,
  },
  emptyStrip: {
    width: 240,
    marginTop: 40,
  },
});
