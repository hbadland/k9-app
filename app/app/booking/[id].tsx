import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Image,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { getAccessToken } from '../../lib/auth';
import { getSocket, disconnectSocket } from '../../lib/socket';
import { useColors } from '../../lib/useColors';
import { F } from '../../lib/theme';

interface Message {
  id: string;
  booking_id: string;
  sender_id: string;
  sender_role: 'owner' | 'admin';
  body: string | null;
  photo_url: string | null;
  type: 'message' | 'update';
  created_at: string;
}

interface Booking {
  id: string;
  status: string;
  dog_name: string;
  service_name: string;
  slot_date: string;
  slot_start: string;
  slot_end: string;
  notes: string | null;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

function calcDuration(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? `${mins % 60}m` : ''}`.trim();
}

export default function BookingChat() {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);

  const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
    pending:     { bg: C.amberSoft,  text: C.amber },
    confirmed:   { bg: C.greenSoft,  text: C.green },
    in_progress: { bg: C.goldSoft,   text: C.gold },
    completed:   { bg: C.goldSoft,   text: C.gold },
    cancelled:   { bg: C.redSoft,    text: C.red },
  };

  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [booking, setBooking]   = useState<Booking | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody]         = useState('');
  const [sending, setSending]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const flatRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get(`/bookings/${id}`),
      api.get(`/bookings/${id}/messages`),
    ]).then(([bRes, mRes]) => {
      setBooking(bRes.data);
      setMessages(mRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let socket: ReturnType<typeof getSocket> | null = null;

    const handler = (msg: Message) => {
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    };

    getAccessToken().then(token => {
      if (!token) return;
      socket = getSocket(token);
      socket.off('message:new');
      socket.emit('subscribe:booking', { bookingId: id });
      socket.on('message:new', handler);
    });

    return () => {
      socket?.emit('unsubscribe:booking', { bookingId: id });
      socket?.off('message:new', handler);
    };
  }, [id]);

  useEffect(() => {
    if (!loading && messages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 200);
    }
  }, [loading]);

  const sendMessage = async () => {
    if (!body.trim() || !id) return;
    setSending(true);
    try {
      await api.post(`/bookings/${id}/messages`, { body: body.trim() });
      setBody('');
    } catch {}
    finally { setSending(false); }
  };

  const photos = messages.filter(m => m.photo_url);
  const isCompleted = booking?.status === 'completed';

  const renderMessage = ({ item }: { item: Message }) => {
    const isAdmin = item.sender_role === 'admin';
    const isUpdate = item.type === 'update';

    if (isAdmin && isUpdate) {
      return (
        <View style={s.updateBubble}>
          <Text style={s.updateLabel}>Walk update</Text>
          {item.body ? <Text style={s.updateBody}>{item.body}</Text> : null}
          {item.photo_url ? (
            <Image source={{ uri: item.photo_url }} style={s.updatePhoto} resizeMode="cover" />
          ) : null}
          <Text style={s.msgTime}>{fmtTime(item.created_at)}</Text>
        </View>
      );
    }

    if (isAdmin) {
      return (
        <View style={s.adminBubble}>
          <Text style={s.adminBody}>{item.body}</Text>
          <Text style={s.msgTime}>{fmtTime(item.created_at)}</Text>
        </View>
      );
    }

    return (
      <View style={s.ownerBubbleWrap}>
        <View style={s.ownerBubble}>
          <Text style={s.ownerBody}>{item.body}</Text>
          <Text style={[s.msgTime, { color: `${C.dark}99` }]}>{fmtTime(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={C.gold} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Walk Updates</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Booking info card */}
      {booking && (
        <>
          <View style={s.infoCard}>
            <View style={s.infoLeft}>
              <Text style={s.infoDog}>{booking.dog_name}</Text>
              <Text style={s.infoMeta}>
                {fmtDate(booking.slot_date)} · {booking.slot_start.slice(0,5)}–{booking.slot_end.slice(0,5)}
              </Text>
              <Text style={s.infoService}>{booking.service_name}</Text>
            </View>
            {(() => {
              const st = STATUS_STYLE[booking.status] ?? STATUS_STYLE.pending;
              const label = booking.status === 'in_progress' ? 'Live' :
                booking.status.charAt(0).toUpperCase() + booking.status.slice(1);
              return (
                <View style={[s.badge, { backgroundColor: st.bg }]}>
                  {booking.status === 'in_progress' && <View style={s.liveDot} />}
                  <Text style={[s.badgeText, { color: st.text }]}>{label}</Text>
                </View>
              );
            })()}
          </View>
          {booking.notes ? (
            <View style={s.notesCard}>
              <Text style={s.notesLabel}>Your notes</Text>
              <Text style={s.notesText}>{booking.notes}</Text>
            </View>
          ) : null}
        </>
      )}

      {/* Walk Report — shown when completed */}
      {isCompleted && booking && (
        <View style={s.reportCard}>
          <Text style={s.reportTitle}>Walk Report</Text>
          <View style={s.reportRow}>
            <View style={s.reportItem}>
              <Text style={s.reportVal}>{calcDuration(booking.slot_start, booking.slot_end)}</Text>
              <Text style={s.reportLbl}>Duration</Text>
            </View>
            <View style={s.reportItem}>
              <Text style={s.reportVal}>{photos.length}</Text>
              <Text style={s.reportLbl}>Photos</Text>
            </View>
          </View>
          {photos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.photoScroll}>
              {photos.map(m => (
                <Image key={m.id} source={{ uri: m.photo_url! }} style={s.reportPhoto} resizeMode="cover" />
              ))}
            </ScrollView>
          )}
          <TouchableOpacity style={s.replayBtn} onPress={() => router.push(`/booking/map-replay?id=${booking.id}`)}>
            <Text style={s.replayBtnText}>View GPS Route Replay</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Messages */}
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={m => m.id}
        renderItem={renderMessage}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={s.empty}>No messages yet. Your walker will send updates during the walk.</Text>
        }
      />

      {/* Input — hidden when completed */}
      {!isCompleted && (
        <View style={[s.inputRow, { paddingBottom: insets.bottom + 12 }]}>
          <TextInput
            style={s.input}
            value={body}
            onChangeText={setBody}
            placeholder="Type a message…"
            placeholderTextColor={C.muted}
            returnKeyType="send"
            onSubmitEditing={sendMessage}
            multiline
          />
          <TouchableOpacity
            style={[s.sendBtn, (!body.trim() || sending) && s.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!body.trim() || sending}
          >
            {sending
              ? <ActivityIndicator color={C.dark} size="small" />
              : <Text style={s.sendText}>›</Text>
            }
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root:         { flex: 1, backgroundColor: C.dark },

    header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    backgroundColor: C.dark2, paddingHorizontal: 16, paddingBottom: 14,
                    borderBottomWidth: 1, borderBottomColor: C.border },
    backBtn:      { width: 36, height: 36, borderRadius: 12, backgroundColor: C.dark3,
                    alignItems: 'center', justifyContent: 'center' },
    backText:     { color: C.cream, fontSize: 22, lineHeight: 26 },
    headerTitle:  { fontSize: 16, fontWeight: '700', color: C.cream, fontFamily: F.serif },

    infoCard:     { backgroundColor: C.dark3, marginHorizontal: 16, marginTop: 12,
                    borderRadius: 16, padding: 14, flexDirection: 'row',
                    alignItems: 'center', justifyContent: 'space-between',
                    borderWidth: 1, borderColor: C.border },
    infoLeft:     { flex: 1 },
    infoDog:      { fontSize: 15, fontWeight: '700', color: C.cream },
    infoMeta:     { fontSize: 11, color: C.textDim, marginTop: 2 },
    infoService:  { fontSize: 11, color: C.gold, marginTop: 2 },
    badge:        { flexDirection: 'row', alignItems: 'center', gap: 5,
                    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
    badgeText:    { fontSize: 11, fontWeight: '600' },
    liveDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },

    reportCard:   { backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.goldBorder,
                    marginHorizontal: 16, marginTop: 10, borderRadius: 16, padding: 14 },
    reportTitle:  { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.5,
                    color: C.gold, marginBottom: 10 },
    reportRow:    { flexDirection: 'row', gap: 24, marginBottom: 10 },
    reportItem:   { alignItems: 'center' },
    reportVal:    { fontSize: 18, fontWeight: '700', color: C.cream },
    reportLbl:    { fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
    photoScroll:  { marginTop: 4 },
    reportPhoto:  { width: 100, height: 100, borderRadius: 10, marginRight: 8 },
    replayBtn:    { marginTop: 12, backgroundColor: C.dark2, borderRadius: 12, padding: 12,
                    alignItems: 'center', borderWidth: 1, borderColor: C.border },
    replayBtnText: { color: C.gold, fontSize: 13, fontWeight: '600' },
    notesCard:    { backgroundColor: C.dark2, marginHorizontal: 16, marginTop: 8,
                    borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border },
    notesLabel:   { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: C.muted, marginBottom: 6 },
    notesText:    { color: C.cream, fontSize: 13, lineHeight: 20 },

    list:         { padding: 16, gap: 10 },
    empty:        { color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 32, lineHeight: 20 },

    updateBubble: { backgroundColor: C.dark3, borderLeftWidth: 3, borderLeftColor: C.gold,
                    borderRadius: 14, padding: 12, maxWidth: '85%' },
    updateLabel:  { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1,
                    color: C.gold, marginBottom: 6 },
    updateBody:   { fontSize: 14, color: C.cream, lineHeight: 20 },
    updatePhoto:  { width: '100%', height: 180, borderRadius: 10, marginTop: 8 },

    adminBubble:  { backgroundColor: C.dark3, borderLeftWidth: 3, borderLeftColor: C.blue,
                    borderRadius: 14, padding: 12, maxWidth: '85%' },
    adminBody:    { fontSize: 14, color: C.cream, lineHeight: 20 },

    ownerBubbleWrap: { alignItems: 'flex-end' },
    ownerBubble:  { backgroundColor: C.gold, borderRadius: 14, padding: 12, maxWidth: '75%' },
    ownerBody:    { fontSize: 14, color: C.dark, fontWeight: '500', lineHeight: 20 },

    msgTime:      { fontSize: 10, color: C.muted, marginTop: 4, textAlign: 'right' },

    inputRow:     { flexDirection: 'row', alignItems: 'flex-end', gap: 10,
                    paddingHorizontal: 16, paddingTop: 10,
                    backgroundColor: C.dark2, borderTopWidth: 1, borderTopColor: C.border },
    input:        { flex: 1, backgroundColor: C.dark3, borderWidth: 1, borderColor: C.border,
                    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12,
                    color: C.cream, fontSize: 14, maxHeight: 120 },
    sendBtn:      { width: 44, height: 44, borderRadius: 22, backgroundColor: C.gold,
                    alignItems: 'center', justifyContent: 'center' },
    sendBtnDisabled: { opacity: 0.4 },
    sendText:     { color: C.dark, fontSize: 22, fontWeight: '700', lineHeight: 26 },
  });
}
