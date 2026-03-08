import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet,
         Linking, Alert, ActivityIndicator, AppState, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../lib/api';
import { useColors } from '../../lib/useColors';
import { F } from '../../lib/theme';

interface NextBooking {
  id: string; dog_name: string; dog_photo_url?: string; service_name: string;
  slot_date: string; slot_start: string; slot_end: string; status: string;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

const PACKAGES = [
  { title: 'Single Walk',    price: '£25',    note: 'Pay as you go',                  product: 'single' },
  { title: '5 Walk Bundle',  price: '£110',   note: 'Save £15',                       product: 'bundle5',     badge: 'Popular' },
  { title: '10 Walk Bundle', price: '£200',   note: 'Save £50',                       product: 'bundle10',    badge: 'Best value' },
  { title: 'Monthly Plan',   price: '£80/mo', note: '5 walks/month · Priority booking', product: 'subscription' },
] as const;

export default function Home() {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);

  const { user } = useAuthStore();
  const router   = useRouter();
  const [credits,     setCredits]     = useState<number | null>(null);
  const [nextBooking, setNextBooking] = useState<NextBooking | null | 'loading'>('loading');
  const [purchasing,  setPurchasing]  = useState<string | null>(null);

  const refreshWallet = () =>
    api.get('/payments/wallet').then(({ data }) => setCredits(data.balance)).catch(() => {});

  useEffect(() => {
    refreshWallet();
    api.get('/bookings/next')
      .then(({ data }) => setNextBooking(data))
      .catch(() => setNextBooking(null));
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', st => { if (st === 'active') refreshWallet(); });
    return () => sub.remove();
  }, []);

  const openCheckout = async (product: string) => {
    setPurchasing(product);
    try {
      const { data } = await api.post('/payments/checkout', { product });
      await Linking.openURL(data.url);
    } catch {
      Alert.alert('Error', 'Could not open checkout. Please try again.');
    } finally {
      setPurchasing(null);
    }
  };

  const firstName = user?.first_name ?? 'there';
  const nb = nextBooking !== 'loading' ? nextBooking : null;

  return (
    <View style={s.root}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Greeting */}
        <View style={s.greeting}>
          <Text style={s.greetText}>{greeting()},</Text>
          <Text style={s.greetName}>{firstName}</Text>
        </View>

        {/* Credits pill */}
        <TouchableOpacity style={s.creditPill} onPress={() => router.push('/(tabs)/profile')}>
          <View style={s.creditDot} />
          <Text style={s.creditText}>
            {credits !== null ? `${credits} credit${credits !== 1 ? 's' : ''} remaining` : 'Loading wallet…'}
          </Text>
          <Text style={s.creditArrow}>›</Text>
        </TouchableOpacity>

