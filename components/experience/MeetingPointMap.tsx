import React, { createElement, useMemo } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

type Props = {
  lat: number;
  lng: number;
  label: string;
  height?: number;
};

/** Compact meeting-point map with pin — OSM tiles via WebView / iframe. */
export function MeetingPointMap({ lat, lng, label, height = 200 }: Props) {
  const html = useMemo(
    () => `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#m{margin:0;padding:0;height:100%;width:100%;background:#E8EDE8}
  .pin{width:28px;height:28px;border-radius:50% 50% 50% 0;background:#B85C38;border:3px solid #fff;
    box-shadow:0 2px 8px rgba(0,0,0,.35);transform:rotate(-45deg)}
  .pin i{display:block;width:10px;height:10px;margin:5px auto;border-radius:50%;background:#fff;transform:rotate(45deg)}
</style>
</head><body>
<div id="m"></div>
<script>
  var map = L.map('m',{zoomControl:false,attributionControl:true}).setView([${lat},${lng}],16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OSM'}).addTo(map);
  var icon = L.divIcon({className:'',html:'<div class="pin"><i></div>',iconSize:[28,28],iconAnchor:[14,28]});
  L.marker([${lat},${lng}],{icon:icon}).addTo(map).bindPopup(${JSON.stringify(label)});
</script>
</body></html>`,
    [lat, lng, label],
  );

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  return (
    <View style={[styles.wrap, { height }]}>
      {Platform.OS === "web"
        ? createElement("iframe", {
            title: label,
            srcDoc: html,
            style: { border: "none", width: "100%", height: "100%" },
          })
        : (
          <WebView
            originWhitelist={["*"]}
            source={{ html }}
            style={styles.web}
            scrollEnabled={false}
            javaScriptEnabled
          />
        )}
      <Pressable style={styles.directions} onPress={() => void Linking.openURL(mapsUrl)}>
        <Text style={styles.directionsText}>Get directions</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#E8EDE8",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#D8D2C8",
  },
  web: { flex: 1, backgroundColor: "#E8EDE8" },
  directions: {
    position: "absolute",
    right: 12,
    bottom: 12,
    backgroundColor: "#1A1A1A",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  directionsText: { color: "#FFF", fontWeight: "700", fontSize: 13 },
});
