import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { api } from '../../lib/api';
import { useColors } from '../../lib/useColors';
import { F } from '../../lib/theme';

interface Dog {
  id: string; name: string; breed: string | null; age_months: number | null;
  notes: string | null; vet_name: string | null; vet_phone: string | null;
  medical_notes: string | null; behavioural_notes: string | null;
  avatar_url: string | null;
}

export default function DogProfile() {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);

  const { id }  = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();

  const [dog,     setDog]     = useState<Dog | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [name,      setName]      = useState('');
  const [breed,     setBreed]     = useState('');
  const [ageMonths, setAgeMonths] = useState('');
  const [vetName,   setVetName]   = useState('');
  const [vetPhone,  setVetPhone]  = useState('');
  const [medNotes,  setMedNotes]  = useState('');
  const [behNotes,  setBehNotes]  = useState('');
  const [avatar,    setAvatar]    = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<Dog[]>('/dogs');
      const found = data.find(d => d.id === id);
      if (!found) { router.back(); return; }
      setDog(found);
      setName(found.name);
      setBreed(found.breed ?? '');
      setAgeMonths(found.age_months ? String(found.age_months) : '');
      setVetName(found.vet_name ?? '');
      setVetPhone(found.vet_phone ?? '');
      setMedNotes(found.medical_notes ?? '');
      setBehNotes(found.behavioural_notes ?? '');
      setAvatar(found.avatar_url ?? null);
    } catch {
      Alert.alert('Error', 'Could not load dog profile.');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to add a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const manipulated = await ImageManipulator.manipulateAsync(
      result.assets[0].uri,
      [{ resize: { width: 400, height: 400 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    setAvatar(`data:image/jpeg;base64,${manipulated.base64}`);
  };

  const save = async () => {
    if (!name.trim()) { Alert.alert('Validation', 'Name is required.'); return; }
    setSaving(true);
    try {
      await api.put(`/dogs/${id}`, {
        name: name.trim(),
        breed: breed.trim() || undefined,
        age_months: ageMonths ? parseInt(ageMonths) : undefined,
        vet_name: vetName.trim() || undefined,
        vet_phone: vetPhone.trim() || undefined,
        medical_notes: medNotes.trim() || undefined,
        behavioural_notes: behNotes.trim() || undefined,
        avatar_url: avatar ?? undefined,
      });
      router.back();
    } catch {
      Alert.alert('Error', 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      `Remove ${dog?.name}?`,
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: deleteDog },
      ]
    );
  };

  const deleteDog = async () => {
    setDeleting(true);
    try {
      await api.delete(`/dogs/${id}`);
      router.back();
    } catch {
      Alert.alert('Error', 'Could not delete dog.');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={C.gold} size="large" />
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={s.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>{dog?.name}</Text>
        <View style={{ width: 52 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar */}
        <View style={s.avatarWrap}>
          <TouchableOpacity onPress={pickPhoto} activeOpacity={0.8}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={s.avatarImg} />
            ) : (
              <View style={s.avatarPlaceholder}>
                <Text style={s.avatarInitial}>{dog?.name[0].toUpperCase()}</Text>
              </View>
            )}
            <View style={s.avatarBadge}>
              <Text style={s.avatarBadgeText}>+</Text>
            </View>
          </TouchableOpacity>
          <Text style={s.avatarHint}>Tap to change photo</Text>
        </View>

        {/* Basic info */}
        <SectionLabel C={C} label="Basic info" />
        <Field C={C} label="Name *"        value={name}      onChange={setName} />
        <Field C={C} label="Breed"         value={breed}     onChange={setBreed} />
        <Field C={C} label="Age (months)"  value={ageMonths} onChange={setAgeMonths} numeric />

        {/* Vet */}
        <SectionLabel C={C} label="Vet details" />
        <Field C={C} label="Vet name"  value={vetName}  onChange={setVetName} />
        <Field C={C} label="Vet phone" value={vetPhone} onChange={setVetPhone} phone />

        {/* Notes */}
        <SectionLabel C={C} label="Notes" />
        <Field C={C} label="Medical notes"      value={medNotes} onChange={setMedNotes} multiline />
        <Field C={C} label="Behavioural notes"  value={behNotes} onChange={setBehNotes} multiline />

        {/* Save */}
        <TouchableOpacity
          style={[s.saveBtn, saving && { opacity: 0.7 }]}
          onPress={save} disabled={saving}
        >
          {saving
            ? <ActivityIndicator color={C.dark} />
            : <Text style={s.saveBtnText}>Save changes</Text>
          }
        </TouchableOpacity>

        {/* Track */}
        <TouchableOpacity
          style={s.trackBtn}
          onPress={() => router.push({ pathname: '/(tabs)/tracking', params: { dogId: id, dogName: name } })}
        >
          <Text style={s.trackBtnText}>Track live location</Text>
        </TouchableOpacity>

        {/* Delete */}
        <TouchableOpacity style={s.deleteBtn} onPress={confirmDelete} disabled={deleting}>
          {deleting
            ? <ActivityIndicator color={C.red} />
            : <Text style={s.deleteBtnText}>Remove dog</Text>
          }
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function SectionLabel({ C, label }: { C: ReturnType<typeof useColors>; label: string }) {
  return (
    <Text style={{
      fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.8, color: C.gold,
      marginTop: 20, marginBottom: 8, opacity: 0.8,
    }}>
      {label}
    </Text>
  );
}

function Field({ C, label, value, onChange, numeric, phone, multiline }: {
  C: ReturnType<typeof useColors>; label: string; value: string;
  onChange: (v: string) => void; numeric?: boolean; phone?: boolean; multiline?: boolean;
}) {
  return (
    <TextInput
      style={[{
        backgroundColor: C.dark2, color: C.cream, borderRadius: 14, padding: 14,
        marginBottom: 8, fontSize: 14, borderWidth: 1, borderColor: C.dark4,
      }, multiline && { height: 80, textAlignVertical: 'top' }]}
      placeholder={label} placeholderTextColor={C.muted}
      value={value} onChangeText={onChange}
      keyboardType={numeric ? 'numeric' : phone ? 'phone-pad' : 'default'}
      multiline={multiline}
    />
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root:    { flex: 1, backgroundColor: C.dark },
    center:  { flex: 1, backgroundColor: C.dark, alignItems: 'center', justifyContent: 'center' },

    header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
               paddingTop: 64, paddingHorizontal: 20, paddingBottom: 16 },
    back:    { fontSize: 17, color: C.gold, width: 52 },
    title:   { fontSize: 18, fontWeight: '700', color: C.cream, fontFamily: F.serif },

    content: { paddingHorizontal: 20, paddingBottom: 20 },

    avatarWrap:        { alignItems: 'center', marginVertical: 20 },
    avatarImg:         { width: 110, height: 110, borderRadius: 55,
                         borderWidth: 3, borderColor: C.goldBorder },
    avatarPlaceholder: { width: 110, height: 110, borderRadius: 55, backgroundColor: C.dark3,
                         borderWidth: 3, borderColor: C.goldBorder,
                         alignItems: 'center', justifyContent: 'center' },
    avatarInitial:     { fontSize: 44, fontWeight: '700', color: C.gold, fontFamily: F.serif },
    avatarBadge:       { position: 'absolute', bottom: 4, right: 4,
                         backgroundColor: C.dark2, borderRadius: 14, padding: 6,
                         borderWidth: 1, borderColor: C.border,
                         width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
    avatarBadgeText:   { fontSize: 16, fontWeight: '700', color: C.gold, lineHeight: 18 },
    avatarHint:        { marginTop: 8, fontSize: 12, color: C.muted },

    saveBtn:     { backgroundColor: C.gold, borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 16 },
    saveBtnText: { color: C.dark, fontWeight: '700', fontSize: 15 },

    trackBtn:      { marginTop: 10, padding: 16, alignItems: 'center',
                     borderRadius: 16, borderWidth: 1, borderColor: C.goldBorder },
    trackBtnText:  { color: C.gold, fontSize: 14, fontWeight: '600' },

    deleteBtn:     { marginTop: 10, padding: 16, alignItems: 'center',
                     borderRadius: 16, borderWidth: 1, borderColor: C.redSoft },
    deleteBtnText: { color: C.red, fontSize: 14, fontWeight: '600' },
  });
}