        {/* Next walk card */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Next walk</Text>

          <View style={s.walkCard}>
            {nextBooking === 'loading' ? (
              <ActivityIndicator color={C.gold} />
            ) : nb ? (
              <>
                <View style={s.walkRow}>
                  {nb.dog_photo_url
                    ? <Image source={{ uri: nb.dog_photo_url }} style={s.walkAvatar} />
                    : <View style={s.walkAvatarFallback}><Text style={s.walkAvatarInitial}>{nb.dog_name[0]}</Text></View>
                  }
                  <View style={s.walkInfo}>
                    <Text style={s.walkDog}>{nb.dog_name}</Text>
                    <Text style={s.walkService}>{nb.service_name}</Text>
                    <Text style={s.walkWhen}>{fmtDate(nb.slot_date)} · {nb.slot_start.slice(0, 5)}–{nb.slot_end.slice(0, 5)}</Text>
                  </View>
                  <View style={[s.statusBadge, nb.status === 'in_progress' && s.statusLive]}>
                    <View style={[s.statusDot, nb.status === 'in_progress' && s.statusDotLive]} />
                    <Text style={[s.statusText, nb.status === 'in_progress' && s.statusTextLive]}>
                      {nb.status === 'in_progress' ? 'Live' : nb.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                    </Text>
                  </View>
                </View>
                {nb.status === 'in_progress' && (
                  <TouchableOpacity
                    style={s.viewBtn}
                    onPress={() => router.push({ pathname: '/booking/[id]', params: { id: nb.id } })}
                  >
                    <Text style={s.viewBtnText}>View live updates</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View style={s.walkEmpty}>
                <Text style={s.walkEmptyTitle}>No upcoming walks</Text>
                <Text style={s.walkEmptySub}>Book a walk below to get started</Text>
              </View>
            )}
          </View>
        </View>

        {/* Quick actions */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Quick access</Text>
          <View style={s.quickRow}>
            <TouchableOpacity style={s.quickCard} onPress={() => router.push('/(tabs)/tracking')}>
              <Text style={s.quickTitle}>Live Tracking</Text>
              <Text style={s.quickSub}>See your dog in real time</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.quickCard} onPress={() => router.push('/(tabs)/book')}>
              <Text style={s.quickTitle}>Book a Walk</Text>
              <Text style={s.quickSub}>Check slots and book</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Packages */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Walks &amp; pricing</Text>
          <View style={s.packageList}>
            {PACKAGES.map((pkg, i) => (
              <TouchableOpacity
                key={pkg.product}
                style={[s.packageRow, i < PACKAGES.length - 1 && s.packageBorder]}
                onPress={() => openCheckout(pkg.product)}
                activeOpacity={0.7}
              >
                <View style={s.packageLeft}>
                  <Text style={s.packageTitle}>{pkg.title}</Text>
                  <Text style={s.packageNote}>{pkg.note}</Text>
                </View>
                <View style={s.packageRight}>
                  <Text style={s.packagePrice}>{pkg.price}</Text>
                  {purchasing === pkg.product ? (
                    <ActivityIndicator color={C.gold} style={{ marginTop: 2 }} size="small" />
                  ) : pkg.badge ? (
                    <Text style={s.packageBadge}>{pkg.badge}</Text>
                  ) : (
                    <Text style={s.packageArrow}>›</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root:    { flex: 1, backgroundColor: C.dark },
    scroll:  { flex: 1 },
    content: { paddingBottom: 100, paddingTop: 72, paddingHorizontal: 22 },

    greeting:   { marginBottom: 20 },
    greetText:  { fontSize: 15, color: C.textDim, marginBottom: 2 },
    greetName:  { fontSize: 30, fontWeight: '700', color: C.cream, letterSpacing: -0.5, fontFamily: F.serif },

    creditPill: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
                  backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.goldBorder,
                  borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 32 },
    creditDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: C.gold },
    creditText: { fontSize: 13, color: C.gold, fontWeight: '500' },
    creditArrow:{ fontSize: 16, color: C.gold, marginLeft: 2 },

    section:      { marginBottom: 28 },
    sectionLabel: { fontSize: 11, fontWeight: '600', color: C.muted, textTransform: 'uppercase',
                    letterSpacing: 0.8, marginBottom: 12 },

    walkCard:           { backgroundColor: C.dark3, borderRadius: 18, padding: 18,
                          borderWidth: 1, borderColor: C.border },
    walkRow:            { flexDirection: 'row', alignItems: 'center', gap: 14 },
    walkAvatar:         { width: 56, height: 56, borderRadius: 28, flexShrink: 0 },
    walkAvatarFallback: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.dark4,
                          alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    walkAvatarInitial:  { fontSize: 22, fontWeight: '700', color: C.gold, fontFamily: F.serif },
    walkInfo:           { flex: 1 },
    walkDog:            { fontSize: 16, fontWeight: '600', color: C.cream, marginBottom: 2 },
    walkService:        { fontSize: 13, color: C.textDim },
    walkWhen:           { fontSize: 12, color: C.muted, marginTop: 3 },

    statusBadge:    { flexDirection: 'row', alignItems: 'center', gap: 5,
                      paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10,
                      backgroundColor: C.dark4 },
    statusLive:     { backgroundColor: C.greenSoft, borderWidth: 1, borderColor: 'rgba(76,175,122,0.25)' },
    statusDot:      { width: 5, height: 5, borderRadius: 3, backgroundColor: C.muted },
    statusDotLive:  { backgroundColor: C.green },
    statusText:     { fontSize: 11, fontWeight: '600', color: C.textDim },
    statusTextLive: { color: C.green },

    viewBtn:     { marginTop: 14, backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.goldBorder,
                   borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
    viewBtnText: { color: C.gold, fontSize: 13, fontWeight: '600' },

    walkEmpty:      { paddingVertical: 8 },
    walkEmptyTitle: { fontSize: 15, fontWeight: '600', color: C.textDim },
    walkEmptySub:   { fontSize: 13, color: C.muted, marginTop: 4 },

    quickRow:   { flexDirection: 'row', gap: 12 },
    quickCard:  { flex: 1, backgroundColor: C.dark3, borderRadius: 16, padding: 18,
                  borderWidth: 1, borderColor: C.border },
    quickTitle: { fontSize: 14, fontWeight: '600', color: C.cream, marginBottom: 5 },
    quickSub:   { fontSize: 12, color: C.muted, lineHeight: 16 },

    packageList:   { backgroundColor: C.dark3, borderRadius: 18, borderWidth: 1, borderColor: C.border,
                     overflow: 'hidden' },
    packageRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                     paddingHorizontal: 18, paddingVertical: 16 },
    packageBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
    packageLeft:   { flex: 1 },
    packageTitle:  { fontSize: 15, fontWeight: '600', color: C.cream },
    packageNote:   { fontSize: 12, color: C.muted, marginTop: 3 },
    packageRight:  { alignItems: 'flex-end', gap: 3, flexShrink: 0, paddingLeft: 12 },
    packagePrice:  { fontSize: 16, fontWeight: '700', color: C.gold },
    packageBadge:  { fontSize: 10, fontWeight: '600', color: C.gold, letterSpacing: 0.3 },
    packageArrow:  { fontSize: 18, color: C.muted },
  });
}
