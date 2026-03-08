import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { useColors } from '../../lib/useColors';
import { F } from '../../lib/theme';

interface GpsPoint { latitude: number; longitude: number; recorded_at: string; }

export default function MapReplay() {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);

  const { id }                        = useLocalSearchParams<{ id: string }>();
  const [points, setPoints]           = useState<GpsPoint[]>([]);
  const [loading, setLoading]         = useState(true);
  const [mapReady, setMapReady]       = useState(false);
  const webViewRef                    = useRef<WebView>(null);
  const insets                        = useSafeAreaInsets();
  const router                        = useRouter();

  useEffect(() => {
    if (!id) return;
    api.get(`/bookings/${id}/locations`)
      .then(({ data }) => setPoints(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!mapReady || points.length === 0) return;
    const latlngs = points.map(p => [p.latitude, p.longitude]);
    const js = `
      (function() {
        var pts = ${JSON.stringify(latlngs)};
        var polyline = L.polyline(pts, { color: '#C9A84C', weight: 4, opacity: 0.9 }).addTo(map);
        L.circleMarker(pts[0], { radius: 8, color: '#4CAF50', fillColor: '#4CAF50', fillOpacity: 1 })
          .bindPopup('Start').addTo(map);
        L.circleMarker(pts[pts.length - 1], { radius: 8, color: '#F44336', fillColor: '#F44336', fillOpacity: 1 })
          .bindPopup('End').addTo(map);
        map.fitBounds(polyline.getBounds(), { padding: [20, 20] });
      })();
      true;
    `;
    webViewRef.current?.injectJavaScript(js);
  }, [mapReady, points]);

  const mapHtml = `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#14110C}</style>
</head><body>
<div id="map"></div>
<script>
var map = L.map('map',{zoomControl:true}).setView([51.4669,-0.1651],15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
  attribution:'© OpenStreetMap',maxZoom:19
}).addTo(map);
window.ReactNativeWebView && window.ReactNativeWebView.postMessage('ready');
</script>
</body></html>`;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Walk Route Replay</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={C.gold} size="large" />
        </View>
      ) : points.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyText}>No GPS data recorded for this walk.</Text>
        </View>
      ) : (
        <>
          <View style={s.statsRow}>
            <StatPill C={C} label="Points" value={String(points.length)} />
            <StatPill C={C} label="Start" value={new Date(points[0].recorded_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} />
            <StatPill C={C} label="End" value={new Date(points[points.length - 1].recorded_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} />
          </View>
          <WebView
            ref={webViewRef}
            style={s.map}
            source={{ html: mapHtml }}
            originWhitelist={['*']}
            scrollEnabled={false}
            onMessage={(e) => { if (e.nativeEvent.data === 'ready') setMapReady(true); }}
          />
        </>
      )}
    </View>
  );
}

function StatPill({ C, label, value }: { C: ReturnType<typeof useColors>; label: string; value: string }) {
  return (
    <View style={{
      backgroundColor: C.dark3, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8,
      borderWidth: 1, borderColor: C.border,
    }}>
      <Text style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '700', color: C.cream }}>{value}</Text>
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root:        { flex: 1, backgroundColor: C.dark },
    header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                   backgroundColor: C.dark2, paddingHorizontal: 16, paddingVertical: 14,
                   borderBottomWidth: 1, borderBottomColor: C.border },
    backBtn:     { width: 36, height: 36, borderRadius: 12, backgroundColor: C.dark3,
                   alignItems: 'center', justifyContent: 'center' },
    backText:    { color: C.cream, fontSize: 22, lineHeight: 26 },
    headerTitle: { fontSize: 16, fontWeight: '700', color: C.cream, fontFamily: F.serif },
    statsRow:    { flexDirection: 'row', gap: 10, padding: 16, justifyContent: 'center' },
    map:         { flex: 1 },
    center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyText:   { color: C.muted, fontSize: 14, textAlign: 'center' },
  });
}
