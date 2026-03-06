import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, F } from '../lib/theme';

interface Dog {
  id: string; name: string; breed: string | null; age_months: number | null;
  behavioural_notes: string | null; avatar_url: string | null;
}
interface Props { dog: Dog; onPress: () => void; }

export default function DogCard({ dog, onPress }: Props) {
  const ageStr = dog.age_months
    ? dog.age_months < 12
      ? `${dog.age_months}mo`
      : `${Math.floor(dog.age_months / 12)}yr`
    : null;

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.75}>
      <LinearGradient colors={[C.gold, 'transparent']} style={s.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
      <View style={s.row}>
        {dog.avatar_url ? (
          <Image source={{ uri: dog.avatar_url }} style={s.avatarImg} />
        ) : (
          <View style={s.avatar}>
            <Text style={s.avatarText}>{dog.name[0].toUpperCase()}</Text>
          </View>
        )}
        <View style={s.info}>
          <Text style={s.name}>{dog.name}</Text>
          <Text style={s.detail}>
            {[dog.breed, ageStr].filter(Boolean).join(' · ') || 'No details yet'}
          </Text>
          {dog.behavioural_notes ? (
            <Text style={s.notes} numberOfLines={1}>{dog.behavioural_notes}</Text>
          ) : null}
        </View>
        <Text style={s.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card:       { backgroundColor: C.dark3, borderWidth: 1, borderColor: C.dark4,
                borderRadius: 22, marginBottom: 10, overflow: 'hidden' },
  accent:     { position: 'absolute', top: 0, left: 0, right: 0, height: 2 },
  row:        { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 14 },
  avatar:    { width: 52, height: 52, borderRadius: 26, backgroundColor: C.dark4,
               borderWidth: 2, borderColor: `${C.gold}59`,
               alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarImg: { width: 52, height: 52, borderRadius: 26,
               borderWidth: 2, borderColor: `${C.gold}59`, flexShrink: 0 },
  avatarText:{ color: C.gold, fontWeight: '700', fontSize: 20, fontFamily: F.serif },
  info:      { flex: 1 },
  name:      { color: C.cream, fontWeight: '600', fontSize: 16, marginBottom: 2 },
  detail:    { color: C.textDim, fontSize: 12 },
  notes:     { color: C.muted, fontSize: 11, marginTop: 4, fontStyle: 'italic' },
  chevron:   { color: C.textDim, fontSize: 22, paddingLeft: 4 },
});
