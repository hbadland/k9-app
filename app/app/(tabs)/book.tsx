import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../../lib/api';
import { useColors } from '../../lib/useColors';
import { F } from '../../lib/theme';

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

const DAYS   = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

function fmt12(time: string) {
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 || 12}:${m === 0 ? '00' : String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function slotDuration(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  return mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}` : `${mins} min`;
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'short',
  });
}

function fmtShort(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

function canCancel(b: MyBooking): boolean {
  if (b.status !== 'pending' && b.status !== 'confirmed') return false;
  return new Date(`${b.slot_date}T${b.slot_start}`).getTime() - Date.now() > 24 * 60 * 60 * 1000;
}

export default function Book() {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);

  const STATUS: Record<string, { label: string; color: string }> = {
    pending:     { label: 'Pending',     color: C.amber },
    confirmed:   { label: 'Confirmed',   color: C.green },
    in_progress: { label: 'Live',        color: C.green },
    completed:   { label: 'Completed',   color: C.textDim },
    cancelled:   { label: 'Cancelled',   color: C.muted },
  };

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
    try { const { data } = await api.get('/bookings'); setMyBookings(data); }
    catch {}
    setMyBookingsLoaded(true);
  }, [myBookingsLoaded]);

  useEffect(() => {
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const last = new Date(year, month + 1, 0).getDate();
    const to   = `${year}-${String(month + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    api.get(`/bookings/availability?from=${from}&to=${to}`)
      .then(({ data }) => setDatesWithSlots(new Set((data as Slot[]).map(sl => sl.date))))
      .catch(() => {});
  }, [year, month]);

  const loadSlots = useCallback(async (date: string) => {
    setSlotsLoading(true); setSelectedSlot(null);
    try { const { data } = await api.get(`/bookings/availability?date=${date}`); setSlots(data); }
    catch { Alert.alert('Error', 'Could not load slots.'); }
    finally { setSlotsLoading(false); }
  }, []);

  useEffect(() => {
    api.get('/dogs').then(({ data }) => {
      setDogs(data);
      if (data.length) setSelectedDog(data[0].id);
    }).catch(() => {});
  }, []);

  const selectDate = (date: string) => { setSelectedDate(date); loadSlots(date); };

  const openModal = (slot: Slot) => {
    if (!dogs.length) { Alert.alert('No dog registered', 'Add a dog before booking.'); return; }
    setSelectedSlot(slot); setShowModal(true);
  };

  const doBook = async () => {
    if (!selectedSlot || !selectedDog) return;
    setBooking(true);
    try {
      await api.post('/bookings', { dog_id: selectedDog, slot_id: selectedSlot.id });
      setShowModal(false); setSelectedSlot(null);
      await loadMyBookings(true);
      setTab('mine');
    } catch (e: any) {
      Alert.alert('Booking failed', e?.response?.data?.error ?? 'Please try again.');
    } finally { setBooking(false); }
  };

  const cancelBooking = async (id: string) => {
    Alert.alert('Cancel booking', 'Are you sure? You will be refunded 1 credit if eligible.', [
      { text: 'Keep booking', style: 'cancel' },
      { text: 'Cancel', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/bookings/${id}`);
          setMyBookings(bs => bs.map(b => b.id === id ? { ...b, status: 'cancelled' } : b));
        } catch { Alert.alert('Error', 'Could not cancel booking.'); }
      }},
    ]);
  };

  const firstDay    = new Date(year, month, 1).getDay();
  const firstMon    = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstMon).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const dog = dogs.find(d => d.id === selectedDog);

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Bookings</Text>

        {/* Tabs */}
        <View style={s.tabs}>
          {(['book', 'mine'] as const).map(t => (
            <TouchableOpacity
              key={t} style={[s.tab, tab === t && s.tabActive]}
              onPress={() => { setTab(t); if (t === 'mine') loadMyBookings(); }}
            >
              <Text style={[s.tabText, tab === t && s.tabTextActive]}>
                {t === 'book' ? 'New booking' : 'My bookings'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Calendar */}
        {tab === 'book' && (
          <View style={s.cal}>
            <View style={s.calHead}>
              <TouchableOpacity onPress={() => {
                if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1);
              }} style={s.calNav}>
                <Text style={s.calNavText}>‹</Text>
              </TouchableOpacity>
              <Text style={s.calMonthName}>{MONTHS[month]} {year}</Text>
              <TouchableOpacity onPress={() => {
                if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1);
              }} style={s.calNav}>
                <Text style={s.calNavText}>›</Text>
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
                    style={[s.calCell, isSelected && s.calCellSel, isPast && s.calCellPast]}
                    onPress={() => !isPast && selectDate(dateStr)}
                    disabled={isPast}
                  >
                    <Text style={[s.calCellText, isToday && s.calToday, isSelected && s.calSelText]}>
                      {day}
                    </Text>
                    {hasDot && (
                      <View style={[s.calDot, isSelected && { backgroundColor: C.dark }]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </View>

      {/* My bookings list */}
      {tab === 'mine' && (
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          {!myBookingsLoaded
            ? <ActivityIndicator color={C.gold} style={{ marginTop: 40 }} />
            : myBookings.length === 0
              ? <Text style={s.empty}>No bookings yet</Text>
              : myBookings.map(b => {
                  const st = STATUS[b.status] ?? STATUS.pending;
                  return (
                    <View key={b.id} style={s.myCard}>
                      <View style={s.myLeft}>
                        <Text style={s.myDate}>{fmtShort(b.slot_date)}</Text>
                        <Text style={s.myService}>{b.service_name}</Text>
                        <Text style={s.myDetail}>
                          {b.slot_start.slice(0, 5)}–{b.slot_end.slice(0, 5)} · {b.dog_name}
                        </Text>
                      </View>
                      <View style={s.myRight}>
                        <View style={s.statusPill}>
                          <View style={[s.statusDot, { backgroundColor: st.color }]} />
                          <Text style={[s.statusLabel, { color: st.color }]}>{st.label}</Text>
                        </View>
                        <TouchableOpacity
                          style={s.viewBtn}
                          onPress={() => router.push({ pathname: '/booking/[id]', params: { id: b.id } })}
                        >
                          <Text style={s.viewBtnText}>View</Text>
                        </TouchableOpacity>
                        {canCancel(b) && (
                          <TouchableOpacity onPress={() => cancelBooking(b.id)} style={s.cancelBtn}>
                            <Text style={s.cancelText}>Cancel</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })
          }
        </ScrollView>
      )}

      {/* Slots list */}
      {tab === 'book' && (
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          {!selectedDate ? (
            <Text style={s.empty}>Select a date to see available slots</Text>
          ) : slotsLoading ? (
            <ActivityIndicator color={C.gold} style={{ marginTop: 32 }} />
          ) : slots.length === 0 ? (
            <Text style={s.empty}>No slots available on this date</Text>
          ) : (
            <>
              <Text style={s.dayTitle}>{fmtDate(selectedDate)}</Text>
              <View style={s.slotList}>
                {slots.map((slot, i) => {
                  const full    = slot.booked_count >= slot.capacity;
                  const limited = !full && (slot.capacity - slot.booked_count) === 1;
                  return (
                    <TouchableOpacity
                      key={slot.id}
                      style={[s.slotRow, i < slots.length - 1 && s.slotBorder, full && s.slotDim]}
                      onPress={() => !full && openModal(slot)}
                      disabled={full} activeOpacity={0.7}
                    >
                      <View style={s.slotTime}>
                        <Text style={s.slotTimeText}>{fmt12(slot.start_time)}</Text>
                        <Text style={s.slotDur}>{slotDuration(slot.start_time, slot.end_time)}</Text>
                      </View>
                      <View style={s.slotInfo}>
                        <Text style={s.slotName}>{slot.service_name}</Text>
                        <Text style={s.slotCredit}>1 credit</Text>
                      </View>
                      <View style={[s.availPill,
                        full ? s.availFull : limited ? s.availLtd : s.availOpen]}>
                        <Text style={[s.availText,
                          full ? { color: C.red } : limited ? { color: C.amber } : { color: C.green }]}>
                          {full ? 'Full' : limited ? 'Last spot' : 'Open'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* Booking confirmation modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <Pressable style={s.overlay} onPress={() => setShowModal(false)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Confirm booking</Text>

            {selectedSlot && (
              <>
                <View style={s.detailCard}>
                  <DetailRow C={C} label="Service"  value={selectedSlot.service_name} />
                  <DetailRow C={C} label="Date"     value={fmtDate(selectedDate)} />
                  <DetailRow C={C} label="Time"     value={`${fmt12(selectedSlot.start_time)} – ${fmt12(selectedSlot.end_time)}`} />
                  <DetailRow C={C} label="Duration" value={slotDuration(selectedSlot.start_time, selectedSlot.end_time)} />
                  <DetailRow C={C} label="Dog"      value={dog?.name ?? '—'} last />
                </View>

                <View style={s.costRow}>
                  <Text style={s.costLabel}>Cost</Text>
                  <View style={s.costPill}>
                    <Text style={s.costVal}>1 credit</Text>
                  </View>
                </View>

                {dogs.length > 1 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.dogRow}>
                    {dogs.map(d => (
                      <TouchableOpacity
                        key={d.id}
                        style={[s.dogChip, selectedDog === d.id && s.dogChipActive]}
                        onPress={() => setSelectedDog(d.id)}
                      >
                        <Text style={[s.dogChipText, selectedDog === d.id && { color: C.dark, fontWeight: '600' }]}>
                          {d.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </>
            )}

            <TouchableOpacity
              style={[s.confirmBtn, booking && { opacity: 0.7 }]}
              onPress={doBook} disabled={booking}
            >
              {booking ? <ActivityIndicator color={C.dark} /> : <Text style={s.confirmText}>Confirm booking</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.backBtn} onPress={() => setShowModal(false)} disabled={booking}>
              <Text style={s.backText}>Go back</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function DetailRow({ C, label, value, last }: {
  C: ReturnType<typeof useColors>; label: string; value: string; last?: boolean;
}) {
  return (
    <View style={{
      flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11,
      ...(last ? {} : { borderBottomWidth: 1, borderBottomColor: C.border }),
    }}>
      <Text style={{ fontSize: 13, color: C.muted }}>{label}</Text>
      <Text style={{ fontSize: 13, color: C.cream, fontWeight: '500', textAlign: 'right', flex: 1, marginLeft: 16 }}>{value}</Text>
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root:    { flex: 1, backgroundColor: C.dark },

    header:  { backgroundColor: C.dark2, borderBottomWidth: 1, borderBottomColor: C.border,
                paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16 },
    headerTitle: { fontSize: 24, fontWeight: '700', color: C.cream, fontFamily: F.serif, marginBottom: 16 },

    tabs:        { flexDirection: 'row', backgroundColor: C.dark3, borderRadius: 12, padding: 3, marginBottom: 16 },
    tab:         { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
    tabActive:   { backgroundColor: C.dark2 },
    tabText:     { fontSize: 13, fontWeight: '500', color: C.muted },
    tabTextActive: { color: C.cream, fontWeight: '600' },

    scroll:       { flex: 1, paddingHorizontal: 20 },
    scrollContent:{ paddingBottom: 100, paddingTop: 16 },
    empty:        { color: C.muted, fontSize: 14, textAlign: 'center', marginTop: 40 },

    cal:          { },
    calHead:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    calNav:       { width: 32, height: 32, borderRadius: 10, backgroundColor: C.dark4,
                    alignItems: 'center', justifyContent: 'center' },
    calNavText:   { color: C.textDim, fontSize: 18, lineHeight: 22 },
    calMonthName: { fontSize: 15, fontWeight: '600', color: C.cream },
    calDow:       { flexDirection: 'row', marginBottom: 6 },
    calDowText:   { flex: 1, textAlign: 'center', fontSize: 11, color: C.muted },
    calGrid:      { flexDirection: 'row', flexWrap: 'wrap' },
    calCell:      { width: '14.28%', height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
    calCellSel:   { backgroundColor: C.gold },
    calCellPast:  { opacity: 0.22 },
    calCellText:  { fontSize: 13, color: C.textDim },
    calToday:     { color: C.gold, fontWeight: '700' },
    calSelText:   { color: C.dark, fontWeight: '700' },
    calDot:       { position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: 2, backgroundColor: C.gold },

    myCard:    { backgroundColor: C.dark3, borderRadius: 16, padding: 15, marginBottom: 10,
                 flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.border },
    myLeft:    { flex: 1 },
    myDate:    { fontSize: 11, fontWeight: '600', color: C.muted, textTransform: 'uppercase',
                 letterSpacing: 0.5, marginBottom: 4 },
    myService: { fontSize: 15, fontWeight: '600', color: C.cream },
    myDetail:  { fontSize: 12, color: C.muted, marginTop: 3 },
    myRight:   { alignItems: 'flex-end', gap: 7 },

    statusPill:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
    statusDot:   { width: 6, height: 6, borderRadius: 3 },
    statusLabel: { fontSize: 12, fontWeight: '600' },

    viewBtn:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9,
                   backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.goldBorder },
    viewBtnText: { fontSize: 11, fontWeight: '600', color: C.gold },
    cancelBtn:   { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9,
                   backgroundColor: C.redSoft, borderWidth: 1, borderColor: 'rgba(224,92,92,0.25)' },
    cancelText:  { fontSize: 11, fontWeight: '600', color: C.red },

    dayTitle:  { fontSize: 12, fontWeight: '600', color: C.muted, textTransform: 'uppercase',
                 letterSpacing: 0.8, marginBottom: 12 },
    slotList:  { backgroundColor: C.dark3, borderRadius: 18, borderWidth: 1, borderColor: C.border,
                 overflow: 'hidden' },
    slotRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 14 },
    slotBorder:{ borderBottomWidth: 1, borderBottomColor: C.border },
    slotDim:   { opacity: 0.4 },
    slotTime:  { minWidth: 80 },
    slotTimeText: { fontSize: 14, fontWeight: '600', color: C.cream },
    slotDur:   { fontSize: 11, color: C.muted, marginTop: 2 },
    slotInfo:  { flex: 1 },
    slotName:  { fontSize: 14, fontWeight: '500', color: C.cream },
    slotCredit:{ fontSize: 11, color: C.muted, marginTop: 2 },
    availPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
    availOpen: { backgroundColor: C.greenSoft, borderColor: 'rgba(76,175,122,0.25)' },
    availLtd:  { backgroundColor: C.amberSoft, borderColor: 'rgba(232,169,58,0.25)' },
    availFull: { backgroundColor: C.redSoft,   borderColor: 'rgba(224,92,92,0.25)' },
    availText: { fontSize: 11, fontWeight: '600' },

    overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
    sheet:       { backgroundColor: C.dark2, borderTopLeftRadius: 28, borderTopRightRadius: 28,
                   paddingHorizontal: 24, paddingBottom: 44, paddingTop: 12,
                   borderTopWidth: 1, borderTopColor: C.border },
    handle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: C.dark4,
                   alignSelf: 'center', marginBottom: 24 },
    sheetTitle:  { fontSize: 20, fontWeight: '700', color: C.cream, fontFamily: F.serif, marginBottom: 20 },
    detailCard:  { backgroundColor: C.dark3, borderRadius: 16, paddingHorizontal: 16,
                   paddingVertical: 4, marginBottom: 16, borderWidth: 1, borderColor: C.border },
    costRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
    costLabel:   { fontSize: 14, color: C.muted },
    costPill:    { backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.goldBorder,
                   paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12 },
    costVal:     { fontSize: 14, fontWeight: '700', color: C.gold },
    dogRow:      { marginBottom: 20 },
    dogChip:     { backgroundColor: C.dark3, borderWidth: 1, borderColor: C.border,
                   borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8 },
    dogChipActive: { backgroundColor: C.gold, borderColor: C.gold },
    dogChipText: { color: C.textDim, fontSize: 13 },
    confirmBtn:  { backgroundColor: C.gold, borderRadius: 16, paddingVertical: 17,
                   alignItems: 'center', marginBottom: 12 },
    confirmText: { color: C.dark, fontWeight: '700', fontSize: 16 },
    backBtn:     { alignItems: 'center', paddingVertical: 12 },
    backText:    { color: C.muted, fontSize: 15 },
  });
}
