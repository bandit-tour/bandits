/**
 * Self-contained Leaflet HTML for WebView-based scam alert maps (no RN bridge).
 */
export function buildScamAlertsLeafletHtml(args: {
  centerLat: number;
  centerLng: number;
  zoom: number;
  markers: { id: string; lat: number; lng: number; title: string; severity: number }[];
}): string {
  const markersJson = JSON.stringify(args.markers);
  const { centerLat, centerLng, zoom } = args;
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html,body,#map{margin:0;padding:0;height:100%;width:100%;}</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  const markers = ${markersJson};
  const map = L.map('map').setView([${centerLat}, ${centerLng}], ${zoom});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  const sevColor = (s) => (s >= 3 ? '#C62828' : s <= 1 ? '#2E7D32' : '#F57C00');
  markers.forEach((m) => {
    const c = sevColor(Number(m.severity) || 2);
    const circle = L.circleMarker([m.lat, m.lng], {
      radius: 9,
      color: '#111',
      weight: 1,
      fillColor: c,
      fillOpacity: 0.92
    }).addTo(map);
    circle.bindPopup('<b>' + (m.title || 'Alert').replace(/</g,'') + '</b>');
  });
  if (markers.length > 1) {
    const b = L.latLngBounds(markers.map((m) => [m.lat, m.lng]));
    map.fitBounds(b.pad(0.2));
  }
</script>
</body></html>`;
}

/** Rough city centers when alerts have no coordinates */
export function defaultCenterForCity(city: string): { lat: number; lng: number } {
  const c = city.trim().toLowerCase();
  if (c.includes('athens')) return { lat: 37.9838, lng: 23.7275 };
  if (c.includes('paris')) return { lat: 48.8566, lng: 2.3522 };
  if (c.includes('london')) return { lat: 51.5074, lng: -0.1278 };
  if (c.includes('rome')) return { lat: 41.9028, lng: 12.4964 };
  return { lat: 40.7128, lng: -74.006 };
}
