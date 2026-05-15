/** Shared Leaflet-in-WebView boot HTML for native Explore / city map. */

export function buildLeafletBootHtml(args: {
  initialLat: number;
  initialLng: number;
  initialZoom: number;
  athensLat: number;
  athensLng: number;
}): string {
  const { initialLat, initialLng, initialZoom, athensLat, athensLng } = args;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <style>
    html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; }
    .pin-active {
      width: 32px; height: 32px; border-radius: 50%;
      border: 3px solid #fff; box-shadow: 0 2px 10px rgba(0,0,0,.45);
      display: flex; align-items: center; justify-content: center;
    }
    .pin-active-inner { width: 14px; height: 14px; border-radius: 50%; background: #fff; }
    .pin-near {
      width: 12px; height: 12px; border-radius: 50%;
      border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.25);
      opacity: 0.55;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var ATHENS = { lat: ${athensLat}, lng: ${athensLng} };
    var map = L.map('map', { zoomControl: true, preferCanvas: true }).setView([${initialLat}, ${initialLng}], ${initialZoom});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    var catalog = [];
    var layerGroup = L.layerGroup().addTo(map);
    var activeId = null;
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

    function activeIcon(color) {
      return L.divIcon({
        html: '<div class="pin-active" style="background:' + color + '"><div class="pin-active-inner"></div></div>',
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
    }

    function nearIcon(color) {
      return L.divIcon({
        html: '<div class="pin-near" style="background:' + color + '"></div>',
        className: '',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });
    }

    function escapeHtml(s) {
      return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function dist2(a, b) {
      var dlat = a.lat - b.lat;
      var dlng = a.lng - b.lng;
      return dlat * dlat + dlng * dlng;
    }

    function nearestNeighbors(selected, maxN) {
      var out = [];
      for (var i = 0; i < catalog.length; i++) {
        var m = catalog[i];
        if (!m || m.id === selected.id) continue;
        if (!isFinite(m.lat) || !isFinite(m.lng)) continue;
        out.push({ m: m, d: dist2(selected, m) });
      }
      out.sort(function(a, b) { return a.d - b.d; });
      return out.slice(0, maxN).map(function(x) { return x.m; });
    }

    function postMarkerClick(eventId) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'markerClick', eventId: eventId }));
    }

    function setMapSelection(selectedId) {
      layerGroup.clearLayers();
      activeId = selectedId || null;
      if (!selectedId) {
        map.setView([ATHENS.lat, ATHENS.lng], ${initialZoom}, { animate: false });
        return;
      }
      var selected = null;
      for (var i = 0; i < catalog.length; i++) {
        if (catalog[i] && catalog[i].id === selectedId) { selected = catalog[i]; break; }
      }
      if (!selected || !isFinite(selected.lat) || !isFinite(selected.lng)) return;

      var color = colorFor(selected.genre, selected.id);
      L.marker([selected.lat, selected.lng], { icon: activeIcon(color), zIndexOffset: 1000 })
        .addTo(layerGroup)
        .bindPopup('<div style="min-width:160px"><b>' + escapeHtml(selected.name) + '</b><br/><span style="font-size:12px;color:#666">' + escapeHtml(selected.address) + '</span></div>')
        .on('click', function() { postMarkerClick(selected.id); });

      var neighbors = nearestNeighbors(selected, 5);
      neighbors.forEach(function(n) {
        var c = colorFor(n.genre, n.id);
        L.marker([n.lat, n.lng], { icon: nearIcon(c), zIndexOffset: 100 })
          .addTo(layerGroup)
          .on('click', function() { postMarkerClick(n.id); });
      });

      map.setView([selected.lat, selected.lng], 16, { animate: true });
      setTimeout(function() { map.invalidateSize(); }, 40);
    }

    function setMapCatalog(markersData) {
      catalog = Array.isArray(markersData) ? markersData : [];
    }

    window.__setMapCatalog = setMapCatalog;
    window.__setMapSelection = setMapSelection;
    window.__focusMarker = setMapSelection;
    window.__applyMapMarkers = function() {};

    setTimeout(function() {
      map.invalidateSize();
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));
    }, 40);
  </script>
</body>
</html>`;
}
