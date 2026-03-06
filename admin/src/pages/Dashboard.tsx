import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Booking {
  id: string;
  owner_name: string;
  dog_name: string;
  service_name: string;
  slot_date: string;
  slot_start: string;
  status: string;
}

interface Client { id: string; }

const STATUS_COLOURS: Record<string, string> = {
  pending:     'bg-amber-900/30 text-amber-400 border border-amber-700/40',
  confirmed:   'bg-green-900/30 text-green-400 border border-green-700/40',
  in_progress: 'bg-blue-900/30 text-blue-400 border border-blue-700/40',
  completed:   'bg-dark3 text-muted border border-dark3',
  cancelled:   'bg-red-900/30 text-red-400 border border-red-700/40',
};

function Skeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {[1, 2, 3].map(i => <div key={i} className="h-16 bg-dark3 rounded-xl" />)}
    </div>
  );
}

export default function Dashboard() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [clientCount, setClientCount] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      api.get('/admin/bookings'),
      api.get('/admin/clients'),
    ]).then(([{ data: b }, { data: c }]) => {
      setBookings(b);
      setClientCount(c.length);
    }).catch(() => {});
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);

  const todayCount   = bookings?.filter(b => b.slot_date === today).length ?? null;
  const pendingCount = bookings?.filter(b => b.status === 'pending').length ?? null;
  const liveCount    = bookings?.filter(b => b.status === 'in_progress').length ?? null;
  const monthDone    = bookings?.filter(b => b.status === 'completed' && b.slot_date.startsWith(thisMonth)).length ?? null;

  const recent = bookings
    ? [...bookings].sort((a, b) => b.slot_date.localeCompare(a.slot_date)).slice(0, 5)
    : null;

  async function confirm(id: string) {
    await api.patch(`/admin/bookings/${id}/status`, { status: 'confirmed' });
    setBookings(bs => bs!.map(b => b.id === id ? { ...b, status: 'confirmed' } : b));
  }

  const statCards = [
    { label: "Today's walks", value: todayCount },
    { label: 'Pending',       value: pendingCount },
    { label: 'Live walks',    value: liveCount },
    { label: 'Clients',       value: clientCount },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold text-cream mb-6">Overview</h2>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(({ label, value }) => (
          <div key={label} className="bg-dark2 border border-dark3 rounded-2xl p-5">
            <p className="text-muted text-xs uppercase tracking-wider mb-1">{label}</p>
            {value === null
              ? <div className="animate-pulse h-8 w-12 bg-dark3 rounded mt-1" />
              : <p className="text-3xl font-bold text-gold">{value}</p>
            }
          </div>
        ))}
      </div>

      {/* This month strip */}
      {monthDone !== null && (
        <div className="bg-dark2 border border-dark3 rounded-xl px-5 py-3 mb-6 inline-flex items-center gap-2">
          <span className="text-gold text-sm font-semibold">{monthDone}</span>
          <span className="text-muted text-sm">walks completed this month</span>
        </div>
      )}

      {/* Recent bookings */}
      <h3 className="text-cream font-semibold mb-3">Recent Bookings</h3>
      {recent === null ? (
        <Skeleton />
      ) : recent.length === 0 ? (
        <p className="text-muted text-sm">No bookings yet.</p>
      ) : (
        <div className="bg-dark2 border border-dark3 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark3 text-muted text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3">Dog</th>
                <th className="text-left px-4 py-3">Owner</th>
                <th className="text-left px-4 py-3">Service</th>
                <th className="text-left px-4 py-3">Time</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {recent.map((b, i) => (
                <tr key={b.id} className={`${i < recent.length - 1 ? 'border-b border-dark3' : ''}`}>
                  <td className="px-4 py-3 text-cream font-medium">{b.dog_name}</td>
                  <td className="px-4 py-3 text-textDim">{b.owner_name}</td>
                  <td className="px-4 py-3 text-textDim">{b.service_name}</td>
                  <td className="px-4 py-3 text-textDim">
                    {new Date(b.slot_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    {' '}
                    {b.slot_start.slice(0, 5)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_COLOURS[b.status] ?? ''}`}>
                      {b.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {b.status === 'pending' && (
                      <button onClick={() => confirm(b.id)}
                        className="px-3 py-1 rounded-lg text-xs font-semibold bg-gold/20 text-gold hover:bg-gold/40 transition">
                        Confirm
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
