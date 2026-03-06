import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
         ActivityIndicator, Alert, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { C, F } from '../../lib/theme';

interface WalletTransaction {
  id: string;
  type: 'topup' | 'usage' | 'refund' | 'subscription';
  amount: number;
  description: string;
  created_at: string;
}

interface WalletData {
  balance: number;
  transactions: WalletTransaction[];
}

export default function Profile() {
  const { user, logout, loadUser } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy]       = useState(false);
  const [wallet, setWallet]   = useState<WalletData | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [phone,     setPhone]     = useState('');
  const [address,   setAddress]   = useState('');

  useEffect(() => {
    api.get('/me').then(({ data }) => {
      setFirstName(data.first_name ?? '');
      setLastName(data.last_name   ?? '');
      setPhone(data.phone          ?? '');
      setAddress(data.address      ?? '');
    }).catch(() => {});
    api.get('/payments/wallet')
      .then(({ data }) => setWallet(data))
      .catch(() => {});
  }, []);

  const openPortal = async () => {
    setPortalBusy(true);
    try {
      const { data } = await api.post('/payments/portal');
      await Linking.openURL(data.url);
    } catch {
      Alert.alert('Error', 'Could not open billing portal. Please try again.');
    } finally {
      setPortalBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      await api.put('/me', { first_name: firstName, last_name: lastName, phone, address });
      await loadUser();
      setEditing(false);
    } catch { Alert.alert('Error', 'Could not save profile.'); }
    finally { setBusy(false); }
  };

  const initial = (firstName?.[0] ?? user?.email?.[0] ?? '?').toUpperCase();
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Your name';

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      {/* Avatar card */}
      <View style={s.avatarCard}>
        <LinearGradient colors={[C.gold, 'transparent']} style={s.cardAccent}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
        <View style={s.avatarRow}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initial}</Text>
          </View>
          <View>
            <Text style={s.avatarName}>{fullName}</Text>
            <Text style={s.avatarEmail}>{user?.email}</Text>
            <View style={[s.statusBadge,
              user?.status === 'active'   ? s.statusActive   :
              user?.status === 'inactive' ? s.statusInactive : s.statusPending]}>
              <Text style={[s.statusText,
                user?.status === 'active'   ? s.statusActiveText   :
                user?.status === 'inactive' ? s.statusInactiveText : s.statusPendingText]}>
                {user?.status ?? 'pending'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {editing ? (
        <View style={s.form}>
          <SLabel label="Personal details" />
          <FInput placeholder="First name" value={firstName} onChange={setFirstName} />
          <FInput placeholder="Last name"  value={lastName}  onChange={setLastName} />
          <SLabel label="Contact" />
          <FInput placeholder="Phone number" value={phone}   onChange={setPhone}   phone />
          <FInput placeholder="Home address" value={address} onChange={setAddress} multiline />
          <TouchableOpacity style={s.saveBtn} onPress={save} disabled={busy}>
            <LinearGradient colors={[C.gold, C.goldLight]} style={s.saveBtnGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              {busy ? <ActivityIndicator color={C.dark} /> : <Text style={s.saveBtnText}>Save changes</Text>}
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={s.cancelBtn} onPress={() => setEditing(false)}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.infoCard}>
          <LinearGradient colors={[C.gold, 'transparent']} style={s.cardAccent}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
          <Text style={s.infoSectionLabel}>Contact details</Text>
          {phone
            ? <InfoRow icon="📞" label="Phone"   value={phone} />
            : <Text style={s.infoEmpty}>No phone added</Text>
          }
          {address
            ? <InfoRow icon="📍" label="Address" value={address} />
            : <Text style={s.infoEmpty}>No address added</Text>
          }
          <TouchableOpacity style={s.editBtn} onPress={() => setEditing(true)}>
            <Text style={s.editBtnText}>Edit profile</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Credit History */}
      <View style={s.historyCard}>
        <LinearGradient colors={[C.gold, 'transparent']} style={s.cardAccent}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
        <Text style={s.infoSectionLabel}>Credit History</Text>
        {wallet !== null && (
          <Text style={s.balanceLine}>
            <Text style={s.balanceNum}>{wallet.balance}</Text>
            <Text style={s.balanceSub}> credits remaining</Text>
          </Text>
        )}
        {wallet === null ? (
          <ActivityIndicator color={C.gold} style={{ marginVertical: 16 }} />
        ) : wallet.transactions.length === 0 ? (
          <Text style={s.infoEmpty}>No payment history yet</Text>
        ) : (
          wallet.transactions.slice(0, 20).map((tx) => {
            const isTopup = tx.type === 'topup' || tx.type === 'subscription';
            const isRefund = tx.type === 'refund';
            const txIcon   = isRefund ? '↩' : tx.amount > 0 ? '+' : '−';
            const txColor  = isRefund ? C.blue : tx.amount > 0 ? C.gold : C.red;
            const amtStr   = (tx.amount > 0 ? '+' : '') + tx.amount;
            const dateStr  = new Date(tx.created_at).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric',
            });
            return (
              <View key={tx.id} style={s.txRow}>
                <View style={[s.txIconWrap, { backgroundColor: `${txColor}20` }]}>
                  <Text style={[s.txIcon, { color: txColor }]}>{txIcon}</Text>
                </View>
                <View style={s.txMiddle}>
                  <Text style={s.txDesc} numberOfLines={2}>{tx.description}</Text>
                  <Text style={s.txDate}>{dateStr}</Text>
                </View>
                <Text style={[s.txAmount, { color: txColor }]}>{amtStr}</Text>
              </View>
            );
          })
        )}
        <TouchableOpacity style={s.portalBtn} onPress={openPortal} disabled={portalBusy}>
          {portalBusy
            ? <ActivityIndicator color={C.gold} />
            : <Text style={s.portalBtnText}>Manage subscription</Text>}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={s.logoutBtn} onPress={logout}>
        <Text style={s.logoutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={ir.row}>
      <Text style={ir.icon}>{icon}</Text>
      <Text style={ir.label}>{label}</Text>
      <Text style={ir.value} numberOfLines={2}>{value}</Text>
    </View>
  );
}
const ir = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10,
           borderBottomWidth: 1, borderBottomColor: C.dark4, gap: 10 },
  icon:  { fontSize: 14, width: 20 },
  label: { color: C.muted, fontSize: 13, width: 60 },
  value: { color: C.cream, fontSize: 13, flex: 1 },
});

