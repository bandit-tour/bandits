import EventCard from '@/components/EventCard';
import MapPlacePreviewCard from '@/components/MapPlacePreviewCard';
import type { EventBanditRecommendation } from '@/app/services/events';
import type { Database } from '@/lib/database.types';
import { eventsToMapMarkers } from '@/lib/eventsToMapMarkers';
import {
  filterEventsInMapBounds,
  isExploreMapDesktopSplit,
  isSignificantMapMove,
  type MapViewportBounds,
  type MapViewportCenter,
} from '@/lib/exploreMapViewport';
import { ATHENS_CENTER, eventMapCoordinates } from '@/lib/mapCoordinates';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

type Event = Database['public']['Tables']['event']['Row'];

type Props = {
  events: Event[];
  banditId?: string;
  onOpenSpot?: (eventId: string, heroUri?: string | null) => void;
  onBanditPress?: (banditId: string) => void;
  banditsByEventId?: Map<string, EventBanditRecommendation[]>;
  heroUriByEventId?: Record<string, string | null | undefined>;
  listBottomPad?: number;
  isLiked?: (eventId: string) => boolean;
  onLike?: (eventId: string) => void;
  visible?: boolean;
  onRequestListMode?: () => void;
};

const GENRE_COLOR: Record<string, string> = {
  Food: '#E67E22',
  Nightlife: '#8E44AD',
  Shopping: '#2980B9',
  Culture: '#16A085',
  Coffee: '#6E4B3A',
  Art: '#C0392B',
  Wellness: '#1ABC9C',
  Nature: '#27AE60',
  'LGBTQ+': '#E91E63',
  LGBTQ: '#E91E63',
};

let MapContainer: any = null;
let TileLayer: any = null;
let Marker: any = null;
let L: any = null;

