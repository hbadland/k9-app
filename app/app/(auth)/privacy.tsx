import { useMemo } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../../lib/useColors';
import { F } from '../../lib/theme';

export default function Privacy() {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={s.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Privacy Policy</Text>
        <View style={{ width: 52 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.updated}>Last updated: March 2026</Text>

        <Section C={C} title="What we collect">
          We collect your name, email address, phone number, home address, and information about your dog(s). We also collect GPS location data during active walks, and payment information processed securely via Stripe.
        </Section>

        <Section C={C} title="How we use your data">
          Your data is used solely to provide and improve the Battersea K9 service — scheduling walks, processing payments, sending notifications, and ensuring your dog's safety.
        </Section>

        <Section C={C} title="GPS & Location">
          Live GPS tracking is only active during booked walk sessions. Location data is stored to provide walk reports and history. We do not sell or share location data with third parties.
        </Section>

        <Section C={C} title="Push Notifications">
          We send push notifications for walk updates, booking confirmations, and payment receipts. You can disable these in your device settings at any time.
        </Section>

        <Section C={C} title="Data sharing">
          We do not sell your data. We share data only with service providers necessary to operate the app (Stripe for payments, Resend for email, Railway for hosting). All providers are GDPR-compliant.
        </Section>

        <Section C={C} title="Your rights">
          You have the right to access, export, or delete your personal data at any time. Use the "Export my data" and "Delete my account" options in the Profile tab, or email privacy@batterseak9.com.
        </Section>

        <Section C={C} title="Retention">
          We retain your data for as long as your account is active. After deletion, data is purged within 30 days except where required by law (e.g. payment records for 7 years).
        </Section>

        <Section C={C} title="Contact">
          Data Controller: Battersea K9 Ltd · privacy@batterseak9.com
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function Section({ C, title, children }: { C: ReturnType<typeof useColors>; title: string; children: string }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: C.cream, marginBottom: 6 }}>{title}</Text>
      <Text style={{ fontSize: 13, color: C.muted, lineHeight: 22 }}>{children}</Text>
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root:    { flex: 1, backgroundColor: C.dark },
    header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
               paddingHorizontal: 20, paddingBottom: 14, paddingTop: 12,
               borderBottomWidth: 1, borderBottomColor: C.border },
    back:    { fontSize: 17, color: C.gold, width: 52 },
    title:   { fontSize: 16, fontWeight: '700', color: C.cream, fontFamily: F.serif },
    content: { paddingHorizontal: 24, paddingTop: 24 },
    updated: { fontSize: 11, color: C.muted, marginBottom: 24 },
  });
}
