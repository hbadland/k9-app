import { useMemo, useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
         ActivityIndicator, Alert, Linking, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { useColors } from '../../lib/useColors';
import { useThemeStore } from '../../store/themeStore';
import { F } from '../../lib/theme';

interface WalletTransaction {
  id: string; type: 'topup' | 'usage' | 'refund' | 'subscription';
  amount: number; description: string; created_at: string;
}
interface WalletData { balance: number; transactions: WalletTransaction[]; }

export default function Profile() {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);

  const { user, logout, loadUser } = useAuthStore();
  const { isDark, toggle } = useThemeStore();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy]       = useState(false);
  const [wallet, setWallet]   = useState<WalletData | null>(null);
  const [portalBusy, setPortalBusy]         = useState(false);
  const [avatarUrl, setAvatarUrl]           = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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
      setAvatarUrl(data.avatar_url ?? null);
    }).catch(() => {});
    api.get('/payments/wallet').then(({ data }) => setWallet(data)).catch(() => {});
  }, []);

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingAvatar(true);
    try {
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append('avatar', { uri: asset.uri, name: 'avatar.jpg', type: 'image/jpeg' } as any);
      const { data } = await api.post('/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAvatarUrl(data.avatar_url);
    } catch {
      Alert.alert('Error', 'Could not upload photo. Check that image storage is configured.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const deleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This will permanently delete your account and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try { await api.delete('/me'); logout(); }
          catch { Alert.alert('Error', 'Could not delete account. Please try again.'); }
        }},
      ]
    );
  };

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

  const initial  = (firstName?.[0] ?? user?.email?.[0] ?? '?').toUpperCase();
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Your name';

  const txColor = (tx: WalletTransaction) =>
    tx.type === 'refund' ? C.blue :
    tx.amount > 0 ? C.green : C.muted;

  const txSymbol = (tx: WalletTransaction) =>
    tx.type === 'refund' ? '↩' : tx.amount > 0 ? '+' : '−';

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

      {/* Avatar + identity */}
      <View style={s.hero}>
        <TouchableOpacity style={s.avatar} onPress={pickAvatar} disabled={uploadingAvatar}>
          {uploadingAvatar ? (
            <ActivityIndicator color={C.gold} />
          ) : avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={s.avatarImg} />
          ) : (
            <Text style={s.avatarText}>{initial}</Text>
          )}
        </TouchableOpacity>
        <View style={s.heroInfo}>
          <Text style={s.heroName}>{fullName}</Text>
          <Text style={s.heroEmail}>{user?.email}</Text>
          <View style={[s.statusBadge,
            user?.status === 'active'   ? s.sActive :
            user?.status === 'inactive' ? s.sInactive : s.sPending]}>
            <Text style={[s.statusText,
              user?.status === 'active'   ? s.sActiveText :
              user?.status === 'inactive' ? s.sInactiveText : s.sPendingText]}>
              {user?.status ?? 'pending'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={pickAvatar} style={s.editPhotoBtn}>
          <Text style={s.editPhotoText}>Edit</Text>
        </TouchableOpacity>
      </View>

      {/* Contact details / edit form */}
      {editing ? (
        <View style={s.card}>
          <Text style={s.cardLabel}>Personal details</Text>
          <FInput C={C} placeholder="First name" value={firstName} onChange={setFirstName} />
          <FInput C={C} placeholder="Last name"  value={lastName}  onChange={setLastName} />
          <Text style={[s.cardLabel, { marginTop: 16 }]}>Contact</Text>
          <FInput C={C} placeholder="Phone number" value={phone}   onChange={setPhone}   phone />
          <FInput C={C} placeholder="Home address" value={address} onChange={setAddress} multiline />
          <TouchableOpacity
            style={[s.primaryBtn, busy && { opacity: 0.7 }]}
            onPress={save} disabled={busy}
          >
            {busy ? <ActivityIndicator color={C.dark} /> : <Text style={s.primaryBtnText}>Save changes</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={s.ghostBtn} onPress={() => setEditing(false)}>
            <Text style={s.ghostBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.card}>
          <Text style={s.cardLabel}>Contact details</Text>
          <InfoRow C={C} label="Phone"   value={phone   || 'Not added'} dim={!phone} />
          <InfoRow C={C} label="Address" value={address || 'Not added'} dim={!address} last />
          <TouchableOpacity style={s.outlineBtn} onPress={() => setEditing(true)}>
            <Text style={s.outlineBtnText}>Edit profile</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Wallet + history */}
      <View style={s.card}>
        <Text style={s.cardLabel}>Credit balance</Text>
        {wallet !== null && (
          <Text style={s.balance}>
            <Text style={s.balanceNum}>{wallet.balance}</Text>
            <Text style={s.balanceSub}> {wallet.balance === 1 ? 'credit' : 'credits'} remaining</Text>
          </Text>
        )}

        {wallet === null ? (
          <ActivityIndicator color={C.gold} style={{ marginVertical: 16 }} />
        ) : wallet.transactions.length === 0 ? (
          <Text style={s.empty}>No transactions yet</Text>
        ) : (
          wallet.transactions.slice(0, 20).map((tx) => (
            <View key={tx.id} style={s.txRow}>
              <View style={[s.txBadge, { backgroundColor: `${txColor(tx)}18` }]}>
                <Text style={[s.txSymbol, { color: txColor(tx) }]}>{txSymbol(tx)}</Text>
              </View>
              <View style={s.txMid}>
                <Text style={s.txDesc} numberOfLines={1}>{tx.description}</Text>
                <Text style={s.txDate}>
                  {new Date(tx.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </View>
              <Text style={[s.txAmount, { color: txColor(tx) }]}>
                {(tx.amount > 0 ? '+' : '') + tx.amount}
              </Text>
            </View>
          ))
        )}

        <TouchableOpacity style={s.outlineBtn} onPress={openPortal} disabled={portalBusy}>
          {portalBusy
            ? <ActivityIndicator color={C.gold} />
            : <Text style={s.outlineBtnText}>Manage subscription</Text>}
        </TouchableOpacity>
      </View>

      {/* Appearance */}
      <View style={s.card}>
        <Text style={s.cardLabel}>Appearance</Text>
        <TouchableOpacity style={s.themeRow} onPress={toggle}>
          <Text style={s.themeLabel}>{isDark ? 'Dark mode' : 'Light mode'}</Text>
          <View style={[s.themePill, isDark ? s.themePillDark : s.themePillLight]}>
            <Text style={[s.themePillText, isDark ? s.themePillTextDark : s.themePillTextLight]}>
              {isDark ? 'Dark' : 'Light'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Sign out / delete */}
      <TouchableOpacity style={s.signOutBtn} onPress={logout}>
        <Text style={s.signOutText}>Sign out</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.deleteBtn} onPress={deleteAccount}>
        <Text style={s.deleteText}>Delete account</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function InfoRow({ C, label, value, dim, last }: {
  C: ReturnType<typeof useColors>; label: string; value: string; dim?: boolean; last?: boolean;
}) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, gap: 12,
      ...(last ? {} : { borderBottomWidth: 1, borderBottomColor: C.border }),
    }}>
      <Text style={{ color: C.muted, fontSize: 13, width: 64 }}>{label}</Text>
      <Text style={{ color: dim ? C.muted : C.cream, fontSize: 13, flex: 1 }} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function FInput({ C, placeholder, value, onChange, phone, multiline }: {
  C: ReturnType<typeof useColors>; placeholder: string; value: string;
  onChange: (v: string) => void; phone?: boolean; multiline?: boolean;
}) {
  return (
    <TextInput
      style={[{
        backgroundColor: C.dark4, color: C.cream, borderRadius: 12, padding: 14,
        marginBottom: 8, fontSize: 14, borderWidth: 1, borderColor: C.border,
      }, multiline && { height: 80, textAlignVertical: 'top' }]}
      placeholder={placeholder} placeholderTextColor={C.muted}
      value={value} onChangeText={onChange}
      keyboardType={phone ? 'phone-pad' : 'default'}
      multiline={multiline}
    />
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.dark },
    content:   { padding: 22, paddingTop: 68, paddingBottom: 60 },

    hero:         { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
    avatar:       { width: 68, height: 68, borderRadius: 34, backgroundColor: C.dark3,
                    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                    borderWidth: 1, borderColor: C.goldBorder, flexShrink: 0 },
    avatarImg:    { width: 68, height: 68, borderRadius: 34 },
    avatarText:   { fontSize: 26, fontWeight: '700', color: C.gold, fontFamily: F.serif },
    heroInfo:     { flex: 1 },
    heroName:     { fontSize: 18, fontWeight: '600', color: C.cream, marginBottom: 2 },
    heroEmail:    { fontSize: 12, color: C.muted, marginBottom: 8 },
    editPhotoBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
                    backgroundColor: C.dark3, borderWidth: 1, borderColor: C.border },
    editPhotoText:{ fontSize: 12, color: C.textDim },

    statusBadge:    { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 7, borderWidth: 1 },
    sActive:        { backgroundColor: C.greenSoft,  borderColor: 'rgba(76,175,122,0.25)' },
    sPending:       { backgroundColor: C.amberSoft,  borderColor: 'rgba(232,169,58,0.25)' },
    sInactive:      { backgroundColor: C.dark4,      borderColor: C.border },
    statusText:     { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
    sActiveText:    { color: C.green },
    sPendingText:   { color: C.amber },
    sInactiveText:  { color: C.muted },

    card:        { backgroundColor: C.dark3, borderRadius: 18, padding: 18, marginBottom: 14,
                   borderWidth: 1, borderColor: C.border },
    cardLabel:   { fontSize: 11, fontWeight: '600', color: C.muted, textTransform: 'uppercase',
                   letterSpacing: 0.8, marginBottom: 12 },

    balance:     { marginBottom: 16 },
    balanceNum:  { fontSize: 28, fontWeight: '700', color: C.cream, fontFamily: F.serif },
    balanceSub:  { fontSize: 14, color: C.textDim },
    empty:       { color: C.muted, fontSize: 13, paddingVertical: 8 },

    txRow:    { flexDirection: 'row', alignItems: 'center', gap: 12,
                paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.border },
    txBadge:  { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    txSymbol: { fontSize: 14, fontWeight: '700' },
    txMid:    { flex: 1 },
    txDesc:   { color: C.cream, fontSize: 13 },
    txDate:   { color: C.muted, fontSize: 11, marginTop: 2 },
    txAmount: { fontSize: 15, fontWeight: '700', flexShrink: 0 },

    primaryBtn:     { backgroundColor: C.gold, borderRadius: 13, padding: 15, alignItems: 'center', marginTop: 8 },
    primaryBtnText: { color: C.dark, fontWeight: '700', fontSize: 15 },
    ghostBtn:       { padding: 13, alignItems: 'center' },
    ghostBtnText:   { color: C.muted, fontSize: 14 },
    outlineBtn:     { marginTop: 14, borderRadius: 12, padding: 13, alignItems: 'center',
                      borderWidth: 1, borderColor: C.border },
    outlineBtnText: { color: C.textDim, fontSize: 14, fontWeight: '500' },

    // Theme toggle
    themeRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    themeLabel:       { fontSize: 14, color: C.cream },
    themePill:        { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
    themePillDark:    { backgroundColor: C.dark4, borderColor: C.border },
    themePillLight:   { backgroundColor: C.goldSoft, borderColor: C.goldBorder },
    themePillText:    { fontSize: 12, fontWeight: '600' },
    themePillTextDark:  { color: C.textDim },
    themePillTextLight: { color: C.gold },

    signOutBtn:  { padding: 16, alignItems: 'center', marginTop: 8 },
    signOutText: { color: C.muted, fontSize: 14 },
    deleteBtn:   { padding: 12, alignItems: 'center', marginBottom: 20 },
    deleteText:  { color: C.red, fontSize: 13, opacity: 0.65 },
  });
}
