import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
         ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { C, F } from '../lib/theme';

type Step = 'profile' | 'dog';

export default function Onboarding() {
  const router = useRouter();
  const { loadUser } = useAuthStore();
  const [step, setStep] = useState<Step>('profile');
  const [busy, setBusy] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [phone,     setPhone]     = useState('');
  const [address,   setAddress]   = useState('');

  const [dogName,   setDogName]   = useState('');
  const [breed,     setBreed]     = useState('');
  const [ageMonths, setAgeMonths] = useState('');
  const [vetName,   setVetName]   = useState('');
  const [vetPhone,  setVetPhone]  = useState('');
  const [behNotes,  setBehNotes]  = useState('');

  const saveProfile = async () => {
    setBusy(true);
    try {
      await api.put('/me', { first_name: firstName, last_name: lastName, phone, address });
      setStep('dog');
    } catch { Alert.alert('Error', 'Could not save profile.'); }
    finally { setBusy(false); }
  };

  const finish = async () => {
    if (dogName.trim()) {
      setBusy(true);
      try {
        await api.post('/dogs', {
          name: dogName.trim(), breed: breed.trim() || undefined,
          age_months: ageMonths ? parseInt(ageMonths) : undefined,
          vet_name: vetName.trim() || undefined, vet_phone: vetPhone.trim() || undefined,
          behavioural_notes: behNotes.trim() || undefined,
        });
      } catch { Alert.alert('Error', 'Could not save dog.'); setBusy(false); return; }
      finally { setBusy(false); }
    }
    await loadUser();
    router.replace('/(tabs)/home');
  };

  return (
    <View style={s.root}>
      <LinearGradient colors={['#1F1C14', C.dark]} style={s.topGrad}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* Step indicator */}
        <View style={s.steps}>
          <View style={[s.dot, s.dotActive]} />
          <View style={s.dotLine} />
          <View style={[s.dot, step === 'dog' && s.dotActive]} />
        </View>

        {step === 'profile' ? (
          <>
            <Text style={s.title}>Your profile</Text>
            <Text style={s.sub}>Help us personalise your experience</Text>

            <SLabel label="Name" />
            <Input placeholder="First name" value={firstName} onChange={setFirstName} />
            <Input placeholder="Last name"  value={lastName}  onChange={setLastName} />
            <SLabel label="Contact" />
            <Input placeholder="Phone number"  value={phone}   onChange={setPhone}   phone />
            <Input placeholder="Home address"  value={address} onChange={setAddress} multiline />

            <TouchableOpacity style={s.btn} onPress={saveProfile} disabled={busy}>
              <LinearGradient colors={[C.gold, C.goldLight]} style={s.btnGrad}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {busy ? <ActivityIndicator color={C.dark} /> : <Text style={s.btnText}>Continue →</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.title}>Tell us about{'\n'}your dog</Text>
            <Text style={s.sub}>You can add more dogs later</Text>

            <SLabel label="About" />
            <Input placeholder="Dog's name *" value={dogName}   onChange={setDogName} />
            <Input placeholder="Breed"        value={breed}     onChange={setBreed} />
            <Input placeholder="Age (months)" value={ageMonths} onChange={setAgeMonths} numeric />

            <SLabel label="Vet details" />
            <Input placeholder="Vet name"  value={vetName}  onChange={setVetName} />
            <Input placeholder="Vet phone" value={vetPhone} onChange={setVetPhone} phone />

            <SLabel label="Behavioural notes" />
            <Input
              placeholder="Anything we should know? e.g. reactive on lead, nervous around strangers"
              value={behNotes} onChange={setBehNotes} multiline
            />

            <TouchableOpacity style={s.btn} onPress={finish} disabled={busy}>
              <LinearGradient colors={[C.gold, C.goldLight]} style={s.btnGrad}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {busy ? <ActivityIndicator color={C.dark} /> : <Text style={s.btnText}>Finish setup</Text>}
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={s.skipBtn} onPress={finish}>
              <Text style={s.skipText}>Skip for now</Text>
            </TouchableOpacity>
          </>
        )}
        <View style={{ height: 48 }} />
      </ScrollView>
    </View>
  );
}

function SLabel({ label }: { label: string }) {
  return <Text style={sl.l}>{label}</Text>;
}
const sl = StyleSheet.create({
  l: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.8, color: C.gold,
       marginTop: 16, marginBottom: 8, opacity: 0.8 },
});

function Input({ placeholder, value, onChange, numeric, phone, multiline }: {
  placeholder: string; value: string; onChange: (v: string) => void;
  numeric?: boolean; phone?: boolean; multiline?: boolean;
}) {
  return (
    <TextInput
      style={[inp.i, multiline && { height: 88, textAlignVertical: 'top' }]}
      placeholder={placeholder} placeholderTextColor={C.muted}
      value={value} onChangeText={onChange}
      keyboardType={numeric ? 'numeric' : phone ? 'phone-pad' : 'default'}
      multiline={multiline}
    />
  );
}
const inp = StyleSheet.create({
  i: { backgroundColor: C.dark3, color: C.cream, borderRadius: 14, padding: 14,
       marginBottom: 8, fontSize: 14, borderWidth: 1, borderColor: C.dark4 },
});

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.dark },
  topGrad: { position: 'absolute', top: 0, left: 0, right: 0, height: 260 },
  content: { paddingHorizontal: 28, paddingTop: 72 },

  steps:   { flexDirection: 'row', alignItems: 'center', marginBottom: 36 },
  dot:     { width: 10, height: 10, borderRadius: 5, backgroundColor: C.dark4 },
  dotActive:{ backgroundColor: C.gold },
  dotLine: { flex: 1, height: 1, backgroundColor: C.dark4, marginHorizontal: 8 },

  title:   { fontSize: 30, fontWeight: '700', color: C.cream, fontFamily: F.serif, lineHeight: 36, marginBottom: 6 },
  sub:     { color: C.muted, fontSize: 14, marginBottom: 24 },

  btn:     { borderRadius: 16, overflow: 'hidden', marginTop: 16 },
  btnGrad: { padding: 17, alignItems: 'center' },
  btnText: { color: C.dark, fontWeight: '700', fontSize: 15 },
  skipBtn: { padding: 14, alignItems: 'center' },
  skipText:{ color: C.muted, fontSize: 13 },
});
