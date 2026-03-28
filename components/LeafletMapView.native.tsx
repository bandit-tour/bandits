import { useMapEvents } from '@/hooks/useMapEvents';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import EventList, { EventListRef } from './EventList';

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
}

export default function LeafletMapView({
  initialRegion,
  onMapReady,
  onError,
  onRegionChange,
}: MapViewProps) {
  const eventListRef = useRef<EventListRef>(null);
  const webViewRef = useRef<WebView>(null);
  const { banditId: routeBanditId } = useLocalSearchParams();
  const [mapReady, setMapReady] = useState(false);

  const handleMarkerPress = (event: any) => {
    eventListRef.current?.scrollToEvent(event.id);
  };

  const { events, loading, error, calculateOptimalMapBounds } = useMapEvents();

  useEffect(() => {
    if (error) {
      onError(new Error(error));
    }
  }, [error, onError]);

  useEffect(() => {
    if (mapReady && webViewRef.current && events.length > 0) {
      const markersData = events
        .filter((event) => event.location_lat && event.location_lng)
        .map((event) => ({
          id: event.id,
          lat: event.location_lat,
          lng: event.location_lng,
          name: event.name,
          address: event.address,
          genre: event.genre,
        }));

      webViewRef.current.postMessage(
        JSON.stringify({
          type: 'updateMarkers',
          markers: markersData,
        }),
      );
    }
  }, [events, mapReady]);

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
            handleMarkerPress(clickedEvent);
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

  const getInitialBounds = () => {
    if (events.length === 0) {
      return {
        center: { lat: initialRegion.latitude, lng: initialRegion.longitude },
        zoom: 13,
      };
    }

    const mapBounds = calculateOptimalMapBounds(initialRegion);
    return {
      center: { lat: mapBounds.center.latitude, lng: mapBounds.center.longitude },
      zoom: mapBounds.zoom || 13,
    };
  };

  const initialBounds = getInitialBounds();

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Leaflet Map</title>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" crossorigin=""/>
      <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js" crossorigin=""></script>
      <style>
        body { margin: 0; padding: 0; }
        #map { height: 100vh; width: 100vw; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map').setView([${initialBounds.center.lat}, ${initialBounds.center.lng}], ${initialBounds.zoom});
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);
        var markers = [];

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
          var idx = Math.abs(String(id).split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % fallback.length;
          return fallback[idx];
        }

        function markerIcon(color) {
          return L.divIcon({
            html: '<div style="width:20px;height:20px;background:' + color + ';border:2px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.28)"></div>',
            className: 'custom-marker-container',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });
        }

        function updateMarkers(markersData) {
          markers.forEach(function(marker) { map.removeLayer(marker); });
          markers = [];
          markersData.forEach(function(markerData) {
            var color = colorFor(markerData.genre, markerData.id);
            var marker = L.marker([markerData.lat, markerData.lng], { icon: markerIcon(color) })
              .addTo(map)
              .bindPopup('<div style="min-width:180px"><h3 style="margin:0 0 6px 0;font-size:15px">' + (markerData.name || '') + '</h3><p style="margin:0;font-size:12px;color:#666">' + (markerData.address || '') + '</p></div>')
              .on('click', function() {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'markerClick', eventId: markerData.id }));
              });
            markers.push(marker);
          });
          if (markersData.length > 1) {
            var group = new L.featureGroup(markers);
            map.fitBounds(group.getBounds().pad(0.1));
          }
        }

        function handleIncomingMessage(event) {
          try {
            var data = JSON.parse(event.data);
            if (data.type === 'updateMarkers') updateMarkers(data.markers);
          } catch (e) {}
        }
        document.addEventListener('message', handleIncomingMessage);
        window.addEventListener('message', handleIncomingMessage);

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

        setTimeout(function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));
        }, 600);
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: htmlContent }}
          style={styles.webview}
          onMessage={handleWebViewMessage}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          mixedContentMode="compatibility"
          onError={(error) => {
            onError(error);
          }}
        />
      </View>

      <EventList
        ref={eventListRef}
        events={events}
        loading={loading}
        error={error}
        banditId={routeBanditId as string}
        variant="horizontal"
        showButton={false}
        imageHeight={120}
        contentContainerStyle={styles.eventsContainer}
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
  },
  webview: {
    flex: 1,
  },
  eventsContainer: {
    marginTop: 8,
  },
});
