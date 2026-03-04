import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Linking, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';

import { api } from '../../lib/api';
import { C, F } from '../../lib/theme';

const { width } = Dimensions.get('window');

interface NextBooking {
  dog_name: string; service_name: string; slot_date: string;
  slot_start: string; slot_end: string; status: string;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const { user } = useAuthStore();
  const router   = useRouter();
  const [credits,       setCredits]       = useState<number | null>(null);
  const [nextBooking,   setNextBooking]   = useState<NextBooking | null | 'loading'>('loading');
  const [purchasing,    setPurchasing]    = useState<string | null>(null);

  useEffect(() => {
    api.get('/bookings/next')
      .then(({ data }) => setNextBooking(data))
      .catch(() => setNextBooking(null));
    api.get('/payments/wallet')
      .then(({ data }) => setCredits(data.balance))
      .catch(() => setCredits(0));
  }, []);

  const openCheckout = async (productKey: string) => {
    setPurchasing(productKey);
    try {
      const { data } = await api.post('/payments/checkout', { product: productKey });
      await Linking.openURL(data.url);
    } catch {
      Alert.alert('Error', 'Could not open checkout. Please try again.');
    } finally {
      setPurchasing(null);
    }
  };

  const firstName = user?.first_name ?? 'there';

  return (
    <View style={s.root}>
      {/* Hero gradient background */}
      <LinearGradient
        colors={['#1F1C14', '#131109', C.dark]}
        style={s.heroBg}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* 🐾 watermark */}
      <Text style={s.pawBg}>🐾</Text>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <View style={s.heroText}>
          <Text style={s.greetingLabel}>{greeting()}</Text>
          <Text style={s.heroName}>
            Welcome back,{'\n'}
            <Text style={s.heroNameAccent}>{firstName}</Text>
          </Text>
        </View>

