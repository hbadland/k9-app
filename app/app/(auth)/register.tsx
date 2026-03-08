import { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
         Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useColors } from '../../lib/useColors';
import { F } from '../../lib/theme';

export default function Register() {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [busy, setBusy]           = useState(false);
  const register = useAuthStore((s) => s.register);

  const submit = async () => {
    if (!email || !password) return;
    setBusy(true);
    try { await register(email.trim(), password, firstName, lastName); }
    catch (e: any) { Alert.alert('Registration failed', e?.response?.data?.error ?? 'Please try again.'); }
    finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.inner} keyboardShouldPersistTaps="handled">
        <View style={s.brand}>
          <Text style={s.brandName}>Battersea <Text style={s.brandAccent}>K9</Text></Text>
          <Text style={s.brandTag}>Create your account</Text>
        </View>

        <View style={s.form}>
          <View style={s.row}>
            <TextInput style={[s.input, { flex: 1 }]} placeholder="First name" placeholderTextColor={C.muted}
              value={firstName} onChangeText={setFirstName} />
            <TextInput style={[s.input, { flex: 1 }]} placeholder="Last name" placeholderTextColor={C.muted}
              value={lastName} onChangeText={setLastName} />
          </View>
          <TextInput style={s.input} placeholder="Email address" placeholderTextColor={C.muted}
            value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <TextInput style={s.input} placeholder="Password (min 8 characters)" placeholderTextColor={C.muted}
            value={password} onChangeText={setPassword} secureTextEntry />
          <TouchableOpacity style={[s.btn, busy && s.btnDim]} onPress={submit} disabled={busy}>
            {busy ? <ActivityIndicator color={C.dark} /> : <Text style={s.btnText}>Create account</Text>}
          </TouchableOpacity>
        </View>

        <Text style={s.legal}>
          By creating an account you agree to our{' '}
          <Text style={s.legalLink} onPress={() => router.push('/(auth)/terms')}>Terms of Service</Text>
          {' '}and{' '}
          <Text style={s.legalLink} onPress={() => router.push('/(auth)/privacy')}>Privacy Policy</Text>
        </Text>

        <Link href="/(auth)/login">
          <Text style={s.footerText}>Already have an account? <Text style={s.footerLink}>Sign in</Text></Text>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root:        { flex: 1, backgroundColor: C.dark },
    inner:       { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 60 },
    brand:       { alignItems: 'center', marginBottom: 40 },
    brandName:   { fontFamily: F.serif, fontSize: 36, fontWeight: '700', color: C.cream, letterSpacing: -0.5 },
    brandAccent: { color: C.gold, fontStyle: 'italic' },
    brandTag:    { fontSize: 13, color: C.muted, marginTop: 6 },
    form:        { marginBottom: 20 },
    row:         { flexDirection: 'row', gap: 10 },
    input:       { backgroundColor: C.dark3, color: C.cream, borderRadius: 14, paddingHorizontal: 18,
                   paddingVertical: 16, marginBottom: 10, fontSize: 15, borderWidth: 1, borderColor: C.border },
    btn:         { backgroundColor: C.gold, borderRadius: 14, padding: 17, alignItems: 'center', marginTop: 4 },
    btnDim:      { opacity: 0.7 },
    btnText:     { color: C.dark, fontWeight: '700', fontSize: 15 },
    legal:       { fontSize: 12, color: C.muted, textAlign: 'center', lineHeight: 18, marginBottom: 20 },
    legalLink:   { color: C.gold },
    footerText:  { fontSize: 13, color: C.muted, textAlign: 'center' },
    footerLink:  { color: C.gold },
  });
}
