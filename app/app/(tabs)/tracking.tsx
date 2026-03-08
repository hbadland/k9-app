import { useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { getAccessToken } from '../../lib/auth';
import { getSocket } from '../../lib/socket';
import { api } from '../../lib/api';
import { useColors } from '../../lib/useColors';
import { F } from '../../lib/theme';

const CLAPHAM_LAT = 51.4669;
const CLAPHAM_LNG = -0.1651;
const DELTA = 0.008;

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export default function Tracking() {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);

  const { dogId, dogName } = useLocalSearchParams<{ dogId?: string; dogName?: string }>();
  const insets = useSafeAreaInsets();
  const mapRef  = useRef<MapView>(null);
  const prevRef = useRef<{ lat: number; lng: number } | null>(null);
  const startRef = useRef<Date | null>(null);

  const [location,  setLocation]  = useState<{ lat: number; lng: number } | null>(null);
  const [active,    setActive]    = useState(false);
  const [distance,  setDistance]  = useState(0);
  const [elapsed,   setElapsed]   = useState(0);
  const [dogPhoto,  setDogPhoto]  = useState<string | null>(null);
  const [ready,     setReady]     = useState(false);

  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => {
      if (startRef.current) setElapsed(Math.floor((Date.now() - startRef.current.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [active]);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const token = await getAccessToken();
      if (!token || cancelled) return;

      if (dogId) {
        try {
          const { data } = await api.get<{ id: string; avatar_url: string | null }[]>('/dogs');
          const dog = data.find(d => d.id === dogId);
          if (dog?.avatar_url && !cancelled) setDogPhoto(dog.avatar_url);
        } catch {}
      }

      const sock = getSocket(token);
      if (dogId) sock.emit('subscribe:dog', { dogId });

      sock.on('walk:status', ({ active: a }: { active: boolean }) => {
        setActive(a);
        if (a && !startRef.current) startRef.current = new Date();
      });

      sock.on('location:update', ({ lat, lng }: { lat: number; lng: number }) => {
        if (prevRef.current) setDistance(d => d + haversine(prevRef.current!, { lat, lng }));
        prevRef.current = { lat, lng };
        setLocation({ lat, lng });
        mapRef.current?.animateToRegion(
          { latitude: lat, longitude: lng, latitudeDelta: DELTA, longitudeDelta: DELTA },
          600
        );
      });

      if (!cancelled) setReady(true);

      cleanup = () => {
        if (dogId) sock.emit('unsubscribe:dog', { dogId });
        sock.off('walk:status');
        sock.off('location:update');
      };
    })();

    return () => { cancelled = true; cleanup?.(); };
  }, [dogId]);

  const fmt = (sec: number) =>
    `${Math.floor(sec / 60).toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`;

  const markerCoord = {
    latitude:  location?.lat ?? CLAPHAM_LAT,
    longitude: location?.lng ?? CLAPHAM_LNG,
  };

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={s.headerTitle}>Live Tracking</Text>
          {dogName ? <Text style={s.headerSub}>{dogName}</Text> : null}
        </View>
        <View style={[s.badge, active ? s.badgeLive : s.badgeIdle]}>
          <View style={[s.dot, active ? s.dotLive : s.dotIdle]} />
          <Text style={[s.badgeText, active ? s.badgeTextLive : s.badgeTextIdle]}>
            {active ? 'Live' : 'No active walk'}
          </Text>
        </View>
      </View>

      {/* Map */}
      {ready ? (
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          style={s.map}
          initialRegion={{
            latitude: markerCoord.latitude,
            longitude: markerCoord.longitude,
            latitudeDelta: DELTA,
            longitudeDelta: DELTA,
          }}
          showsUserLocation={false}
          showsPointsOfInterest
          showsBuildings
        >
          <Marker coordinate={markerCoord} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={s.markerWrap}>
              {dogPhoto ? (
                <Image source={{ uri: dogPhoto }} style={s.markerImg} />
              ) : (
                <View style={s.markerFallback}>
                  <Text style={s.markerFallbackText}>
                    {dogName?.[0]?.toUpperCase() ?? 'K'}
                  </Text>
                </View>
              )}
            </View>
          </Marker>
        </MapView>
      ) : (
        <View style={s.mapPlaceholder}>
          <ActivityIndicator color={C.gold} size="large" />
        </View>
      )}

      {/* Stats panel */}
      <View style={[s.panel, { paddingBottom: insets.bottom + 76 }]}>
        <View style={s.stats}>
          <View style={s.stat}>
            <Text style={s.statVal}>{fmt(active ? elapsed : 0)}</Text>
            <Text style={s.statLbl}>Elapsed</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.stat}>
            <Text style={s.statVal}>{(distance / 1000).toFixed(2)} km</Text>
            <Text style={s.statLbl}>Distance</Text>
          </View>
        </View>

        {!dogId && (
          <Text style={s.hint}>Tap "Track" on a booking to follow your dog live.</Text>
        )}
      </View>
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root:      { flex: 1, backgroundColor: C.dark },

    header:    { backgroundColor: C.dark, paddingHorizontal: 22, paddingBottom: 14,
                 flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                 borderBottomWidth: 1, borderBottomColor: C.border },
    headerTitle: { fontSize: 20, fontWeight: '700', color: C.cream, fontFamily: F.serif },
    headerSub:   { fontSize: 12, color: C.gold, marginTop: 2 },

    map:          { flex: 1 },
    mapPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.dark2 },

    markerWrap:         { alignItems: 'center', justifyContent: 'center' },
    markerImg:          { width: 48, height: 48, borderRadius: 24, borderWidth: 3, borderColor: C.gold },
    markerFallback:     { width: 48, height: 48, borderRadius: 24, backgroundColor: C.dark2,
                          borderWidth: 3, borderColor: C.gold, alignItems: 'center', justifyContent: 'center' },
    markerFallbackText: { fontSize: 18, fontWeight: '700', color: C.gold, fontFamily: F.serif },

    badge:         { flexDirection: 'row', alignItems: 'center', gap: 6,
                     paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    badgeLive:     { backgroundColor: C.greenSoft, borderWidth: 1, borderColor: 'rgba(76,175,122,0.25)' },
    badgeIdle:     { backgroundColor: C.dark4, borderWidth: 1, borderColor: C.border },
    dot:           { width: 7, height: 7, borderRadius: 4 },
    dotLive:       { backgroundColor: C.green },
    dotIdle:       { backgroundColor: C.muted },
    badgeText:     { fontSize: 12, fontWeight: '600' },
    badgeTextLive: { color: C.green },
    badgeTextIdle: { color: C.textDim },

    panel:         { backgroundColor: C.dark, borderTopWidth: 1, borderTopColor: C.border,
                     paddingTop: 20, paddingHorizontal: 24 },
    stats:         { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    stat:          { flex: 1, alignItems: 'center' },
    statVal:       { fontSize: 26, fontWeight: '700', color: C.cream, fontFamily: F.serif },
    statLbl:       { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, color: C.textDim, marginTop: 2 },
    statDivider:   { width: 1, height: 40, backgroundColor: C.border },

    hint:          { marginTop: 10, fontSize: 12, color: C.muted, textAlign: 'center' },
  });
}