function SLabel({ label }: { label: string }) {
  return <Text style={sl.label}>{label}</Text>;
}
const sl = StyleSheet.create({
  label: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.8, color: C.gold,
           marginTop: 16, marginBottom: 8, opacity: 0.8 },
});

function FInput({ placeholder, value, onChange, phone, multiline }: {
  placeholder: string; value: string; onChange: (v: string) => void;
  phone?: boolean; multiline?: boolean;
}) {
  return (
    <TextInput
      style={[fi.input, multiline && { height: 80, textAlignVertical: 'top' }]}
      placeholder={placeholder} placeholderTextColor={C.muted}
      value={value} onChangeText={onChange}
      keyboardType={phone ? 'phone-pad' : 'default'}
      multiline={multiline}
    />
  );
}
const fi = StyleSheet.create({
  input: { backgroundColor: C.dark2, color: C.cream, borderRadius: 14, padding: 14,
           marginBottom: 8, fontSize: 14, borderWidth: 1, borderColor: C.dark4 },
});

const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: C.dark },
  content:          { padding: 24, paddingTop: 68, paddingBottom: 60 },

  avatarCard:       { backgroundColor: C.dark3, borderRadius: 22, padding: 20, marginBottom: 12,
                      borderWidth: 1, borderColor: C.dark4, overflow: 'hidden' },
  cardAccent:       { position: 'absolute', top: 0, left: 0, right: 0, height: 2 },
  avatarRow:        { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar:           { width: 62, height: 62, borderRadius: 31, backgroundColor: C.dark4,
                      borderWidth: 2, borderColor: `${C.gold}59`,
                      alignItems: 'center', justifyContent: 'center' },
  avatarText:       { color: C.gold, fontWeight: '700', fontSize: 24, fontFamily: F.serif },
  avatarName:       { fontSize: 17, fontWeight: '600', color: C.cream, marginBottom: 2 },
  avatarEmail:      { fontSize: 12, color: C.muted, marginBottom: 8 },

  statusBadge:      { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  statusActive:     { backgroundColor: `${C.green}21`, borderColor: `${C.green}47` },
  statusPending:    { backgroundColor: `${C.amber}21`, borderColor: `${C.amber}47` },
  statusInactive:   { backgroundColor: `${C.muted}21`, borderColor: `${C.muted}47` },
  statusText:       { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  statusActiveText:   { color: C.green },
  statusPendingText:  { color: C.amber },
  statusInactiveText: { color: C.muted },

  infoCard:         { backgroundColor: C.dark3, borderRadius: 22, padding: 20, marginBottom: 12,
                      borderWidth: 1, borderColor: C.dark4, overflow: 'hidden' },
  infoSectionLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.8, color: C.gold,
                      marginBottom: 10, opacity: 0.8 },
  infoEmpty:        { color: C.muted, fontSize: 13, paddingVertical: 8 },
  editBtn:          { marginTop: 16, backgroundColor: C.dark2, borderRadius: 12, padding: 13,
                      alignItems: 'center', borderWidth: 1, borderColor: C.dark4 },
  editBtnText:      { color: C.gold, fontWeight: '600', fontSize: 14 },

  form:             { marginBottom: 12 },
  saveBtn:          { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  saveBtnGrad:      { padding: 16, alignItems: 'center' },
  saveBtnText:      { color: C.dark, fontWeight: '700', fontSize: 15 },
  cancelBtn:        { padding: 12, alignItems: 'center' },
  cancelText:       { color: C.textDim, fontSize: 13 },

  logoutBtn:        { padding: 16, alignItems: 'center', marginTop: 8 },
  logoutText:       { color: C.muted, fontSize: 13 },

  historyCard:      { backgroundColor: C.dark3, borderRadius: 22, padding: 20, marginBottom: 12,
                      borderWidth: 1, borderColor: C.dark4, overflow: 'hidden' },
  balanceLine:      { marginBottom: 12 },
  balanceNum:       { fontSize: 22, fontWeight: '700', color: C.cream },
  balanceSub:       { fontSize: 13, color: C.textDim },
  txRow:            { flexDirection: 'row', alignItems: 'center', gap: 12,
                      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.dark4 },
  txIconWrap:       { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  txIcon:           { fontSize: 15, fontWeight: '700' },
  txMiddle:         { flex: 1 },
  txDesc:           { color: C.cream, fontSize: 13 },
  txDate:           { color: C.muted, fontSize: 11, marginTop: 2 },
  txAmount:         { fontSize: 15, fontWeight: '700' },
  portalBtn:        { marginTop: 16, backgroundColor: C.dark2, borderRadius: 12, padding: 13,
                      alignItems: 'center', borderWidth: 1, borderColor: C.dark4 },
  portalBtnText:    { color: C.gold, fontWeight: '600', fontSize: 14 },
});