        {/* Next Walk Card */}
        <View style={s.nwc}>
          <LinearGradient
            colors={[C.gold, 'transparent']}
            style={s.nwcAccent}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          />
          <Text style={s.nwcLabel}>🐾  Next Scheduled Walk</Text>
          {nextBooking && nextBooking !== 'loading' ? (
            <>
              <View style={s.nwcRow}>
                <View style={s.dogAv}><Text style={s.dogAvText}>🐶</Text></View>
                <View style={s.nwcInfo}>
                  <Text style={s.nwcDogName}>{nextBooking.dog_name}</Text>
                  <Text style={s.nwcWhen}>
                    {new Date(nextBooking.slot_date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {' · '}{nextBooking.slot_start.slice(0, 5)} – {nextBooking.slot_end.slice(0, 5)}
                  </Text>
                </View>
                <View style={[s.nwcBadge, nextBooking.status === 'confirmed' && s.nwcBadgeConfirmed]}>
                  <Text style={[s.nwcBadgeText, nextBooking.status === 'confirmed' && s.nwcBadgeConfirmedText]}>
                    {nextBooking.status.charAt(0).toUpperCase() + nextBooking.status.slice(1)}
                  </Text>
                </View>
              </View>
              <View style={s.nwcDivider} />
              <View style={s.nwcMeta}>
                {[
                  [nextBooking.service_name, 'Service'],
                  ['SW11', 'Area'],
                  ['Jack', 'Walker'],
                ].map(([val, lbl]) => (
                  <View key={lbl} style={s.nwcMetaItem}>
                    <Text style={s.nwcMetaVal} numberOfLines={1}>{val}</Text>
                    <Text style={s.nwcMetaLbl}>{lbl}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <>
              <View style={s.nwcRow}>
                <View style={s.dogAv}><Text style={s.dogAvText}>🐶</Text></View>
                <View style={s.nwcInfo}>
                  <Text style={s.nwcDogName}>No walks booked yet</Text>
                  <Text style={s.nwcWhen}>Book your first walk below</Text>
                </View>
              </View>
              <View style={s.nwcDivider} />
              <View style={s.nwcMeta}>
                {[['—', 'Duration'], ['SW11', 'Area'], ['Jack', 'Walker']].map(([val, lbl]) => (
                  <View key={lbl} style={s.nwcMetaItem}>
                    <Text style={s.nwcMetaVal}>{val}</Text>
                    <Text style={s.nwcMetaLbl}>{lbl}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        {/* Quick Access */}
        <Text style={s.tilesLabel}>Quick Access</Text>
        <View style={s.tiles}>
          <TouchableOpacity style={s.tile} onPress={() => router.push('/(tabs)/dogs')}>
            <View style={[s.tileAccent, { backgroundColor: C.gold }]} />
            <Text style={s.tileIcon}>📍</Text>
            <Text style={s.tileTitle}>Live Tracking</Text>
            <Text style={s.tileSub}>See where your dog is right now</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.tile} onPress={() => router.push('/(tabs)/dogs')}>
            <View style={[s.tileAccent, { backgroundColor: C.green }]} />
            <Text style={s.tileIcon}>📅</Text>
            <Text style={s.tileTitle}>Book a Walk</Text>
            <Text style={s.tileSub}>Check slots & book instantly</Text>
          </TouchableOpacity>
        </View>

        {/* Wallet strip */}
        <View style={s.walletStrip}>
          <View style={s.walletLeft}>
            <Text style={s.walletLabel}>Your Credits</Text>
            <Text style={s.walletVal}>
              {credits ?? 0}
              <Text style={s.walletValSub}> walks remaining</Text>
            </Text>
          </View>
          <View style={s.walletRight}>
            <View style={s.walletBar}>
              <LinearGradient
                colors={[C.goldLight, C.gold]}
                style={[s.walletBarFill, { width: `${Math.min(100, ((credits ?? 0) / 10) * 100)}%` }]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              />
            </View>
            <Text style={s.walletBarSub}>{credits ?? 0} of 10 bundle</Text>
          </View>
        </View>

        {/* Purchase cards */}
        <Text style={[s.tilesLabel, { paddingTop: 8 }]}>Walks &amp; Pricing</Text>
        {[
          { accent: C.blue,    icon: '🦮', title: 'Single Walk',    desc: 'One-off booking, pay as you go',           product: 'single' },
          { accent: C.gold,    icon: '🎒', title: '10 Walk Bundle', desc: 'Buy 10 walks — save £50 vs single price',  product: 'bundle10', badge: 'Best value' },
          { accent: '#A080D8', icon: '⭐', title: 'Monthly Plan',   desc: '5 walks/month with priority booking',      product: 'subscription' },
        ].map(({ accent, icon, title, desc, badge, product }) => (
          <TouchableOpacity key={title} style={s.purchaseCard} activeOpacity={0.75}
            onPress={() => openCheckout(product)}>
            <View style={[s.purchaseCardAccent, { backgroundColor: accent }]} />
            <View style={s.pcLeft}>
              <View style={[s.pcIconWrap, { backgroundColor: `${accent}26` }]}>
                <Text style={s.pcIcon}>{icon}</Text>
              </View>
              <View>
                <Text style={s.pcTitle}>{title}</Text>
                <Text style={s.pcDesc}>{desc}</Text>
              </View>
            </View>
            {purchasing === product
              ? <ActivityIndicator color={C.gold} style={{ paddingLeft: 8 }} />
              : badge
                ? <View style={s.pcBadge}><Text style={s.pcBadgeText}>{badge}</Text></View>
                : <Text style={s.pcArrow}>›</Text>
            }
          </TouchableOpacity>
        ))}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: C.dark },
  heroBg:         { position: 'absolute', top: 0, left: 0, right: 0, height: 300 },
  pawBg:          { position: 'absolute', top: 50, right: -10, fontSize: 160, opacity: 0.03, zIndex: 0 },
  scroll:         { flex: 1, zIndex: 1 },
  content:        { paddingBottom: 100 },

  // Greeting
  heroText:       { paddingTop: 72, paddingHorizontal: 24, paddingBottom: 24 },
  greetingLabel:  { fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: C.gold, opacity: 0.8, marginBottom: 6 },
  heroName:       { fontSize: 30, color: C.cream, lineHeight: 36, fontFamily: F.serif },
  heroNameAccent: { color: C.gold, fontStyle: 'italic', fontFamily: F.serif },

  // NWC card
  nwc:            { marginHorizontal: 20, marginBottom: 4, backgroundColor: C.dark3,
                    borderWidth: 1, borderColor: `${C.gold}2E`, borderRadius: 22, padding: 20, overflow: 'hidden' },
  nwcAccent:      { position: 'absolute', top: 0, left: 0, right: 0, height: 2 },
  nwcLabel:       { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.8, color: C.gold, marginBottom: 14, opacity: 0.8 },
  nwcRow:         { flexDirection: 'row', alignItems: 'center', gap: 14 },
  dogAv:          { width: 54, height: 54, borderRadius: 27, backgroundColor: C.dark4,
                    borderWidth: 2, borderColor: `${C.gold}59`, alignItems: 'center', justifyContent: 'center' },
  dogAvText:      { fontSize: 26 },
  nwcInfo:        { flex: 1 },
  nwcDogName:     { fontSize: 17, fontWeight: '600', color: C.cream },
  nwcWhen:        { fontSize: 12, color: C.textDim, marginTop: 3 },
  nwcBadge:       { backgroundColor: `${C.green}21`, borderWidth: 1, borderColor: `${C.green}47`,
                    paddingHorizontal: 11, paddingVertical: 5, borderRadius: 10 },
  nwcBadgeText:   { fontSize: 11, fontWeight: '600', color: C.green },
  nwcDivider:     { height: 1, backgroundColor: C.dark4, marginVertical: 16 },
  nwcMeta:        { flexDirection: 'row', justifyContent: 'space-around' },
  nwcMetaItem:    { alignItems: 'center' },
  nwcMetaVal:     { fontSize: 15, fontWeight: '700', color: C.cream },
  nwcMetaLbl:     { fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },

  // Tiles
  tilesLabel:     { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.8, color: C.textDim,
                    paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12 },
  tiles:          { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginBottom: 4 },
  tile:           { flex: 1, backgroundColor: C.dark3, borderWidth: 1, borderColor: C.dark4,
                    borderRadius: 20, padding: 20, overflow: 'hidden' },
  tileAccent:     { position: 'absolute', top: 0, left: 0, right: 0, height: 2, borderRadius: 2 },
  tileIcon:       { fontSize: 28, marginBottom: 12 },
  tileTitle:      { fontSize: 13, fontWeight: '600', color: C.cream },
  tileSub:        { fontSize: 11, color: C.textDim, marginTop: 4, lineHeight: 16 },

  // Wallet
  walletStrip:    { marginHorizontal: 20, marginTop: 12, backgroundColor: C.dark3, borderWidth: 1,
                    borderColor: C.dark4, borderRadius: 16, padding: 14, flexDirection: 'row',
                    alignItems: 'center', gap: 16 },
  walletLeft:     { flexShrink: 0 },
  walletLabel:    { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, color: C.textDim, marginBottom: 3 },
  walletVal:      { fontSize: 18, fontWeight: '700', color: C.cream },
  walletValSub:   { fontSize: 11, fontWeight: '400', color: C.textDim },
  walletRight:    { flex: 1 },
  walletBar:      { height: 6, backgroundColor: C.dark4, borderRadius: 3, overflow: 'hidden', marginBottom: 5 },
  walletBarFill:  { height: '100%', borderRadius: 3 },
  walletBarSub:   { fontSize: 11, color: C.textDim, textAlign: 'right' },

  // Purchase cards
  purchaseCard:   { marginHorizontal: 20, marginBottom: 10, backgroundColor: C.dark3, borderWidth: 1,
                    borderColor: C.dark4, borderRadius: 18, padding: 15, flexDirection: 'row',
                    alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden' },
  purchaseCardAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderRadius: 2 },
  pcLeft:         { flexDirection: 'row', alignItems: 'center', gap: 13, flex: 1 },
  pcIconWrap:     { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pcIcon:         { fontSize: 20 },
  pcTitle:        { fontSize: 14, fontWeight: '600', color: C.cream },
  pcDesc:         { fontSize: 11, color: C.textDim, marginTop: 3 },
  pcArrow:        { fontSize: 22, color: C.textDim, paddingLeft: 8 },
  pcBadge:        { backgroundColor: `${C.gold}24`, borderWidth: 1, borderColor: `${C.gold}4D`,
                    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8 },
  pcBadgeText:    { fontSize: 10, fontWeight: '700', color: C.gold, letterSpacing: 0.3, textTransform: 'uppercase' },
});
