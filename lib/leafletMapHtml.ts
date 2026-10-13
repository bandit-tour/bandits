/** Shared Leaflet-in-WebView boot HTML for native Explore / city map. */

import { LEAFLET_CSS_INLINE, LEAFLET_JS_INLINE } from '@/lib/leafletBundledAssets';

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
  <style>${LEAFLET_CSS_INLINE}</style>
  <script>${LEAFLET_JS_INLINE}</script>
  <style>
    html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; }
    .pin-active {
      width: 34px; height: 34px; border-radius: 50%;
      border: 3px solid #fff; box-shadow: 0 2px 12px rgba(0,0,0,.5);
      display: flex; align-items: center; justify-content: center;
    }
    .pin-active-inner { width: 14px; height: 14px; border-radius: 50%; background: #fff; }
    .pin-dot {
      width: 14px; height: 14px; border-radius: 50%;
      border: 2px solid #fff; box-shadow: 0 1px 5px rgba(0,0,0,.35);
    }
    .pin-cluster {
      min-width: 34px; height: 34px; border-radius: 50%;
      border: 3px solid #fff; box-shadow: 0 2px 10px rgba(0,0,0,.4);
      background: #111111; color: #fff; font: 700 12px/28px -apple-system,Segoe UI,sans-serif;
      text-align: center; padding: 0 6px; box-sizing: border-box;
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
    var catalogLayer = L.layerGroup().addTo(map);
    var selectionLayer = L.layerGroup().addTo(map);
    var activeId = null;
    var suppressMoveNotify = false;
    var moveTimer = null;
    var genreColor = {
      Food: '#E67E22',
      Nightlife: '#8E44AD',
      Shopping: '#2980B9',
      Culture: '#16A085',
      Coffee: '#6E4B3A',
      Art: '#C0392B',
      Wellness: '#1ABC9C',
      Nature: '#27AE60',
      'LGBTQ+': '#E91E63',
      LGBTQ: '#E91E63'
    };

    function post(msg) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      }
    }

    function colorFor(genre, id) {
      var g = String(genre || '');
      if (genreColor[g]) return genreColor[g];
      var fallback = ['#C0392B', '#2E86AB', '#1D8348', '#AF7AC5', '#D68910'];
      var idx = Math.abs(String(id).split('').reduce(function(a, c) { return a + c.charCodeAt(0); }, 0)) % fallback.length;
      return fallback[idx];
    }

    function activeIcon(color) {
      return L.divIcon({
        html: '<div class="pin-active" style="background:' + color + '"><div class="pin-active-inner"></div></div>',
        className: '',
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });
    }

    function dotIcon(color) {
      return L.divIcon({
        html: '<div class="pin-dot" style="background:' + color + '"></div>',
        className: '',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });
    }

    function clusterIcon(count) {
      return L.divIcon({
        html: '<div class="pin-cluster">' + count + '</div>',
        className: '',
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });
    }

    function escapeHtml(s) {
      return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function postMarkerClick(eventId) {
      post({ type: 'markerClick', eventId: eventId });
    }

    function postBounds() {
      var b = map.getBounds();
      var c = map.getCenter();
      post({
        type: 'boundsChanged',
        bounds: {
          north: b.getNorth(),
          south: b.getSouth(),
          east: b.getEast(),
          west: b.getWest()
        },
        center: { lat: c.lat, lng: c.lng, zoom: map.getZoom() }
      });
    }

    function clusterCellSize() {
      var z = map.getZoom();
      if (z >= 15) return 0;
      if (z >= 14) return 0.004;
      if (z >= 13) return 0.008;
      if (z >= 12) return 0.016;
      return 0.03;
    }

    function buildClusters(items) {
      var cell = clusterCellSize();
      if (!cell) {
        return items.map(function(m) { return { type: 'marker', item: m }; });
      }
      var buckets = {};
      for (var i = 0; i < items.length; i++) {
        var m = items[i];
        if (!m || !isFinite(m.lat) || !isFinite(m.lng)) continue;
        var key = Math.round(m.lat / cell) + ':' + Math.round(m.lng / cell);
        if (!buckets[key]) buckets[key] = [];
        buckets[key].push(m);
      }
      var out = [];
      Object.keys(buckets).forEach(function(key) {
        var group = buckets[key];
        if (group.length === 1) {
          out.push({ type: 'marker', item: group[0] });
          return;
        }
        var lat = 0, lng = 0;
        for (var j = 0; j < group.length; j++) {
          lat += group[j].lat;
          lng += group[j].lng;
        }
        out.push({
          type: 'cluster',
          count: group.length,
          lat: lat / group.length,
          lng: lng / group.length,
          ids: group.map(function(g) { return g.id; })
        });
      });
      return out;
    }

    function redrawCatalogDots() {
      catalogLayer.clearLayers();
      var visible = [];
      for (var i = 0; i < catalog.length; i++) {
        var m = catalog[i];
        if (!m || !isFinite(m.lat) || !isFinite(m.lng)) continue;
        if (m.id === activeId) continue;
        visible.push(m);
      }
      var nodes = buildClusters(visible);
      for (var n = 0; n < nodes.length; n++) {
        var node = nodes[n];
        if (node.type === 'cluster') {
          (function(cluster) {
            L.marker([cluster.lat, cluster.lng], { icon: clusterIcon(cluster.count), zIndexOffset: 200 })
              .addTo(catalogLayer)
              .on('click', function() {
                map.setView([cluster.lat, cluster.lng], Math.min(map.getZoom() + 2, 17), { animate: true });
              });
          })(node);
          continue;
        }
        (function(item) {
          var c = colorFor(item.genre, item.id);
          L.marker([item.lat, item.lng], { icon: dotIcon(c), zIndexOffset: 100 })
            .addTo(catalogLayer)
            .on('click', function() { postMarkerClick(item.id); });
        })(node.item);
      }
    }

    function setMapSelection(selectedId, opts) {
      opts = opts || {};
      selectionLayer.clearLayers();
      activeId = selectedId || null;
      redrawCatalogDots();
      if (!selectedId) {
        if (!opts.keepView) {
          suppressMoveNotify = true;
          map.setView([ATHENS.lat, ATHENS.lng], ${initialZoom}, { animate: false });
          setTimeout(function() { suppressMoveNotify = false; }, 120);
        }
        return;
      }
      var selected = null;
      for (var i = 0; i < catalog.length; i++) {
        if (catalog[i] && catalog[i].id === selectedId) { selected = catalog[i]; break; }
      }
      if (!selected || !isFinite(selected.lat) || !isFinite(selected.lng)) return;

      var color = colorFor(selected.genre, selected.id);
      L.marker([selected.lat, selected.lng], { icon: activeIcon(color), zIndexOffset: 1000 })
        .addTo(selectionLayer)
        .on('click', function() { postMarkerClick(selected.id); });

      if (!opts.keepView) {
        suppressMoveNotify = true;
        var targetZoom = Math.max(map.getZoom(), 15);
        map.setView([selected.lat, selected.lng], targetZoom, { animate: true });
        setTimeout(function() {
          map.invalidateSize();
          suppressMoveNotify = false;
        }, 280);
      }
    }

    function setMapCatalog(markersData, opts) {
      opts = opts || {};
      catalog = Array.isArray(markersData) ? markersData : [];
      if (activeId) {
        var stillThere = false;
        for (var i = 0; i < catalog.length; i++) {
          if (catalog[i] && catalog[i].id === activeId) { stillThere = true; break; }
        }
        if (stillThere) {
          setMapSelection(activeId, { keepView: opts.keepView !== false });
          return;
        }
      }
      redrawCatalogDots();
      if (!opts.keepView && catalog.length > 0) {
        var latlngs = [];
        for (var j = 0; j < catalog.length; j++) {
          var row = catalog[j];
          if (row && isFinite(row.lat) && isFinite(row.lng)) latlngs.push([row.lat, row.lng]);
        }
        if (latlngs.length > 0) {
          suppressMoveNotify = true;
          try {
            map.fitBounds(latlngs, { padding: [36, 36], maxZoom: 14 });
          } catch (e) {}
          setTimeout(function() { suppressMoveNotify = false; }, 200);
        }
      }
    }

    map.on('moveend', function() {
      if (suppressMoveNotify) return;
      if (moveTimer) clearTimeout(moveTimer);
      moveTimer = setTimeout(function() {
        redrawCatalogDots();
        postBounds();
      }, 180);
    });

    map.on('zoomend', function() {
      redrawCatalogDots();
    });

    window.__setMapCatalog = function(data) { setMapCatalog(data, { keepView: true }); };
    window.__setMapSelection = function(id) { setMapSelection(id, { keepView: false }); };
    window.__setMapSelectionQuiet = function(id) { setMapSelection(id, { keepView: true }); };
    window.__focusMarker = function(id) { setMapSelection(id, { keepView: false }); };
    window.__applyMapMarkers = function() {};
    window.__fitCatalog = function() { setMapCatalog(catalog, { keepView: false }); };
    window.__invalidateMapSize = function() {
      setTimeout(function() { map.invalidateSize(); }, 40);
    };

    setTimeout(function() {
      map.invalidateSize();
      post({ type: 'mapReady' });
      postBounds();
    }, 80);
  </script>
</body>
</html>`;
}