function colorFor(genre: string, id: string): string {
  if (GENRE_COLOR[genre]) return GENRE_COLOR[genre];
  const fallback = ['#C0392B', '#2E86AB', '#1D8348', '#AF7AC5', '#D68910'];
  const idx = Math.abs(String(id).split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % fallback.length;
  return fallback[idx];
}

function clusterCellSize(zoom: number): number {
  if (zoom >= 15) return 0;
  if (zoom >= 14) return 0.004;
  if (zoom >= 13) return 0.008;
  if (zoom >= 12) return 0.016;
  return 0.03;
}

type ClusterNode =
  | { type: 'marker'; item: { id: string; lat: number; lng: number; name: string; genre: string } }
  | { type: 'cluster'; count: number; lat: number; lng: number };

function buildClusters(
  markers: Array<{ id: string; lat: number; lng: number; name: string; genre: string }>,
  zoom: number,
  activeId: string | null,
): ClusterNode[] {
  const cell = clusterCellSize(zoom);
  const items = markers.filter((m) => m.id !== activeId);
  if (!cell) return items.map((item) => ({ type: 'marker' as const, item }));
  const buckets = new Map<string, typeof items>();
  for (const m of items) {
    const key = `${Math.round(m.lat / cell)}:${Math.round(m.lng / cell)}`;
    const arr = buckets.get(key) ?? [];
    arr.push(m);
    buckets.set(key, arr);
  }
  const out: ClusterNode[] = [];
  for (const group of buckets.values()) {
    if (group.length === 1) {
      out.push({ type: 'marker', item: group[0] });
      continue;
    }
    const lat = group.reduce((s, g) => s + g.lat, 0) / group.length;
    const lng = group.reduce((s, g) => s + g.lng, 0) / group.length;
    out.push({ type: 'cluster', count: group.length, lat, lng });
  }
  return out;
}

/** Web Explore map: desktop split list|map, mobile full-screen discovery. */
export default function ExploreMapPanelWeb({
  events,
  banditId,
  onOpenSpot,
  onBanditPress,
  banditsByEventId,
  heroUriByEventId,
  listBottomPad = 24,
  isLiked,
  onLike,
  visible = true,
  onRequestListMode,
}: Props) {
  const { width } = useWindowDimensions();
  const desktopSplit = isExploreMapDesktopSplit(width);
  const listRef = useRef<FlatList<Event>>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapZoom, setMapZoom] = useState(13);
  const [viewportBounds, setViewportBounds] = useState<MapViewportBounds | null>(null);
  const [areaFilterActive, setAreaFilterActive] = useState(false);
  const [showSearchArea, setShowSearchArea] = useState(false);
  const searchedCenterRef = useRef<MapViewportCenter | null>(null);
  const suppressMoveRef = useRef(false);

  const markersData = useMemo(() => eventsToMapMarkers(events), [events]);
  const mappableIds = useMemo(() => new Set(markersData.map((m) => m.id)), [markersData]);
  const mappableEvents = useMemo(
    () => events.filter((e) => mappableIds.has(e.id)),
    [events, mappableIds],
  );

  const visibleEvents = useMemo(() => {
    if (!areaFilterActive || !viewportBounds) return mappableEvents;
    return filterEventsInMapBounds(mappableEvents, viewportBounds);
  }, [areaFilterActive, viewportBounds, mappableEvents]);

  const clusterNodes = useMemo(
    () => buildClusters(markersData, mapZoom, selectedId),
    [markersData, mapZoom, selectedId],
  );

  useEffect(() => {
    if (!visible || typeof window === 'undefined') return;
    let cancelled = false;
    Promise.all([import('react-leaflet'), import('leaflet')])
      .then(([reactLeaflet, leaflet]) => {
        if (cancelled) return;
        MapContainer = reactLeaflet.MapContainer;
        TileLayer = reactLeaflet.TileLayer;
        Marker = reactLeaflet.Marker;
        L = leaflet.default;
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });
        setLeafletLoaded(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const makeDotIcon = useCallback((color: string, active = false) => {
    if (!L) return undefined;
    const size = active ? 34 : 14;
    return L.divIcon({
      html: active
        ? `<div style="width:34px;height:34px;border-radius:50%;border:3px solid #fff;background:${color};box-shadow:0 2px 12px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center"><div style="width:14px;height:14px;border-radius:50%;background:#fff"></div></div>`
        : `<div style="width:14px;height:14px;border-radius:50%;border:2px solid #fff;background:${color};box-shadow:0 1px 5px rgba(0,0,0,.35)"></div>`,
      className: '',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }, []);

  const makeClusterIcon = useCallback((count: number) => {
    if (!L) return undefined;
    return L.divIcon({
      html: `<div style="min-width:34px;height:34px;border-radius:50%;border:3px solid #fff;background:#111111;color:#fff;font:700 12px/28px -apple-system,Segoe UI,sans-serif;text-align:center;padding:0 6px;box-sizing:border-box;box-shadow:0 2px 10px rgba(0,0,0,.4)">${count}</div>`,
      className: '',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
  }, []);

  const applySelection = useCallback(
    (eventId: string, scrollList = false, fly = true) => {
      setSelectedId(eventId);
      if (scrollList) {
        const index = visibleEvents.findIndex((e) => e.id === eventId);
        if (index >= 0) {
          listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 });
        }
      }
      if (fly && mapInstance) {
        const coords = eventMapCoordinates(
          mappableEvents.find((e) => e.id === eventId) as Event,
        );
        if (coords) {
          suppressMoveRef.current = true;
          mapInstance.flyTo([coords.lat, coords.lng], Math.max(mapInstance.getZoom(), 15), {
            animate: true,
            duration: 0.4,
          });
          setTimeout(() => {
            suppressMoveRef.current = false;
          }, 450);
        }
      }
    },
    [mapInstance, mappableEvents, visibleEvents],
  );

  useEffect(() => {
    if (!selectedId && mappableEvents[0]) {
      setSelectedId(mappableEvents[0].id);
    }
  }, [mappableEvents, selectedId]);

  useEffect(() => {
    if (!mapInstance) return;
    const onMoveEnd = () => {
      const b = mapInstance.getBounds();
      const c = mapInstance.getCenter();
      const zoom = mapInstance.getZoom();
      setMapZoom(zoom);
      const bounds: MapViewportBounds = {
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest(),
      };
      setViewportBounds(bounds);
      const center: MapViewportCenter = { lat: c.lat, lng: c.lng, zoom };
      if (suppressMoveRef.current) return;
      if (!searchedCenterRef.current) {
        searchedCenterRef.current = center;
        return;
      }
      if (isSignificantMapMove(center, searchedCenterRef.current)) {
        setShowSearchArea(true);
      }
    };
    mapInstance.on('moveend', onMoveEnd);
    mapInstance.on('zoomend', onMoveEnd);
    setTimeout(() => mapInstance.invalidateSize(), 60);
    return () => {
      mapInstance.off('moveend', onMoveEnd);
      mapInstance.off('zoomend', onMoveEnd);
    };
  }, [mapInstance]);

  useEffect(() => {
    if (!mapInstance || markersData.length === 0) return;
    const latlngs = markersData.map((m) => [m.lat, m.lng] as [number, number]);
    suppressMoveRef.current = true;
    try {
      mapInstance.fitBounds(latlngs, { padding: [40, 40], maxZoom: 14 });
    } catch {
      /* ignore */
    }
    setTimeout(() => {
      suppressMoveRef.current = false;
      mapInstance.invalidateSize();
    }, 200);
  }, [mapInstance, markersData]);

  const openSelected = useCallback(
    (eventId: string) => {
      onOpenSpot?.(eventId, heroUriByEventId?.[eventId] ?? null);
    },
    [heroUriByEventId, onOpenSpot],
  );

  const liked = isLiked ?? (() => false);
  const like = onLike ?? (() => {});

  const renderListCard = useCallback(
    ({ item }: { item: Event }) => {
      const active = selectedId === item.id;
      return (
        <View
          style={[
            styles.cardWrap,
            desktopSplit ? styles.cardWrapDesktop : styles.cardWrapMobile,
            active && styles.cardSelected,
          ]}
        >
          <EventCard
            event={item}
            onLike={() => like(item.id)}
            isLiked={liked(item.id)}
            variant="horizontal"
            fillHorizontalCell
            showRecommendations
            skipGooglePhotoFetch={Boolean(heroUriByEventId?.[item.id])}
            preloadedRecommendingBandits={banditsByEventId?.get(item.id) ?? []}
            onBanditPress={onBanditPress}
            banditId={banditId}
            resolvedRecommendationImageUri={heroUriByEventId?.[item.id] ?? null}
            recommendationHeroResolverReady
            strictRecommendationImagePolicy={false}
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
      like,
      liked,
      onBanditPress,
      openSelected,
      selectedId,
    ],
  );

  const renderMobileStripCard = useCallback(
    ({ item }: { item: Event }) => {
      const active = selectedId === item.id;
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
    },
    [applySelection, banditsByEventId, heroUriByEventId, openSelected, selectedId],
  );

  if (!visible) return <View style={styles.root} />;

  const mapInner = !leafletLoaded || !MapContainer ? (
    <View style={styles.mapLoading}>
      <ActivityIndicator size="large" color="#111111" />
    </View>
  ) : (
    <>
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css"
        crossOrigin=""
      />
      <MapContainer
        center={[ATHENS_CENTER.latitude, ATHENS_CENTER.longitude]}
        zoom={13}
        style={{ height: '100%', width: '100%', minHeight: desktopSplit ? 560 : 520 }}
        whenCreated={setMapInstance}
        zoomControl
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {clusterNodes.map((node, idx) => {
          if (node.type === 'cluster') {
            return (
              <Marker
                key={`c-${idx}-${node.lat}-${node.lng}`}
                position={[node.lat, node.lng]}
                icon={makeClusterIcon(node.count)}
                eventHandlers={{
                  click: () => {
                    mapInstance?.setView([node.lat, node.lng], Math.min(mapZoom + 2, 17));
                  },
                }}
              />
            );
          }
          const color = colorFor(node.item.genre, node.item.id);
          return (
            <Marker
              key={node.item.id}
              position={[node.item.lat, node.item.lng]}
              icon={makeDotIcon(color, false)}
              eventHandlers={{
                click: () => applySelection(node.item.id, true, true),
              }}
            />
          );
        })}
        {selectedId
          ? (() => {
              const row = markersData.find((m) => m.id === selectedId);
              if (!row) return null;
              return (
                <Marker
                  key={`sel-${row.id}`}
                  position={[row.lat, row.lng]}
                  icon={makeDotIcon(colorFor(row.genre, row.id), true)}
                  zIndexOffset={1000}
                  eventHandlers={{
                    click: () => applySelection(row.id, true, false),
                  }}
                />
              );
            })()
          : null}
      </MapContainer>

      {showSearchArea ? (
        <Pressable
          style={styles.searchAreaBtn}
          onPress={() => {
            setAreaFilterActive(true);
            setShowSearchArea(false);
            if (mapInstance) {
              const c = mapInstance.getCenter();
              searchedCenterRef.current = {
                lat: c.lat,
                lng: c.lng,
                zoom: mapInstance.getZoom(),
              };
            }
          }}
        >
          <Text style={styles.searchAreaText}>Search this area</Text>
        </Pressable>
      ) : null}

      {!desktopSplit && onRequestListMode ? (
        <Pressable style={styles.floatingListBtn} onPress={onRequestListMode}>
          <Text style={styles.floatingListText}>List</Text>
        </Pressable>
      ) : null}
    </>
  );

  if (desktopSplit) {
    return (
      <View style={styles.rootDesktop}>
        <View style={styles.listPaneDesktop}>
          <FlatList
            ref={listRef}
            data={visibleEvents}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.desktopListContent, { paddingBottom: listBottomPad + 16 }]}
            renderItem={renderListCard}
            ListEmptyComponent={<Text style={styles.emptyText}>No places in this map area.</Text>}
            onScrollToIndexFailed={({ index }) => {
              setTimeout(() => listRef.current?.scrollToIndex({ index, animated: true }), 80);
            }}
          />
        </View>
        <View style={styles.mapPaneDesktop}>{mapInner}</View>
      </View>
    );
  }

  return (
    <View style={styles.rootMobile}>
      <View style={styles.mapPaneMobile}>{mapInner}</View>
      <View style={[styles.sheet, { paddingBottom: Math.max(listBottomPad, 12) }]}>
        <FlatList
          ref={listRef}
          data={visibleEvents}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}
          renderItem={renderMobileStripCard}
          onScrollToIndexFailed={({ index }) => {
            setTimeout(() => listRef.current?.scrollToIndex({ index, animated: true }), 80);
          }}
          ListEmptyComponent={
            <Text style={[styles.emptyText, styles.emptyStrip]}>No places nearby on the map.</Text>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  rootDesktop: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 560,
    height: '100%' as any,
  },
  rootMobile: {
    flex: 1,
    minHeight: 0,
    height: '100%' as any,
    position: 'relative',
  },
  listPaneDesktop: {
    width: '40%',
    maxWidth: 480,
    minWidth: 300,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  desktopListContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 10,
  },
  mapPaneDesktop: {
    flex: 1,
    width: '60%',
    minHeight: 560,
    position: 'relative',
    backgroundColor: '#eef1f4',
    height: '100%' as any,
    alignSelf: 'stretch',
  },
  mapPaneMobile: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#eef1f4',
  },
  mapLoading: {
    flex: 1,
    minHeight: 520,
    height: '100%' as any,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
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
  cardWrapDesktop: { width: '100%' },
  cardWrapMobile: {
    width: 300,
    borderRadius: 14,
    overflow: 'hidden',
  },
  cardSelected: {
    borderColor: '#111111',
    borderWidth: 2,
  },
  searchAreaBtn: {
    position: 'absolute',
    top: 14,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 500,
  },
  searchAreaText: {
    backgroundColor: '#111',
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    overflow: 'hidden',
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
    zIndex: 500,
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
  emptyStrip: { width: 240, marginTop: 40 },
});
