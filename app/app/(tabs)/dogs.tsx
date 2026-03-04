import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Modal,
         StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { C, F } from '../../lib/theme';
import DogCard from '../../components/DogCard';

interface Dog {
  id: string; name: string; breed: string | null; age_months: number | null;
  notes: string | null; vet_name: string | null; vet_phone: string | null;
  medical_notes: string | null; behavioural_notes: string | null;
}

export default function Dogs() {
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

  useEffect(() => { fetchDogs(); }, [fetchDogs]);

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

  const deleteDog = (id: string) =>
    Alert.alert('Remove dog', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await api.delete(`/dogs/${id}`); fetchDogs(); } },
    ]);

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>My Dogs</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setModal(true)}>
          <Text style={s.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {loading
        ? <ActivityIndicator color={C.gold} style={{ marginTop: 60 }} />
        : (
          <FlatList
            data={dogs}
            keyExtractor={(d) => d.id}
            renderItem={({ item }) => <DogCard dog={item} onDelete={() => deleteDog(item.id)} />}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={s.emptyWrap}>
                <Text style={s.emptyIcon}>🐾</Text>
                <Text style={s.emptyTitle}>No dogs yet</Text>
                <Text style={s.emptySub}>Tap + Add to register your dog</Text>
              </View>
            }
          />
        )
      }

      {/* Add dog modal */}
      <Modal visible={modal} animationType="slide" transparent>
        <View style={s.backdrop}>
          <View style={s.sheet}>
            {/* Handle */}
            <View style={s.handle} />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={s.sheetTitle}>Add a dog</Text>

              <Field label="Name *" value={name} onChange={setName} />
              <Field label="Breed" value={breed} onChange={setBreed} />
              <Field label="Age (months)" value={ageMonths} onChange={setAgeMonths} numeric />

              <SectionLabel label="Vet details" />
              <Field label="Vet name" value={vetName} onChange={setVetName} />
              <Field label="Vet phone" value={vetPhone} onChange={setVetPhone} phone />

              <SectionLabel label="Notes" />
              <Field label="Medical notes" value={medNotes} onChange={setMedNotes} multiline />
              <Field label="Behavioural notes" value={behNotes} onChange={setBehNotes} multiline />

              <TouchableOpacity style={s.saveBtn} onPress={addDog} disabled={saving}>
                <LinearGradient colors={[C.gold, C.goldLight]} style={s.saveBtnGrad}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  {saving
                    ? <ActivityIndicator color={C.dark} />
                    : <Text style={s.saveBtnText}>Save dog</Text>
                  }
                </LinearGradient>
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

function SectionLabel({ label }: { label: string }) {
  return <Text style={sl.label}>{label}</Text>;
}
const sl = StyleSheet.create({
  label: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.8, color: C.gold,
           marginTop: 16, marginBottom: 8, opacity: 0.8 },
});

function Field({ label, value, onChange, numeric, phone, multiline }: {
  label: string; value: string; onChange: (v: string) => void;
  numeric?: boolean; phone?: boolean; multiline?: boolean;
}) {
  return (
    <TextInput
      style={[fi.input, multiline && { height: 72, textAlignVertical: 'top' }]}
      placeholder={label} placeholderTextColor={C.muted}
      value={value} onChangeText={onChange}
      keyboardType={numeric ? 'numeric' : phone ? 'phone-pad' : 'default'}
      multiline={multiline}
    />
  );
}
const fi = StyleSheet.create({
  input: { backgroundColor: C.dark2, color: C.cream, borderRadius: 14, padding: 14,
           marginBottom: 8, fontSize: 14, borderWidth: 1, borderColor: C.dark4 },
});

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.dark, paddingHorizontal: 20, paddingTop: 68 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title:       { fontSize: 24, fontWeight: '700', color: C.cream, fontFamily: F.serif },
  addBtn:      { backgroundColor: C.gold, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 9 },
  addBtnText:  { color: C.dark, fontWeight: '700', fontSize: 13 },
  listContent: { paddingBottom: 100 },
  emptyWrap:   { alignItems: 'center', marginTop: 80 },
  emptyIcon:   { fontSize: 48, marginBottom: 16 },
  emptyTitle:  { fontSize: 18, fontWeight: '600', color: C.cream, marginBottom: 6 },
  emptySub:    { fontSize: 13, color: C.muted },

  backdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: C.dark2, borderTopLeftRadius: 28, borderTopRightRadius: 28,
                 borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
                 padding: 14, paddingHorizontal: 22, maxHeight: '90%' },
  handle:      { width: 36, height: 4, backgroundColor: C.dark4, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  sheetTitle:  { fontSize: 20, fontWeight: '700', color: C.cream, marginBottom: 16, fontFamily: F.serif },
  saveBtn:     { borderRadius: 16, overflow: 'hidden', marginTop: 12 },
  saveBtnGrad: { padding: 16, alignItems: 'center' },
  saveBtnText: { color: C.dark, fontWeight: '700', fontSize: 15 },
  cancelBtn:   { padding: 14, alignItems: 'center' },
  cancelText:  { color: C.textDim, fontSize: 14 },
});
