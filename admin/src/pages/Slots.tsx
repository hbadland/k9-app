import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Service {
  id: string; name: string; type: string; duration_minutes: number; price_pence: number;
}

interface Slot {
  id: string; service_id: string; date: string; start_time: string;
  end_time: string; capacity: number;
  service_name: string; booked_count: number;
}

function fmt(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Slots() {
  const [services, setServices]     = useState<Service[]>([]);
  const [slots, setSlots]           = useState<Slot[]>([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<'single' | 'bulk'>('single');

  // Single form state
  const [serviceId, setServiceId]   = useState('');
  const [date, setDate]             = useState('');
  const [start, setStart]           = useState('');
  const [end, setEnd]               = useState('');
  const [capacity, setCapacity]     = useState(1);
  const [saving, setSaving]         = useState(false);
  const [err, setErr]               = useState('');

  // Bulk form state
  const [bulkDays, setBulkDays]       = useState<number[]>([]);
  const [bulkFromDate, setBulkFromDate] = useState('');
  const [bulkToDate, setBulkToDate]   = useState('');
  const [bulkSaving, setBulkSaving]   = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/bookings/services'),
      api.get('/admin/slots'),
    ]).then(([{ data: svcs }, { data: slts }]) => {
      setServices(svcs);
      setSlots(slts);
      if (svcs.length) setServiceId(svcs[0].id);
    }).finally(() => setLoading(false));
  }, []);

  async function createSlot(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (!date || !start || !end || !serviceId) { setErr('All fields required'); return; }
    setSaving(true);
    try {
      const { data } = await api.post('/admin/slots', {
        service_id: serviceId,
        date,
        start_time: start,
        end_time:   end,
        capacity,
      });
      // Attach service name for display
      const svc = services.find(s => s.id === serviceId);
      setSlots(prev => [...prev, { ...data, service_name: svc?.name ?? '', booked_count: 0 }]
        .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)));
      setDate(''); setStart(''); setEnd(''); setCapacity(1);
    } catch {
      setErr('Failed to create slot.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteSlot(id: string) {
    await api.delete(`/admin/slots/${id}`);
    setSlots(prev => prev.filter(s => s.id !== id));
  }

  async function createBulk(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (!bulkDays.length || !bulkFromDate || !bulkToDate || !start || !end || !serviceId) {
      setErr('All fields required'); return;
    }
    setBulkSaving(true);
    try {
      const { data } = await api.post('/admin/slots/bulk', {
        service_id: serviceId, days_of_week: bulkDays,
        start_time: start, end_time: end, capacity,
        from_date: bulkFromDate, to_date: bulkToDate,
      });
      const svc = services.find(s => s.id === serviceId);
      const newSlots = data.slots.map((slot: Slot) => ({ ...slot, service_name: svc?.name ?? '', booked_count: 0 }));
      setSlots(prev => [...prev, ...newSlots].sort((a, b) => a.date.localeCompare(b.date)));
      alert(`Created ${data.created} slot(s)`);
      setBulkDays([]); setBulkFromDate(''); setBulkToDate('');
    } catch { setErr('Failed to create bulk slots.'); }
    finally { setBulkSaving(false); }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-cream text-2xl font-bold">Availability Slots</h1>

      {/* Tab toggle */}
      <div className="flex gap-2">
        {(['single', 'bulk'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition
              ${tab === t ? 'bg-gold text-dark' : 'bg-dark3 text-muted hover:text-cream'}`}>
            {t === 'single' ? 'Single Slot' : 'Recurring / Bulk'}
          </button>
        ))}
      </div>

      {/* Create form */}
      <div className="bg-dark2 border border-dark3 rounded-xl p-6">
        <h2 className="text-cream font-semibold mb-4">{tab === 'single' ? 'Add New Slot' : 'Create Recurring Slots'}</h2>
        {tab === 'bulk' && (
          <form onSubmit={createBulk} className="grid grid-cols-2 gap-4 md:grid-cols-3 mb-0">
            <div className="col-span-2 md:col-span-3">
              <label className="text-muted text-xs uppercase tracking-wider block mb-2">Days of week</label>
              <div className="flex gap-2 flex-wrap">
                {DAYS.map((day, i) => (
                  <button key={i} type="button"
                    onClick={() => setBulkDays(prev => prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i])}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition
                      ${bulkDays.includes(i) ? 'bg-gold text-dark border-gold' : 'border-dark3 text-muted hover:text-cream'}`}>
                    {day}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-muted text-xs uppercase tracking-wider block mb-1">From date</label>
              <input type="date" value={bulkFromDate} onChange={e => setBulkFromDate(e.target.value)}
                className="w-full bg-dark3 border border-dark4 rounded-lg px-3 py-2 text-cream text-sm focus:outline-none focus:border-gold" />
            </div>
            <div>
              <label className="text-muted text-xs uppercase tracking-wider block mb-1">To date</label>
              <input type="date" value={bulkToDate} onChange={e => setBulkToDate(e.target.value)}
                className="w-full bg-dark3 border border-dark4 rounded-lg px-3 py-2 text-cream text-sm focus:outline-none focus:border-gold" />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className="text-muted text-xs uppercase tracking-wider block mb-1">Service</label>
              <select value={serviceId} onChange={e => setServiceId(e.target.value)}
                className="w-full bg-dark3 border border-dark4 rounded-lg px-3 py-2 text-cream text-sm focus:outline-none focus:border-gold">
                {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-muted text-xs uppercase tracking-wider block mb-1">Start</label>
              <input type="time" value={start} onChange={e => setStart(e.target.value)}
                className="w-full bg-dark3 border border-dark4 rounded-lg px-3 py-2 text-cream text-sm focus:outline-none focus:border-gold" />
            </div>
            <div>
              <label className="text-muted text-xs uppercase tracking-wider block mb-1">End</label>
              <input type="time" value={end} onChange={e => setEnd(e.target.value)}
                className="w-full bg-dark3 border border-dark4 rounded-lg px-3 py-2 text-cream text-sm focus:outline-none focus:border-gold" />
            </div>
            <div>
              <label className="text-muted text-xs uppercase tracking-wider block mb-1">Capacity</label>
              <input type="number" min={1} max={20} value={capacity} onChange={e => setCapacity(Number(e.target.value))}
                className="w-full bg-dark3 border border-dark4 rounded-lg px-3 py-2 text-cream text-sm focus:outline-none focus:border-gold" />
            </div>
            <div className="col-span-2 md:col-span-3 flex items-center gap-4">
              <button type="submit" disabled={bulkSaving}
                className="px-5 py-2 bg-gold text-dark font-semibold rounded-lg text-sm hover:opacity-90 transition disabled:opacity-50">
                {bulkSaving ? 'Creating…' : 'Create Recurring Slots'}
              </button>
              {err && <p className="text-red-400 text-sm">{err}</p>}
            </div>
          </form>
        )}

        {tab === 'single' && (
        <form onSubmit={createSlot} className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <div className="col-span-2 md:col-span-1">
            <label className="text-muted text-xs uppercase tracking-wider block mb-1">Service</label>
            <select value={serviceId} onChange={e => setServiceId(e.target.value)}
              className="w-full bg-dark3 border border-dark4 rounded-lg px-3 py-2 text-cream text-sm focus:outline-none focus:border-gold">
              {services.map(s => (
                <option key={s.id} value={s.id}>{s.name} — {fmt(s.price_pence)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-muted text-xs uppercase tracking-wider block mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full bg-dark3 border border-dark4 rounded-lg px-3 py-2 text-cream text-sm focus:outline-none focus:border-gold" />
          </div>

          <div>
            <label className="text-muted text-xs uppercase tracking-wider block mb-1">Start</label>
            <input type="time" value={start} onChange={e => setStart(e.target.value)}
              className="w-full bg-dark3 border border-dark4 rounded-lg px-3 py-2 text-cream text-sm focus:outline-none focus:border-gold" />
          </div>

          <div>
            <label className="text-muted text-xs uppercase tracking-wider block mb-1">End</label>
            <input type="time" value={end} onChange={e => setEnd(e.target.value)}
              className="w-full bg-dark3 border border-dark4 rounded-lg px-3 py-2 text-cream text-sm focus:outline-none focus:border-gold" />
          </div>

          <div>
            <label className="text-muted text-xs uppercase tracking-wider block mb-1">Capacity</label>
            <input type="number" min={1} max={20} value={capacity} onChange={e => setCapacity(Number(e.target.value))}
              className="w-full bg-dark3 border border-dark4 rounded-lg px-3 py-2 text-cream text-sm focus:outline-none focus:border-gold" />
          </div>

          <div className="col-span-2 md:col-span-3 flex items-center gap-4">
            <button type="submit" disabled={saving}
              className="px-5 py-2 bg-gold text-dark font-semibold rounded-lg text-sm hover:bg-goldLight transition disabled:opacity-50">
              {saving ? 'Saving…' : 'Create Slot'}
            </button>
            {err && <p className="text-red-400 text-sm">{err}</p>}
          </div>
        </form>
        )}
      </div>

      {/* Slots list */}
      {loading ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : slots.length === 0 ? (
        <div className="bg-dark2 rounded-xl p-12 text-center">
          <p className="text-muted">No slots created yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {slots.map(slot => {
            const available = slot.capacity - (slot.booked_count ?? 0);
            const full = available <= 0;
            return (
              <div key={slot.id} className="bg-dark2 border border-dark3 rounded-xl px-4 py-3 flex items-center gap-4">
                {/* Date */}
                <div className="w-14 text-center shrink-0">
                  <p className="text-gold font-bold text-base leading-none">
                    {new Date(slot.date + 'T00:00:00').getDate()}
                  </p>
                  <p className="text-muted text-xs">
                    {new Date(slot.date + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short' })}
                  </p>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-cream text-sm font-semibold">{slot.service_name}</p>
                  <p className="text-muted text-xs mt-0.5">{slot.start_time.slice(0,5)} – {slot.end_time.slice(0,5)}</p>
                </div>

                {/* Capacity pill */}
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${
                  full ? 'bg-red-900/30 text-red-400 border border-red-700/40'
                       : 'bg-green-900/30 text-green-400 border border-green-700/40'
                }`}>
                  {available}/{slot.capacity} free
                </span>

                {/* Delete */}
                <button onClick={() => deleteSlot(slot.id)}
                  className="shrink-0 text-muted hover:text-red-400 transition text-lg leading-none px-1"
                  title="Delete slot">
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
