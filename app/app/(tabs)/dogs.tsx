import { useMemo, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Modal,
         StyleSheet, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { api } from '../../lib/api';
import { useColors } from '../../lib/useColors';
import { F } from '../../lib/theme';
import DogCard from '../../components/DogCard';

interface Dog {
  id: string; name: string; breed: string | null; age_months: number | null;
  notes: string | null; vet_name: string | null; vet_phone: string | null;
  medical_notes: string | null; behavioural_notes: string | null;
  avatar_url: string | null;
}

export default function Dogs() {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);

  const router                  = useRouter();
  const [dogs, setDogs]         = useState<Dog[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [saving, setSaving]     = useState(false);

  const [name, setName]           = useState('');
  const [breed, setBreed]         = useState('');
  const [ageMonths, setAgeMonths] = useState('');
  const [vetName, setVetName]     = useState('');
  const [vetPhone, setVetPhone]   = useState('');
  const [medNotes, setMedNotes]   = useState('');
  const [behNotes, setBehNotes]   = useState('');

  const reset = () => {
    setName(''); setBreed(''); setAgeMonths('');
    setVetName(''); setVetPhone(''); setMedNotes(''); setBehNotes('');
  };

  const fetchDogs = useCallback(async () => {
    try { const { data } = await api.get('/dogs'); setDogs(data); }
    catch { Alert.alert('Error', 'Could not load dogs.'); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { fetchDogs(); }, [fetchDogs]));

  const addDog = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.post('/dogs', {
        name: name.trim(), breed: breed.trim() || undefined,
        age_months: ageMonths ? parseInt(ageMonths) : undefined,
        vet_name: vetName.trim() || undefined, vet_phone: vetPhone.trim() || undefined,
        medical_notes: medNotes.trim() || undefined, behavioural_notes: behNotes.trim() || undefined,
      });
      setModal(false); reset(); fetchDogs();
    } catch { Alert.alert('Error', 'Could not add dog.'); }
    finally { setSaving(false); }
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>My Dogs</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setModal(true)}>
          <Text style={s.addBtnText}>Add dog</Text>
        </TouchableOpacity>
      </View>

      {loading
        ? <ActivityIndicator color={C.gold} style={{ marginTop: 60 }} />
        : (
          <FlatList
            data={dogs}
            keyExtractor={(d) => d.id}
            renderItem={({ item }) => (
              <DogCard
                dog={item}
                onPress={() => router.push({ pathname: '/dog/[id]', params: { id: item.id } })}
              />
            )}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={s.emptyWrap}>
                <Text style={s.emptyTitle}>No dogs registered</Text>
                <Text style={s.emptySub}>Tap "Add dog" to register your first dog</Text>
              </View>
            }
          />
        )
      }

      <Modal visible={modal} animationType="slide" transparent>
        <View style={s.backdrop}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={s.sheetTitle}>Add a dog</Text>

              <Field C={C} label="Name *"           value={name}     onChange={setName} />
              <Field C={C} label="Breed"            value={breed}    onChange={setBreed} />
              <Field C={C} label="Age (months)"     value={ageMonths} onChange={setAgeMonths} numeric />

              <Text style={s.sheetSection}>Vet details</Text>
              <Field C={C} label="Vet name"         value={vetName}  onChange={setVetName} />
              <Field C={C} label="Vet phone"        value={vetPhone} onChange={setVetPhone} phone />

              <Text style={s.sheetSection}>Notes</Text>
              <Field C={C} label="Medical notes"    value={medNotes} onChange={setMedNotes} multiline />
              <Field C={C} label="Behavioural notes" value={behNotes} onChange={setBehNotes} multiline />

              <TouchableOpacity
                style={[s.saveBtn, saving && { opacity: 0.7 }]}
                onPress={addDog} disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color={C.dark} />
                  : <Text style={s.saveBtnText}>Save dog</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={() => { setModal(false); reset(); }}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Field({ C, label, value, onChange, numeric, phone, multiline }: {
  C: ReturnType<typeof useColors>; label: string; value: string;
  onChange: (v: string) => void; numeric?: boolean; phone?: boolean; multiline?: boolean;
}) {
  return (
    <TextInput
      style={[{
        backgroundColor: C.dark4, color: C.cream, borderRadius: 12, padding: 14,
        marginBottom: 8, fontSize: 14, borderWidth: 1, borderColor: C.border,
      }, multiline && { height: 72, textAlignVertical: 'top' }]}
      placeholder={label} placeholderTextColor={C.muted}
      value={value} onChangeText={onChange}
      keyboardType={numeric ? 'numeric' : phone ? 'phone-pad' : 'default'}
      multiline={multiline}
    />
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container:   { flex: 1, backgroundColor: C.dark, paddingHorizontal: 20, paddingTop: 68 },
    header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    title:       { fontSize: 24, fontWeight: '700', color: C.cream, fontFamily: F.serif },
    addBtn:      { backgroundColor: C.gold, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 9 },
    addBtnText:  { color: C.dark, fontWeight: '700', fontSize: 13 },
    listContent: { paddingBottom: 100 },

    emptyWrap:   { alignItems: 'center', marginTop: 80 },
    emptyTitle:  { fontSize: 16, fontWeight: '600', color: C.textDim, marginBottom: 6 },
    emptySub:    { fontSize: 13, color: C.muted },

    backdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
    sheet:       { backgroundColor: C.dark2, borderTopLeftRadius: 28, borderTopRightRadius: 28,
                   borderTopWidth: 1, borderTopColor: C.border,
                   padding: 14, paddingHorizontal: 22, maxHeight: '90%' },
    handle:      { width: 36, height: 4, backgroundColor: C.dark4, borderRadius: 2,
                   alignSelf: 'center', marginBottom: 18 },
    sheetTitle:  { fontSize: 20, fontWeight: '700', color: C.cream, marginBottom: 16, fontFamily: F.serif },
    sheetSection:{ fontSize: 11, fontWeight: '600', color: C.muted, textTransform: 'uppercase',
                   letterSpacing: 0.8, marginTop: 16, marginBottom: 8 },
    saveBtn:     { backgroundColor: C.gold, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 12 },
    saveBtnText: { color: C.dark, fontWeight: '700', fontSize: 15 },
    cancelBtn:   { padding: 14, alignItems: 'center' },
    cancelText:  { color: C.muted, fontSize: 14 },
  });
}
