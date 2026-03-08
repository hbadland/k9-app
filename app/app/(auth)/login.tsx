import { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet,
         ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Link } from 'expo-router';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useAuthStore } from '../../store/authStore';
import { useColors } from '../../lib/useColors';
import { F } from '../../lib/theme';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

export default function Login() {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy]         = useState(false);
  const login           = useAuthStore((s) => s.login);
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);

  const [, , promptGoogleAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
  });

  const submit = async () => {
    if (!email || !password) return;
    setBusy(true);
    try { await login(email.trim(), password); }
    catch (e: any) { Alert.alert('Sign in failed', e?.response?.data?.error ?? 'Please try again.'); }
    finally { setBusy(false); }
  };

  const handleGoogle = async () => {
    setBusy(true);
    try {
      const result = await promptGoogleAsync();
      if (result.type !== 'success') return;
      const idToken = result.authentication?.idToken;
      if (!idToken) throw new Error('No ID token from Google');
      await loginWithGoogle(idToken);
    } catch (e: any) {
      Alert.alert('Google sign-in failed', e?.response?.data?.error ?? e?.message ?? 'Please try again.');
    } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.inner}>
        <View style={s.brand}>
          <Text style={s.brandName}>Battersea <Text style={s.brandAccent}>K9</Text></Text>
          <Text style={s.brandTag}>Premium dog walking, London</Text>
        </View>

        <View style={s.form}>
          <TextInput style={s.input} placeholder="Email address" placeholderTextColor={C.muted}
            value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <TextInput style={s.input} placeholder="Password" placeholderTextColor={C.muted}
            value={password} onChangeText={setPassword} secureTextEntry />
          <TouchableOpacity style={[s.btn, busy && s.btnDim]} onPress={submit} disabled={busy}>
            {busy ? <ActivityIndicator color={C.dark} /> : <Text style={s.btnText}>Sign in</Text>}
          </TouchableOpacity>
        </View>

        <View style={s.dividerRow}>
          <View style={s.dividerLine} /><Text style={s.dividerText}>or</Text><View style={s.dividerLine} />
        </View>

        <TouchableOpacity style={s.socialBtn} onPress={handleGoogle} disabled={busy}>
          <Text style={s.socialG}>G</Text>
          <Text style={s.socialText}>Continue with Google</Text>
        </TouchableOpacity>

        <View style={s.footer}>
          <Link href="/(auth)/forgot-password">
            <Text style={s.footerLink}>Forgot password?</Text>
          </Link>
          <Link href="/(auth)/register">
            <Text style={s.footerText}>No account? <Text style={s.footerLink}>Register</Text></Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root:        { flex: 1, backgroundColor: C.dark },
    inner:       { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
    brand:       { alignItems: 'center', marginBottom: 48 },
    brandName:   { fontFamily: F.serif, fontSize: 36, fontWeight: '700', color: C.cream, letterSpacing: -0.5 },
    brandAccent: { color: C.gold, fontStyle: 'italic' },
    brandTag:    { fontSize: 13, color: C.muted, marginTop: 6 },
    form:        { marginBottom: 24 },
    input:       { backgroundColor: C.dark3, color: C.cream, borderRadius: 14, paddingHorizontal: 18,
                   paddingVertical: 16, marginBottom: 10, fontSize: 15, borderWidth: 1, borderColor: C.border },
    btn:         { backgroundColor: C.gold, borderRadius: 14, padding: 17, alignItems: 'center', marginTop: 4 },
    btnDim:      { opacity: 0.7 },
    btnText:     { color: C.dark, fontWeight: '700', fontSize: 15 },
    dividerRow:  { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 12 },
    dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
    dividerText: { color: C.muted, fontSize: 12 },
    socialBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                   backgroundColor: C.dark3, borderRadius: 14, paddingVertical: 15,
                   marginBottom: 32, borderWidth: 1, borderColor: C.border, gap: 10 },
    socialG:     { fontSize: 16, fontWeight: '700', color: '#4285F4' },
    socialText:  { color: C.cream, fontSize: 15, fontWeight: '500' },
    footer:      { gap: 14, alignItems: 'center' },
    footerText:  { fontSize: 13, color: C.muted },
    footerLink:  { fontSize: 13, color: C.gold },
  });
}
