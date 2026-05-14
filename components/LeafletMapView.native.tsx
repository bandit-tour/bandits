import { useMapEvents } from '@/hooks/useMapEvents';
import { ATHENS_CENTER, eventMapCoordinates } from '@/lib/mapCoordinates';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Database } from '@/lib/database.types';
import EventList, { EventListRef } from './EventList';

type Event = Database['public']['Tables']['event']['Row'];

interface MapViewProps {
  initialRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  onMapReady: () => void;
  onError: (error: any) => void;
  onRegionChange: (region: any) => void;
  children?: React.ReactNode;
  miniMode?: boolean;
  banditId?: string;
}

function buildLeafletHtml(args: {
  initialLat: number;
  initialLng: number;
  initialZoom: number;
  markersJson: string;
  athensLat: number;
  athensLng: number;
}): string {
  const { initialLat, initialLng, initialZoom, markersJson, athensLat, athensLng } = args;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <style>
    html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var ATHENS = { lat: ${athensLat}, lng: ${athensLng} };
    var map = L.map('map', { zoomControl: true }).setView([${initialLat}, ${initialLng}], ${initialZoom});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    var markers = [];
    var markerById = {};

    var genreColor = {
      Food: '#E67E22',
      Nightlife: '#8E44AD',
      Shopping: '#2980B9',
      Culture: '#16A085',
      Coffee: '#6E4B3A'
    };

    function colorFor(genre, id) {
      if (genreColor[genre]) return genreColor[genre];
      var fallback = ['#C0392B', '#2E86AB', '#1D8348', '#AF7AC5', '#D68910'];
      var idx = Math.abs(String(id).split('').reduce(function(a, c) { return a + c.charCodeAt(0); }, 0)) % fallback.length;
      return fallback[idx];
    }

    function markerIcon(color) {
      return L.divIcon({
        html: '<div style="width:22px;height:22px;background:' + color + ';border:2px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>',
        className: 'custom-marker-container',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });
    }

    function escapeHtml(s) {
      return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function updateMarkers(markersData) {
      markers.forEach(function(marker) { map.removeLayer(marker); });
      markers = [];
      markerById = {};
      (markersData || []).forEach(function(markerData) {
        if (!markerData || !isFinite(markerData.lat) || !isFinite(markerData.lng)) return;
        var color = colorFor(markerData.genre, markerData.id);
        var marker = L.marker([markerData.lat, markerData.lng], { icon: markerIcon(color) })
          .addTo(map)
          .bindPopup('<div style="min-width:180px"><h3 style="margin:0 0 6px 0;font-size:15px">' + escapeHtml(markerData.name) + '</h3><p style="margin:0;font-size:12px;color:#666">' + escapeHtml(markerData.address) + '</p></div>')
          .on('click', function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'markerClick', eventId: markerData.id }));
          });
        markers.push(marker);
        markerById[markerData.id] = marker;
      });

      if (markers.length > 1) {
        try {
          var group = L.featureGroup(markers);
          map.fitBounds(group.getBounds().pad(0.12), { maxZoom: 15, animate: false });
        } catch (e) {
          map.setView([ATHENS.lat, ATHENS.lng], 13);
        }
      } else if (markers.length === 1) {
        map.setView([markersData[0].lat, markersData[0].lng], 15);
      } else {
        map.setView([ATHENS.lat, ATHENS.lng], 13);
      }

      setTimeout(function() { map.invalidateSize(); }, 120);
    }

    window.__applyMapMarkers = updateMarkers;
    window.__focusMarker = function(eventId) {
      var marker = markerById[eventId];
      if (!marker) return;
      var latlng = marker.getLatLng();
      map.setView(latlng, Math.max(map.getZoom(), 15), { animate: true });
      marker.openPopup();
    };
    window.__resetMapCenter = function(lat, lng, zoom) {
      map.setView([lat, lng], zoom || 13);
    };

    map.on('moveend', function() {
      var center = map.getCenter();
      var zoom = map.getZoom();
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'regionChange',
        center: center,
        latitudeDelta: 0.01 / Math.pow(2, zoom - 10),
        longitudeDelta: 0.01 / Math.pow(2, zoom - 10)
      }));
    });

  var INITIAL_MARKERS = ${markersJson};
  function boot() {
    try {
      updateMarkers(INITIAL_MARKERS);
    } catch (e) {
      map.setView([ATHENS.lat, ATHENS.lng], 13);
    }
    setTimeout(function() {
      map.invalidateSize();
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));
    }, 250);
  }
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);
  </script>
