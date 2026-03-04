import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Booking {
  id: string;
  owner_name: string;
  owner_email: string;
  dog_name: string;
  service_name: string;
  slot_date: string;
  slot_start: string;
  slot_end: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  created_at: string;
}

const STATUS_COLOURS: Record<string, string> = {
  pending:   'bg-amber-900/30 text-amber-400 border border-amber-700/40',
  confirmed: 'bg-green-900/30 text-green-400 border border-green-700/40',
  completed: 'bg-blue-900/30 text-blue-400 border border-blue-700/40',
  cancelled: 'bg-red-900/30 text-red-400 border border-red-700/40',
};

const NEXT: Record<string, { label: string; next: string }[]> = {
  pending:   [{ label: 'Confirm', next: 'confirmed' }, { label: 'Cancel', next: 'cancelled' }],
  confirmed: [{ label: 'Complete', next: 'completed' }, { label: 'Cancel', next: 'cancelled' }],
  completed: [],
  cancelled: [],
};

export default function Bookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<string>('all');

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data } = await api.get('/admin/bookings');
      setBookings(data);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    await api.patch(`/admin/bookings/${id}/status`, { status });
    setBookings(bs => bs.map(b => b.id === id ? { ...b, status: status as Booking['status'] } : b));
  }

  const visible = filter === 'all' ? bookings : bookings.filter(b => b.status === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-cream text-2xl font-bold">Bookings</h1>
        <div className="flex gap-2">
          {['all', 'pending', 'confirmed', 'completed', 'cancelled'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition ${filter === f ? 'bg-gold text-dark' : 'bg-dark3 text-muted hover:text-cream'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="bg-dark2 rounded-xl p-12 text-center">
          <p className="text-muted">No bookings found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(b => (
            <div key={b.id} className="bg-dark2 border border-dark3 rounded-xl p-4 flex items-center gap-4">
              {/* Date block */}
              <div className="w-14 shrink-0 text-center">
                <p className="text-gold font-bold text-lg leading-none">
                  {new Date(b.slot_date + 'T00:00:00').getDate()}
                </p>
                <p className="text-muted text-xs">
                  {new Date(b.slot_date + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short' })}
                </p>
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-cream font-semibold text-sm">{b.dog_name}</p>
                  <span className="text-muted text-xs">·</span>
                  <p className="text-muted text-xs">{b.owner_name} ({b.owner_email})</p>
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <p className="text-textDim text-xs">{b.service_name}</p>
                  <span className="text-dark3 text-xs">|</span>
                  <p className="text-textDim text-xs">{b.slot_start.slice(0,5)} – {b.slot_end.slice(0,5)}</p>
                </div>
              </div>

              {/* Status badge */}
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize shrink-0 ${STATUS_COLOURS[b.status]}`}>
                {b.status}
              </span>

              {/* Action buttons */}
              <div className="flex gap-2 shrink-0">
                {NEXT[b.status].map(({ label, next }) => (
                  <button key={next} onClick={() => updateStatus(b.id, next)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                      next === 'cancelled' || next === 'cancel'
                        ? 'bg-red-900/40 text-red-400 hover:bg-red-900/70'
                        : 'bg-gold/20 text-gold hover:bg-gold/40'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
