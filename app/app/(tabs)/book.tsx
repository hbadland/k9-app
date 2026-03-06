import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { api } from '../../lib/api';
import { C, F } from '../../lib/theme';

interface MyBooking {
  id: string; status: string; created_at: string;
  dog_name: string; service_name: string;
  slot_date: string; slot_start: string; slot_end: string;
}

interface Slot {
  id: string; service_id: string; date: string; start_time: string; end_time: string;
  capacity: number; booked_count: number; service_name: string; service_type: string; price_pence: number;
}

interface Dog { id: string; name: string; }

const DAYS   = ['M','T','W','T','F','S','S'];
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

function fmt12(time: string) {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return { h: String(h % 12 || 12), m: m === 0 ? '00' : String(m).padStart(2, '0'), ampm };
}

function slotDuration(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  return mins >= 60 ? `${Math.floor(mins / 60)}h` : `${mins} min`;
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'short',
  });
}

function canCancelBooking(b: MyBooking): boolean {
  if (b.status !== 'pending' && b.status !== 'confirmed') return false;
  const slotStart = new Date(`${b.slot_date}T${b.slot_start}`);
  return slotStart.getTime() - Date.now() > 12 * 60 * 60 * 1000;
}

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  pending:     { bg: `${C.amber}26`,  text: C.amber },
  confirmed:   { bg: `${C.green}21`,  text: C.green },
  in_progress: { bg: `${C.blue}26`,   text: C.blue },
  completed:   { bg: `${C.blue}26`,   text: C.blue },
  cancelled:   { bg: `${C.red}21`,    text: C.red },
};

