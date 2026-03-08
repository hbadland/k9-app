import { useMemo } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../../lib/useColors';
import { F } from '../../lib/theme';

export default function Terms() {
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
        <Text style={s.title}>Terms of Service</Text>
        <View style={{ width: 52 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.updated}>Last updated: March 2026</Text>

        <Section C={C} title="1. Service">
          Battersea K9 provides dog walking and related pet care services in London. By using our app you agree to these terms.
        </Section>

        <Section C={C} title="2. Bookings & Credits">
          Bookings are made using credits purchased through the app. One credit equals one service session. Credits are non-transferable and have no cash value unless otherwise stated.
        </Section>

        <Section C={C} title="3. Cancellations & Refunds">
          Cancellations made more than 24 hours before a scheduled walk will receive a full credit refund. Cancellations within 24 hours are non-refundable.
        </Section>

        <Section C={C} title="4. Your Responsibilities">
          You are responsible for ensuring your dog is healthy, vaccinated, and suitable for group walks. Please keep your dog's profile information accurate and up to date.
        </Section>

        <Section C={C} title="5. Liability">
          Battersea K9 takes every precaution to keep your dog safe. In the unlikely event of an incident, our liability is limited to the value of the booking credit.
        </Section>

        <Section C={C} title="6. Data & Privacy">
          We collect and process personal data as described in our Privacy Policy. By using the app you consent to this processing.
        </Section>

        <Section C={C} title="7. Changes">
          We may update these terms from time to time. Continued use of the service after changes constitutes acceptance.
        </Section>

        <Section C={C} title="8. Contact">
          Questions? Email us at hello@batterseak9.com
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
