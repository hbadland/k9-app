import { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet,
         ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../../lib/api';
import { useColors } from '../../lib/useColors';
import { F } from '../../lib/theme';

export default function ForgotPassword() {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);

  const [email, setEmail] = useState('');
  const [busy, setBusy]   = useState(false);
  const [sent, setSent]   = useState(false);
  const router            = useRouter();

  const submit = async () => {
    if (!email.trim()) return;
    setBusy(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.inner}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backText}>‹ Back</Text>
        </TouchableOpacity>

        <Text style={s.title}>Reset password</Text>

        {sent ? (
          <View style={s.sentCard}>
            <View style={s.sentIconWrap}>
              <Text style={s.sentIconText}>@</Text>
            </View>
            <Text style={s.sentTitle}>Check your email</Text>
            <Text style={s.sentBody}>
              If an account exists for {email}, you'll receive a reset link shortly.
            </Text>
            <TouchableOpacity style={s.btn} onPress={() => router.back()}>
              <Text style={s.btnText}>Back to sign in</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={s.sub}>
              Enter your email address and we'll send you a link to reset your password.
            </Text>
            <View style={s.form}>
              <TextInput
                style={s.input}
                placeholder="Email address"
                placeholderTextColor={C.muted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoFocus
              />
              <TouchableOpacity
                style={[s.btn, (busy || !email.trim()) && { opacity: 0.6 }]}
                onPress={submit} disabled={busy || !email.trim()}
              >
                {busy
                  ? <ActivityIndicator color={C.dark} />
                  : <Text style={s.btnText}>Send reset link</Text>
                }
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root:    { flex: 1, backgroundColor: C.dark },
    inner:   { flex: 1, paddingHorizontal: 28, paddingTop: 60 },
    backBtn: { marginBottom: 32 },
    backText: { color: C.gold, fontSize: 16 },
    title:   { fontSize: 28, color: C.cream, fontFamily: F.serif, fontWeight: '700', marginBottom: 10 },
    sub:     { color: C.muted, fontSize: 14, lineHeight: 22, marginBottom: 28 },
    form:    {},
    input:   { backgroundColor: C.dark3, color: C.cream, borderRadius: 14, padding: 16,
               marginBottom: 14, fontSize: 15, borderWidth: 1, borderColor: C.border },
    btn:     { backgroundColor: C.gold, borderRadius: 16, padding: 17, alignItems: 'center' },
    btnText: { color: C.dark, fontWeight: '700', fontSize: 15 },
    sentCard:    { backgroundColor: C.dark3, borderRadius: 22, padding: 28, borderWidth: 1,
                   borderColor: C.border, alignItems: 'center' },
    sentIconWrap:{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.goldSoft,
                   borderWidth: 1, borderColor: C.goldBorder,
                   alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    sentIconText:{ fontSize: 22, fontWeight: '700', color: C.gold },
    sentTitle:   { fontSize: 20, fontWeight: '700', color: C.cream, marginBottom: 10, textAlign: 'center' },
    sentBody:    { color: C.muted, fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 28 },
  });
}
