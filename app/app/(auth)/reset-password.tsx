import { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet,
         ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../lib/api';
import { useColors } from '../../lib/useColors';
import { F } from '../../lib/theme';

export default function ResetPassword() {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);

  const { token }               = useLocalSearchParams<{ token: string }>();
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [busy, setBusy]         = useState(false);
  const [done, setDone]         = useState(false);
  const router                  = useRouter();

  const submit = async () => {
    if (!password || !confirm) return;
    if (password.length < 8) {
      Alert.alert('Too short', 'Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }
    if (!token) {
      Alert.alert('Invalid link', 'This reset link appears to be invalid. Please request a new one.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'Invalid or expired link. Please request a new one.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.inner}>
        <Text style={s.title}>New password</Text>

        {done ? (
          <View style={s.doneCard}>
            <View style={s.doneIconWrap}>
              <Text style={s.doneIconText}>✓</Text>
            </View>
            <Text style={s.doneTitle}>Password updated!</Text>
            <Text style={s.doneSub}>Sign in with your new password.</Text>
            <TouchableOpacity style={s.btn} onPress={() => router.replace('/(auth)/login')}>
              <Text style={s.btnText}>Sign in</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.form}>
            <TextInput
              style={s.input}
              placeholder="New password (min 8 characters)"
              placeholderTextColor={C.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoFocus
            />
            <TextInput
              style={s.input}
              placeholder="Confirm new password"
              placeholderTextColor={C.muted}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
            />
            <TouchableOpacity
              style={[s.btn, busy && { opacity: 0.7 }]}
              onPress={submit} disabled={busy}
            >
              {busy
                ? <ActivityIndicator color={C.dark} />
                : <Text style={s.btnText}>Reset password</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root:    { flex: 1, backgroundColor: C.dark },
    inner:   { flex: 1, paddingHorizontal: 28, paddingTop: 80 },
    title:   { fontSize: 28, color: C.cream, fontFamily: F.serif, fontWeight: '700', marginBottom: 28 },
    form:    {},
    input:   { backgroundColor: C.dark3, color: C.cream, borderRadius: 14, padding: 16,
               marginBottom: 12, fontSize: 15, borderWidth: 1, borderColor: C.border },
    btn:     { backgroundColor: C.gold, borderRadius: 16, padding: 17, alignItems: 'center', marginTop: 8 },
    btnText: { color: C.dark, fontWeight: '700', fontSize: 15 },
    doneCard:    { backgroundColor: C.dark3, borderRadius: 22, padding: 28, borderWidth: 1,
                   borderColor: C.border, alignItems: 'center' },
    doneIconWrap:{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.greenSoft,
                   borderWidth: 1, borderColor: 'rgba(76,175,122,0.25)',
                   alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    doneIconText:{ fontSize: 24, fontWeight: '700', color: C.green },
    doneTitle:   { fontSize: 20, fontWeight: '700', color: C.cream, marginBottom: 8, textAlign: 'center' },
    doneSub:     { color: C.muted, fontSize: 14, textAlign: 'center', marginBottom: 28 },
  });
}
