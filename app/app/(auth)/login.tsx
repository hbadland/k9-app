import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet,
         ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useAuthStore } from '../../store/authStore';
import { C, F } from '../../lib/theme';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

export default function Login() {
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
    catch (e: any) { Alert.alert('Login failed', e?.response?.data?.error ?? 'Please try again.'); }
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
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={['#1F1C14', C.dark]} style={s.topGrad}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />

      <View style={s.inner}>
        <Text style={s.brand}>
          🐾 Battersea <Text style={s.brandAccent}>K9</Text>
        </Text>
        <Text style={s.sub}>Sign in to your account</Text>

        <View style={s.form}>
          <TextInput style={s.input} placeholder="Email" placeholderTextColor={C.muted}
            value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <TextInput style={s.input} placeholder="Password" placeholderTextColor={C.muted}
            value={password} onChangeText={setPassword} secureTextEntry />

          <TouchableOpacity style={s.btn} onPress={submit} disabled={busy}>
            <LinearGradient colors={[C.gold, C.goldLight]} style={s.btnGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              {busy
                ? <ActivityIndicator color={C.dark} />
                : <Text style={s.btnText}>Sign in</Text>
              }
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={s.dividerRow}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>or continue with</Text>
          <View style={s.dividerLine} />
        </View>

        <TouchableOpacity style={s.googleBtn} onPress={handleGoogle} disabled={busy}>
          <Text style={s.googleG}>G</Text>
          <Text style={s.googleText}>Sign in with Google</Text>
        </TouchableOpacity>

        <Link href="/(auth)/register" style={s.link}>
          Don't have an account? <Text style={s.linkAccent}>Register</Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.dark },
  topGrad:     { position: 'absolute', top: 0, left: 0, right: 0, height: 240 },
  inner:       { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  brand:       { fontSize: 34, color: C.cream, textAlign: 'center', marginBottom: 6, fontFamily: F.serif, fontWeight: '700' },
  brandAccent: { color: C.gold, fontStyle: 'italic', fontFamily: F.serif },
  sub:         { color: C.muted, textAlign: 'center', fontSize: 14, marginBottom: 36 },
  form:        { marginBottom: 20 },
  input:       { backgroundColor: C.dark3, color: C.cream, borderRadius: 14, padding: 16,
                 marginBottom: 10, fontSize: 15, borderWidth: 1, borderColor: C.dark4 },
  btn:         { borderRadius: 16, overflow: 'hidden', marginTop: 6 },
  btnGrad:     { padding: 17, alignItems: 'center' },
  btnText:     { color: C.dark, fontWeight: '700', fontSize: 15 },
  dividerRow:  { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.dark4 },
  dividerText: { color: C.muted, fontSize: 12, marginHorizontal: 10 },
  googleBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                 backgroundColor: C.dark3, borderRadius: 14, padding: 15, marginBottom: 20,
                 borderWidth: 1, borderColor: C.dark4 },
  googleG:     { fontSize: 17, fontWeight: '700', color: '#4285F4', marginRight: 8 },
  googleText:  { color: C.cream, fontSize: 15, fontWeight: '600' },
  link:        { color: C.muted, textAlign: 'center', fontSize: 13 },
  linkAccent:  { color: C.gold },
});