</body>
</html>`;
}

export default function LeafletMapView({
  initialRegion,
  onMapReady,
  onError,
  onRegionChange,
  banditId: banditIdProp,
}: MapViewProps) {
  const eventListRef = useRef<EventListRef>(null);
  const webViewRef = useRef<WebView>(null);
  const { banditId: routeBanditId } = useLocalSearchParams();
  const [mapReady, setMapReady] = useState(false);

  const routeBanditIdValue = Array.isArray(routeBanditId) ? routeBanditId[0] : routeBanditId;
  const scopedBanditId = banditIdProp ?? routeBanditIdValue;

  const { events, loading, error, banditId: mapBanditId } = useMapEvents(
    undefined,
    scopedBanditId ? { banditId: scopedBanditId } : undefined,
  );

  const effectiveBanditId = mapBanditId || scopedBanditId;

  useEffect(() => {
    if (error) {
      onError(new Error(error));
    }
  }, [error, onError]);

  const markersData = useMemo(
    () =>
      events
        .map((event) => {
          const coords = eventMapCoordinates(event);
          if (!coords) return null;
          return {
            id: event.id,
            lat: coords.lat,
            lng: coords.lng,
            name: event.name ?? '',
            address: event.address ?? '',
            genre: event.genre ?? '',
          };
        })
        .filter((row): row is NonNullable<typeof row> => row != null),
    [events],
  );

  const bootHtml = useMemo(
    () =>
      buildLeafletHtml({
        initialLat: ATHENS_CENTER.latitude,
        initialLng: ATHENS_CENTER.longitude,
        initialZoom: 13,
        markersJson: '[]',
        athensLat: ATHENS_CENTER.latitude,
        athensLng: ATHENS_CENTER.longitude,
      }),
    [],
  );

  const webViewKey = `city-map-${effectiveBanditId ?? 'all'}`;

  useEffect(() => {
    setMapReady(false);
  }, [webViewKey]);

  useEffect(() => {
    if (!mapReady || !webViewRef.current) return;
    const payload = JSON.stringify(markersData);
    webViewRef.current.injectJavaScript(`
      (function(){
        if (typeof window.__applyMapMarkers === 'function') {
          window.__applyMapMarkers(${payload});
        }
        true;
      })();
    `);
  }, [mapReady, markersData]);

  const focusMapOnEvent = useCallback(
    (event: Event) => {
      if (!webViewRef.current || !mapReady) return;
      const safeId = String(event.id).replace(/'/g, "\\'");
      webViewRef.current.injectJavaScript(`
        (function(){
          if (typeof window.__focusMarker === 'function') {
            window.__focusMarker('${safeId}');
          }
          true;
        })();
      `);
    },
    [mapReady],
  );

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      switch (data.type) {
        case 'mapReady':
          setMapReady(true);
          onMapReady();
          break;
        case 'markerClick': {
          const clickedEvent = events.find((e) => e.id === data.eventId);
          if (clickedEvent) {
            eventListRef.current?.scrollToEvent(clickedEvent.id);
          }
          break;
        }
        case 'regionChange':
          onRegionChange({
            latitude: data.center.lat,
            longitude: data.center.lng,
            latitudeDelta: data.latitudeDelta,
            longitudeDelta: data.longitudeDelta,
          });
          break;
        case 'error':
          onError(new Error(data.message));
          break;
      }
    } catch (err) {
      console.error('Failed to parse WebView message:', err);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <WebView
          key={webViewKey}
          ref={webViewRef}
          source={{ html: bootHtml }}
          style={styles.webview}
          onMessage={handleWebViewMessage}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          allowsInlineMediaPlayback
          startInLoadingState={false}
          mixedContentMode="always"
          onError={(webviewError) => {
            onError(webviewError);
          }}
        />
        {loading && markersData.length === 0 ? (
          <View style={styles.mapLoadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color="#0a7ea4" />
          </View>
        ) : null}
      </View>

      <EventList
        ref={eventListRef}
        events={events}
        loading={loading}
        error={error}
        banditId={(effectiveBanditId || '') as string}
        variant="horizontal"
        showButton={false}
        imageHeight={120}
        contentContainerStyle={styles.eventsContainer}
        onEventPress={focusMapOnEvent}
      />
    </View>
  );
}

export const LeafletMarker = () => {
  return null;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    height: '40%',
    backgroundColor: '#f0f0f0',
    position: 'relative',
  },
  mapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(238, 241, 244, 0.55)',
  },
  webview: {
    flex: 1,
  },
  eventsContainer: {
    marginTop: 8,
  },
});
