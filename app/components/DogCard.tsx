import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useColors } from '../lib/useColors';
import { F } from '../lib/theme';

interface Dog {
  id: string; name: string; breed: string | null; age_months: number | null;
  behavioural_notes: string | null; avatar_url: string | null;
}
interface Props { dog: Dog; onPress: () => void; }

export default function DogCard({ dog, onPress }: Props) {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);

  const ageStr = dog.age_months
    ? dog.age_months < 12
      ? `${dog.age_months}mo`
      : `${Math.floor(dog.age_months / 12)}yr${Math.floor(dog.age_months / 12) > 1 ? 's' : ''}`
    : null;

  const subtitle = [dog.breed, ageStr].filter(Boolean).join(' · ') || null;

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.72}>
      {dog.avatar_url ? (
        <Image source={{ uri: dog.avatar_url }} style={s.photo} />
      ) : (
        <View style={s.photoFallback}>
          <Text style={s.initial}>{dog.name[0].toUpperCase()}</Text>
        </View>
      )}
      <View style={s.info}>
        <Text style={s.name}>{dog.name}</Text>
        {subtitle ? <Text style={s.sub}>{subtitle}</Text> : null}
        {dog.behavioural_notes
          ? <Text style={s.note} numberOfLines={1}>{dog.behavioural_notes}</Text>
          : null}
      </View>
      <Text style={s.chevron}>›</Text>
    </TouchableOpacity>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    card:          { flexDirection: 'row', alignItems: 'center', gap: 14,
                     backgroundColor: C.dark3, borderRadius: 18, padding: 14,
                     marginBottom: 10, borderWidth: 1, borderColor: C.border },
    photo:         { width: 60, height: 60, borderRadius: 30, flexShrink: 0 },
    photoFallback: { width: 60, height: 60, borderRadius: 30, backgroundColor: C.dark4,
                     alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                     borderWidth: 1, borderColor: C.goldBorder },
    initial:       { fontSize: 22, fontWeight: '700', color: C.gold, fontFamily: F.serif },
    info:          { flex: 1 },
    name:          { fontSize: 16, fontWeight: '600', color: C.cream, marginBottom: 2 },
    sub:           { fontSize: 12, color: C.textDim },
    note:          { fontSize: 11, color: C.muted, marginTop: 4, fontStyle: 'italic' },
    chevron:       { fontSize: 20, color: C.muted, paddingLeft: 4 },
  });
}
