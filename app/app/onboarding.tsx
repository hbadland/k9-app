import { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
         ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useColors } from '../lib/useColors';
import { F } from '../lib/theme';

type Step = 'profile' | 'dog';

export default function Onboarding() {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);

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

            <SLabel C={C} label="Name" />
            <Input C={C} placeholder="First name" value={firstName} onChange={setFirstName} />
            <Input C={C} placeholder="Last name"  value={lastName}  onChange={setLastName} />
            <SLabel C={C} label="Contact" />
            <Input C={C} placeholder="Phone number"  value={phone}   onChange={setPhone}   phone />
            <Input C={C} placeholder="Home address"  value={address} onChange={setAddress} multiline />

            <TouchableOpacity style={[s.btn, busy && { opacity: 0.7 }]} onPress={saveProfile} disabled={busy}>
              {busy ? <ActivityIndicator color={C.dark} /> : <Text style={s.btnText}>Continue →</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.title}>Tell us about{'\n'}your dog</Text>
            <Text style={s.sub}>You can add more dogs later</Text>

            <SLabel C={C} label="About" />
            <Input C={C} placeholder="Dog's name *" value={dogName}   onChange={setDogName} />
            <Input C={C} placeholder="Breed"        value={breed}     onChange={setBreed} />
            <Input C={C} placeholder="Age (months)" value={ageMonths} onChange={setAgeMonths} numeric />

            <SLabel C={C} label="Vet details" />
            <Input C={C} placeholder="Vet name"  value={vetName}  onChange={setVetName} />
            <Input C={C} placeholder="Vet phone" value={vetPhone} onChange={setVetPhone} phone />

            <SLabel C={C} label="Behavioural notes" />
            <Input
              C={C}
              placeholder="Anything we should know? e.g. reactive on lead, nervous around strangers"
              value={behNotes} onChange={setBehNotes} multiline
            />

            <TouchableOpacity style={[s.btn, busy && { opacity: 0.7 }]} onPress={finish} disabled={busy}>
              {busy ? <ActivityIndicator color={C.dark} /> : <Text style={s.btnText}>Finish setup</Text>}
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

function SLabel({ C, label }: { C: ReturnType<typeof useColors>; label: string }) {
  return (
    <Text style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.8, color: C.gold,
                   marginTop: 16, marginBottom: 8, opacity: 0.8 }}>
      {label}
    </Text>
  );
}

function Input({ C, placeholder, value, onChange, numeric, phone, multiline }: {
  C: ReturnType<typeof useColors>; placeholder: string; value: string;
  onChange: (v: string) => void; numeric?: boolean; phone?: boolean; multiline?: boolean;
}) {
  return (
    <TextInput
      style={[{
        backgroundColor: C.dark3, color: C.cream, borderRadius: 14, padding: 14,
        marginBottom: 8, fontSize: 14, borderWidth: 1, borderColor: C.border,
      }, multiline && { height: 88, textAlignVertical: 'top' }]}
      placeholder={placeholder} placeholderTextColor={C.muted}
      value={value} onChangeText={onChange}
      keyboardType={numeric ? 'numeric' : phone ? 'phone-pad' : 'default'}
      multiline={multiline}
    />
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root:    { flex: 1, backgroundColor: C.dark },
    content: { paddingHorizontal: 28, paddingTop: 72 },

    steps:    { flexDirection: 'row', alignItems: 'center', marginBottom: 36 },
    dot:      { width: 10, height: 10, borderRadius: 5, backgroundColor: C.dark4 },
    dotActive:{ backgroundColor: C.gold },
    dotLine:  { flex: 1, height: 1, backgroundColor: C.dark4, marginHorizontal: 8 },

    title:   { fontSize: 30, fontWeight: '700', color: C.cream, fontFamily: F.serif, lineHeight: 36, marginBottom: 6 },
    sub:     { color: C.muted, fontSize: 14, marginBottom: 24 },

    btn:     { backgroundColor: C.gold, borderRadius: 16, padding: 17, alignItems: 'center', marginTop: 16 },
    btnText: { color: C.dark, fontWeight: '700', fontSize: 15 },
    skipBtn: { padding: 14, alignItems: 'center' },
    skipText:{ color: C.muted, fontSize: 13 },
  });
}