export default function Book() {
  const router = useRouter();
  const today  = new Date();

  const [tab, setTab] = useState<'book' | 'mine'>('book');

  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate,   setSelectedDate]   = useState('');
  const [slots,          setSlots]          = useState<Slot[]>([]);
  const [datesWithSlots, setDatesWithSlots] = useState<Set<string>>(new Set());
  const [selectedSlot,   setSelectedSlot]   = useState<Slot | null>(null);
  const [dogs,           setDogs]           = useState<Dog[]>([]);
  const [selectedDog,    setSelectedDog]    = useState<string>('');
  const [slotsLoading,   setSlotsLoading]   = useState(false);
  const [booking,        setBooking]        = useState(false);
  const [showModal,      setShowModal]      = useState(false);

  const [myBookings,       setMyBookings]       = useState<MyBooking[]>([]);
  const [myBookingsLoaded, setMyBookingsLoaded] = useState(false);

  const loadMyBookings = useCallback(async (force = false) => {
    if (myBookingsLoaded && !force) return;
    try {
      const { data } = await api.get('/bookings');
      setMyBookings(data);
    } catch {}
    setMyBookingsLoaded(true);
  }, [myBookingsLoaded]);

  // Load dots for month
  useEffect(() => {
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const last = new Date(year, month + 1, 0).getDate();
    const to   = `${year}-${String(month + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    api.get(`/bookings/availability?from=${from}&to=${to}`)
      .then(({ data }) => setDatesWithSlots(new Set((data as Slot[]).map(s => s.date))))
      .catch(() => {});
  }, [year, month]);

  // Load slots for selected date
  const loadSlots = useCallback(async (date: string) => {
    setSlotsLoading(true);
    setSelectedSlot(null);
    try {
      const { data } = await api.get(`/bookings/availability?date=${date}`);
      setSlots(data);
    } catch {
      Alert.alert('Error', 'Could not load slots.');
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  useEffect(() => {
    api.get('/dogs').then(({ data }) => {
      setDogs(data);
      if (data.length) setSelectedDog(data[0].id);
    }).catch(() => {});
  }, []);

  const selectDate = (date: string) => {
    setSelectedDate(date);
    loadSlots(date);
  };

  const openModal = (slot: Slot) => {
    if (!dogs.length) {
      Alert.alert('No dog registered', 'Add a dog in your profile before booking.');
      return;
    }
    setSelectedSlot(slot);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedSlot(null);
  };

  const doBook = async () => {
    if (!selectedSlot || !selectedDog) return;
    setBooking(true);
    try {
      await api.post('/bookings', { dog_id: selectedDog, slot_id: selectedSlot.id });
      setShowModal(false);
      setSelectedSlot(null);
      await loadMyBookings(true);
      setTab('mine');
    } catch (e: any) {
      Alert.alert('Booking failed', e?.response?.data?.error ?? 'Please try again.');
    } finally {
      setBooking(false);
    }
  };

  const cancelBooking = async (id: string) => {
    Alert.alert('Cancel booking', 'Are you sure? You will be refunded 1 credit.', [
      { text: 'Keep booking', style: 'cancel' },
      { text: 'Cancel booking', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/bookings/${id}`);
          setMyBookings(bs => bs.map(b => b.id === id ? { ...b, status: 'cancelled' } : b));
        } catch {
          Alert.alert('Error', 'Could not cancel booking.');
        }
      }},
    ]);
  };

  // Calendar grid
  const firstDay  = new Date(year, month, 1).getDay();
  const firstMon  = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstMon).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  // Modal content
  const dog  = dogs.find(d => d.id === selectedDog);
  const t    = selectedSlot ? fmt12(selectedSlot.start_time) : null;
  const tEnd = selectedSlot ? fmt12(selectedSlot.end_time)   : null;

  return (
    <View style={s.root}>

      {/* ── Header + Calendar ── */}
      <View style={s.header}>
        <View style={s.headerRow}>
          <Text style={s.headerTitle}>Bookings</Text>
          <View style={s.autoBadge}>
            <View style={s.autoDot} />
            <Text style={s.autoBadgeText}>Instant book</Text>
          </View>
        </View>

        <View style={s.tabRow}>
          {(['book', 'mine'] as const).map(t => (
            <TouchableOpacity key={t} style={[s.tabBtn, tab === t && s.tabBtnActive]}
              onPress={() => { setTab(t); if (t === 'mine') loadMyBookings(); }}>
              <Text style={[s.tabBtnText, tab === t && s.tabBtnTextActive]}>
                {t === 'book' ? 'New Booking' : 'My Bookings'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'book' && (
          <View style={s.cal}>
            <View style={s.calHead}>
              <TouchableOpacity style={s.calArrow} onPress={prevMonth}>
                <Text style={s.calArrowText}>‹</Text>
              </TouchableOpacity>
              <Text style={s.calMonthName}>{MONTHS[month]} {year}</Text>
              <TouchableOpacity style={s.calArrow} onPress={nextMonth}>
                <Text style={s.calArrowText}>›</Text>
              </TouchableOpacity>
            </View>
            <View style={s.calDow}>
              {DAYS.map((d, i) => <Text key={i} style={s.calDowText}>{d}</Text>)}
            </View>
            <View style={s.calGrid}>
              {cells.map((day, i) => {
                if (!day) return <View key={i} style={s.calCell} />;
                const dateStr    = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isToday    = dateStr === todayStr;
                const isSelected = dateStr === selectedDate;
                const hasDot     = datesWithSlots.has(dateStr);
                const isPast     = dateStr < todayStr;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[s.calCell, isSelected && s.calCellSelected, isPast && s.calCellPast]}
                    onPress={() => !isPast && selectDate(dateStr)}
                    disabled={isPast}
                  >
                    <Text style={[s.calCellText, isToday && s.calCellToday, isSelected && s.calCellSelectedText]}>
                      {day}
                    </Text>
                    {hasDot && !isSelected && <View style={s.calDot} />}
                    {hasDot && isSelected  && <View style={[s.calDot, { backgroundColor: C.dark }]} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </View>

      {/* ── My Bookings ── */}
      {tab === 'mine' && (
        <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 100, paddingTop: 16 }}
          showsVerticalScrollIndicator={false}>
          {!myBookingsLoaded
            ? <ActivityIndicator color={C.gold} style={{ marginTop: 32 }} />
            : myBookings.length === 0
              ? <Text style={s.empty}>No bookings yet.</Text>
              : myBookings.map(b => {
                  const st        = STATUS_STYLE[b.status] ?? STATUS_STYLE.pending;
                  const cancellable = canCancelBooking(b);
                  return (
                    <View key={b.id} style={s.myCard}>
                      <View style={s.myCardLeft}>
                        <Text style={s.myDate}>
                          {new Date(b.slot_date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </Text>
                        <Text style={s.myService}>{b.service_name}</Text>
                        <Text style={s.myTime}>
                          {b.slot_start.slice(0,5)} – {b.slot_end.slice(0,5)} · {b.dog_name}
                        </Text>
                      </View>
                      <View style={s.myCardRight}>
                        <View style={[s.myBadge, { backgroundColor: st.bg }]}>
                          <Text style={[s.myBadgeText, { color: st.text }]}>
                            {b.status === 'in_progress' ? 'Live 🔴' :
                             b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={s.chatBtn}
                          onPress={() => router.push({ pathname: '/booking/[id]', params: { id: b.id } })}
                        >
                          <Text style={s.chatBtnText}>💬</Text>
                        </TouchableOpacity>
                        {cancellable && (
                          <TouchableOpacity onPress={() => cancelBooking(b.id)} style={s.myCancel}>
                            <Text style={s.myCancelText}>Cancel</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })
          }
        </ScrollView>
      )}

      {/* ── Slots list ── */}
      {tab === 'book' && (
        <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}>
          {!selectedDate ? (
            <Text style={s.empty}>Select a date to see available slots.</Text>
          ) : slotsLoading ? (
            <ActivityIndicator color={C.gold} style={{ marginTop: 32 }} />
          ) : slots.length === 0 ? (
            <Text style={s.empty}>No slots available on this date.</Text>
          ) : (
            <>
              <Text style={s.slotsDayTitle}>{fmtDate(selectedDate)}</Text>
              {slots.map(slot => {
                const full    = slot.booked_count >= slot.capacity;
                const limited = !full && (slot.capacity - slot.booked_count) === 1;
                const { h, m, ampm } = fmt12(slot.start_time);
                return (
                  <TouchableOpacity
                    key={slot.id}
                    style={[s.slot, full && s.slotFull]}
                    onPress={() => !full && openModal(slot)}
                    disabled={full}
                    activeOpacity={0.7}
                  >
                    <View style={s.slotTime}>
                      <Text style={s.slotH}>{h}</Text>
                      <Text style={s.slotM}>{m} {ampm}</Text>
                    </View>
                    <View style={s.slotInfo}>
                      <Text style={s.slotName}>{slot.service_name}</Text>
                      <Text style={s.slotDetail}>
                        {slotDuration(slot.start_time, slot.end_time)} · 1 credit
                      </Text>
                    </View>
                    <View style={[s.availPill,
                      full ? s.availFull : limited ? s.availLtd : s.availOpen]}>
                      <Text style={[s.availText,
                        full ? s.availFullText : limited ? s.availLtdText : s.availOpenText]}>
                        {full ? 'Full' : limited ? 'Last spot' : 'Open'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </ScrollView>
      )}

      {/* ── Booking modal ── */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <Pressable style={s.modalOverlay} onPress={closeModal}>
          <Pressable style={s.modalSheet} onPress={() => {}}>
            {/* Drag handle */}
            <View style={s.modalHandle} />

            <Text style={s.modalTitle}>Confirm Booking</Text>

            {selectedSlot && (
              <>
                {/* Details card */}
                <View style={s.modalCard}>
                  <Row label="Service"  value={selectedSlot.service_name} />
                  <Row label="Date"     value={fmtDate(selectedDate)} />
                  <Row label="Time"     value={`${t!.h}:${t!.m} ${t!.ampm} – ${tEnd!.h}:${tEnd!.m} ${tEnd!.ampm}`} />
                  <Row label="Duration" value={slotDuration(selectedSlot.start_time, selectedSlot.end_time)} />
                  <Row label="For"      value={dog?.name ?? '—'} last />
                </View>

                {/* Cost pill */}
                <View style={s.costRow}>
                  <Text style={s.costLabel}>Cost</Text>
                  <View style={s.costPill}>
                    <Text style={s.costVal}>1 credit</Text>
                  </View>
                </View>

                {/* Dog selector (only when multiple dogs) */}
                {dogs.length > 1 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.dogScroll}>
                    {dogs.map(d => (
                      <TouchableOpacity key={d.id}
                        style={[s.dogChip, selectedDog === d.id && s.dogChipActive]}
                        onPress={() => setSelectedDog(d.id)}>
                        <Text style={[s.dogChipText, selectedDog === d.id && s.dogChipActiveText]}>
                          {d.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </>
            )}

            {/* Buttons */}
            <TouchableOpacity style={s.confirmBtn} onPress={doBook} disabled={booking}>
              <LinearGradient colors={[C.gold, C.goldLight]} style={s.confirmGrad}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {booking
                  ? <ActivityIndicator color={C.dark} />
                  : <Text style={s.confirmText}>Confirm Booking</Text>
                }
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={s.goBackBtn} onPress={closeModal} disabled={booking}>
              <Text style={s.goBackText}>Go back</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[r.row, !last && r.rowBorder]}>
      <Text style={r.label}>{label}</Text>
      <Text style={r.value}>{value}</Text>
    </View>
  );
}

const r = StyleSheet.create({
  row:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  label:     { fontSize: 13, color: C.textDim },
  value:     { fontSize: 13, color: C.cream, fontWeight: '600', textAlign: 'right', flex: 1, marginLeft: 16 },
});

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: C.dark },
  header:         { backgroundColor: C.dark2, borderBottomWidth: 1,
                    borderBottomColor: 'rgba(255,255,255,0.05)',
                    paddingTop: 64, paddingHorizontal: 20, paddingBottom: 16 },
  headerRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headerTitle:    { fontSize: 24, fontWeight: '700', color: C.cream, fontFamily: F.serif },
  autoBadge:      { flexDirection: 'row', alignItems: 'center', gap: 6,
                    backgroundColor: `${C.gold}1A`, borderWidth: 1, borderColor: `${C.gold}40`,
                    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  autoDot:        { width: 7, height: 7, borderRadius: 4, backgroundColor: C.gold },
  autoBadgeText:  { fontSize: 11, color: C.gold },

  tabRow:         { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tabBtn:         { flex: 1, paddingVertical: 8, borderRadius: 12,
                    backgroundColor: C.dark3, borderWidth: 1, borderColor: C.dark4, alignItems: 'center' },
  tabBtnActive:   { backgroundColor: `${C.gold}1A`, borderColor: `${C.gold}59` },
  tabBtnText:     { fontSize: 12, fontWeight: '600', color: C.textDim },
  tabBtnTextActive:{ color: C.gold },

  scroll:         { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  empty:          { color: C.muted, fontSize: 14, textAlign: 'center', marginTop: 32 },

  // My Bookings cards
  myCard:         { backgroundColor: C.dark3, borderWidth: 1, borderColor: C.dark4,
                    borderRadius: 18, padding: 15, marginBottom: 10,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  myCardLeft:     { flex: 1 },
  myDate:         { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: C.textDim, marginBottom: 3 },
  myService:      { fontSize: 15, fontWeight: '600', color: C.cream },
  myTime:         { fontSize: 12, color: C.textDim, marginTop: 2 },
  myCardRight:    { alignItems: 'flex-end', gap: 8 },
  myBadge:        { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9 },
  myBadgeText:    { fontSize: 11, fontWeight: '600' },
  chatBtn:        { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9,
                    backgroundColor: `${C.gold}1A`, borderWidth: 1, borderColor: `${C.gold}40` },
  chatBtnText:    { fontSize: 14 },
  myCancel:       { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9,
                    backgroundColor: `${C.red}1F`, borderWidth: 1, borderColor: `${C.red}40` },
  myCancelText:   { fontSize: 11, fontWeight: '600', color: C.red },

  // Calendar
  cal:            { userSelect: 'none' } as any,
  calHead:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  calArrow:       { backgroundColor: C.dark4, width: 28, height: 28, borderRadius: 8,
                    alignItems: 'center', justifyContent: 'center' },
  calArrowText:   { color: C.textDim, fontSize: 18, lineHeight: 22 },
  calMonthName:   { fontSize: 14, fontWeight: '600', color: C.cream },
  calDow:         { flexDirection: 'row', marginBottom: 6 },
  calDowText:     { flex: 1, textAlign: 'center', fontSize: 10, color: C.textDim,
                    textTransform: 'uppercase', letterSpacing: 0.5 },
  calGrid:        { flexDirection: 'row', flexWrap: 'wrap' },
  calCell:        { width: '14.28%', height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  calCellSelected:{ backgroundColor: C.gold },
  calCellPast:    { opacity: 0.28 },
  calCellText:    { fontSize: 13, color: C.textDim },
  calCellToday:   { color: C.gold, fontWeight: '700' },
  calCellSelectedText: { color: C.dark, fontWeight: '700' },
  calDot:         { position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: 2, backgroundColor: C.green },

  // Slot cards
  slotsDayTitle:  { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5,
                    color: C.textDim, marginBottom: 12 },
  slot:           { backgroundColor: C.dark3, borderWidth: 1, borderColor: C.dark4,
                    borderRadius: 18, padding: 15, marginBottom: 10,
                    flexDirection: 'row', alignItems: 'center', gap: 14 },
  slotFull:       { opacity: 0.4 },
  slotTime:       { backgroundColor: C.dark4, borderRadius: 12, paddingHorizontal: 13,
                    paddingVertical: 10, alignItems: 'center', minWidth: 60 },
  slotH:          { fontSize: 18, fontWeight: '700', color: C.cream, lineHeight: 20 },
  slotM:          { fontSize: 11, color: C.textDim, marginTop: 2 },
  slotInfo:       { flex: 1 },
  slotName:       { fontSize: 14, fontWeight: '600', color: C.cream },
  slotDetail:     { fontSize: 11, color: C.textDim, marginTop: 3 },
  availPill:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9, borderWidth: 1 },
  availOpen:      { backgroundColor: `${C.green}1F`, borderColor: `${C.green}40` },
  availLtd:       { backgroundColor: `${C.amber}1F`, borderColor: `${C.amber}40` },
  availFull:      { backgroundColor: `${C.red}1F`,   borderColor: `${C.red}40`   },
  availText:      { fontSize: 11, fontWeight: '600' },
  availOpenText:  { color: C.green },
  availLtdText:   { color: C.amber },
  availFullText:  { color: C.red },

  // Modal
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet:     { backgroundColor: C.dark2, borderTopLeftRadius: 28, borderTopRightRadius: 28,
                    paddingHorizontal: 24, paddingBottom: 40, paddingTop: 12 },
  modalHandle:    { width: 40, height: 4, borderRadius: 2, backgroundColor: C.dark4,
                    alignSelf: 'center', marginBottom: 24 },
  modalTitle:     { fontSize: 20, fontWeight: '700', color: C.cream, fontFamily: F.serif, marginBottom: 20 },
  modalCard:      { backgroundColor: C.dark3, borderRadius: 18, paddingHorizontal: 16,
                    paddingVertical: 4, marginBottom: 16,
                    borderWidth: 1, borderColor: C.dark4 },
  costRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 20 },
  costLabel:      { fontSize: 14, color: C.textDim },
  costPill:       { backgroundColor: `${C.gold}1A`, borderWidth: 1, borderColor: `${C.gold}50`,
                    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12 },
  costVal:        { fontSize: 14, fontWeight: '700', color: C.gold },
  dogScroll:      { marginBottom: 20 },
  dogChip:        { backgroundColor: C.dark3, borderWidth: 1, borderColor: C.dark4,
                    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  dogChipActive:  { backgroundColor: C.gold, borderColor: C.gold },
  dogChipText:    { color: C.textDim, fontSize: 13 },
  dogChipActiveText:{ color: C.dark, fontWeight: '600' },
  confirmBtn:     { borderRadius: 18, overflow: 'hidden', marginBottom: 12 },
  confirmGrad:    { paddingVertical: 17, alignItems: 'center' },
  confirmText:    { color: C.dark, fontWeight: '700', fontSize: 16 },
  goBackBtn:      { alignItems: 'center', paddingVertical: 12 },
  goBackText:     { color: C.textDim, fontSize: 15 },
});
