import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { startGpsStream } from '../lib/socket';

interface Booking {
  id: string;
  dog_id: string;
  owner_name: string;
  owner_email: string;
  owner_address?: string;
  owner_phone?: string;
  dog_name: string;
  service_name: string;
  slot_date: string;
  slot_start: string;
  slot_end: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
}

interface Message {
  id: string;
  sender_role: 'admin' | 'owner';
  body?: string;
  photo_url?: string;
  type: 'message' | 'update';
  created_at: string;
}

const STATUS_COLOURS: Record<string, string> = {
  pending:     'bg-amber-900/30 text-amber-400 border border-amber-700/40',
  confirmed:   'bg-green-900/30 text-green-400 border border-green-700/40',
  in_progress: 'bg-blue-900/30 text-blue-400 border border-blue-700/40',
  completed:   'bg-dark3 text-muted border border-dark3',
  cancelled:   'bg-red-900/30 text-red-400 border border-red-700/40',
};

const NEXT: Record<string, { label: string; next: string }[]> = {
  pending:     [{ label: 'Confirm',    next: 'confirmed'   }, { label: 'Cancel', next: 'cancelled' }],
  confirmed:   [{ label: 'Start Walk', next: 'in_progress' }, { label: 'Cancel', next: 'cancelled' }],
  in_progress: [{ label: 'Complete',   next: 'completed'   }, { label: 'Cancel', next: 'cancelled' }],
  completed:   [],
  cancelled:   [],
};

function Skeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {[1, 2, 3].map(i => <div key={i} className="h-16 bg-dark3 rounded-xl" />)}
    </div>
  );
}

export default function Bookings() {
  const [bookings, setBookings]       = useState<Booking[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState<string>('all');
  const [openThread, setOpenThread]   = useState<string | null>(null);
  const [threads, setThreads]         = useState<Record<string, Message[]>>({});
  const [msgInput, setMsgInput]       = useState<Record<string, string>>({});
  const [photoPreview, setPhotoPreview] = useState<Record<string, string>>({});
  const [sending, setSending]         = useState<Record<string, boolean>>({});
  const [gpsActive, setGpsActive]     = useState<Record<string, boolean>>({});
  const [gpsError, setGpsError]       = useState<Record<string, string>>({});
  const gpsStopFns                    = useRef<Record<string, () => void>>({});
  const fileRefs                      = useRef<Record<string, HTMLInputElement | null>>({});
  const adminToken = localStorage.getItem('k9_admin_token') ?? '';

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

  async function toggleThread(id: string) {
    if (openThread === id) { setOpenThread(null); return; }
    setOpenThread(id);
    if (!threads[id]) {
      const { data } = await api.get(`/admin/bookings/${id}/messages`);
      setThreads(t => ({ ...t, [id]: data }));
    }
  }

  function handlePhoto(id: string, file: File) {
    const reader = new FileReader();
    reader.onload = e => {
      setPhotoPreview(p => ({ ...p, [id]: e.target!.result as string }));
    };
    reader.readAsDataURL(file);
  }

  async function sendMessage(bookingId: string, type: 'message' | 'update') {
    const body = msgInput[bookingId]?.trim();
    const photo_url = photoPreview[bookingId];
    if (!body && !photo_url) return;
    setSending(s => ({ ...s, [bookingId]: true }));
    try {
      const { data } = await api.post(`/admin/bookings/${bookingId}/messages`, { body, photo_url, type });
      setThreads(t => ({ ...t, [bookingId]: [...(t[bookingId] ?? []), data] }));
      setMsgInput(m => ({ ...m, [bookingId]: '' }));
      setPhotoPreview(p => { const n = { ...p }; delete n[bookingId]; return n; });
      if (fileRefs.current[bookingId]) fileRefs.current[bookingId]!.value = '';
    } finally {
      setSending(s => ({ ...s, [bookingId]: false }));
    }
  }

  function toggleGps(b: Booking) {
    if (gpsActive[b.id]) {
      gpsStopFns.current[b.id]?.();
      delete gpsStopFns.current[b.id];
      setGpsActive(prev => ({ ...prev, [b.id]: false }));
      setGpsError(prev => ({ ...prev, [b.id]: '' }));
    } else {
      const stop = startGpsStream({
        token: adminToken,
        dogId: b.dog_id,
        bookingId: b.id,
        onError: (err) => setGpsError(prev => ({ ...prev, [b.id]: err })),
      });
      gpsStopFns.current[b.id] = stop;
      setGpsActive(prev => ({ ...prev, [b.id]: true }));
    }
  }

  const visible = filter === 'all' ? bookings : bookings.filter(b => b.status === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-cream text-2xl font-bold">Bookings</h1>
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition ${filter === f ? 'bg-gold text-dark' : 'bg-dark3 text-muted hover:text-cream'}`}>
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Skeleton />
      ) : visible.length === 0 ? (
        <div className="bg-dark2 rounded-xl p-12 text-center">
          <p className="text-muted">No bookings found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(b => (
            <div key={b.id} className="bg-dark2 border border-dark3 rounded-xl overflow-hidden">
              {/* Main row */}
              <div className="p-4 flex items-center gap-4">
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
                    <p className="text-textDim text-xs">{b.slot_start.slice(0, 5)} – {b.slot_end.slice(0, 5)}</p>
                  </div>
                  {b.owner_address ? (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-gold text-xs font-semibold uppercase tracking-wide">Pickup</span>
                      <span className="text-muted text-[10px]">·</span>
                      <p className="text-textDim text-xs truncate">{b.owner_address}</p>
                      {b.owner_phone && (
                        <>
                          <span className="text-muted text-[10px]">·</span>
                          <a href={`tel:${b.owner_phone}`} className="text-gold/80 text-xs hover:text-gold transition">{b.owner_phone}</a>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted text-xs mt-1 italic">No pickup address on file</p>
                  )}
                </div>

                {/* Status badge */}
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize shrink-0 ${STATUS_COLOURS[b.status]}`}>
                  {b.status.replace('_', ' ')}
                </span>

                {/* Action buttons */}
                <div className="flex gap-2 shrink-0 flex-wrap">
                  {(NEXT[b.status] ?? []).map(({ label, next }) => (
                    <button key={next} onClick={() => updateStatus(b.id, next)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                        next === 'cancelled'
                          ? 'bg-red-900/40 text-red-400 hover:bg-red-900/70'
                          : 'bg-gold/20 text-gold hover:bg-gold/40'
                      }`}>
                      {label}
                    </button>
                  ))}

                  {/* Real GPS streaming (in_progress only) */}
                  {b.status === 'in_progress' && (
                    <button onClick={() => toggleGps(b)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                        gpsActive[b.id]
                          ? 'bg-green-900/40 text-green-400 hover:bg-green-900/70'
                          : 'bg-dark3 text-muted hover:text-cream'
                      }`}
                      title={gpsActive[b.id] ? 'Stop GPS' : 'Start GPS streaming'}>
                      {gpsActive[b.id] ? '📍 Streaming GPS' : '📍 Stream GPS'}
                    </button>
                  )}
                  {gpsError[b.id] && (
                    <span className="text-red-400 text-xs">{gpsError[b.id]}</span>
                  )}

                  {/* Toggle thread */}
                  <button onClick={() => toggleThread(b.id)}
                    className="px-3 py-1 rounded-lg text-xs font-semibold bg-dark3 text-muted hover:text-cream transition">
                    {openThread === b.id ? '▾ Updates' : '▸ Updates'}
                  </button>
                </div>
              </div>

              {/* Message thread panel */}
              {openThread === b.id && (
                <div className="border-t border-dark3 bg-dark p-4 space-y-3">
                  {/* Thread messages */}
                  {!threads[b.id] ? (
                    <p className="text-muted text-xs">Loading…</p>
                  ) : threads[b.id].length === 0 ? (
                    <p className="text-muted text-xs">No updates yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {threads[b.id].map(msg => (
                        <div key={msg.id}
                          className={`flex ${msg.sender_role === 'owner' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-xs rounded-xl px-3 py-2 text-xs ${
                            msg.sender_role === 'admin'
                              ? 'border-l-2 border-gold bg-dark2 text-cream'
                              : 'bg-dark3 text-textDim'
                          }`}>
                            {msg.body && <p>{msg.body}</p>}
                            {msg.photo_url && (
                              <img src={msg.photo_url} alt="update"
                                className="mt-1 rounded-lg max-w-full max-h-40 object-cover" />
                            )}
                            <p className="text-muted text-[10px] mt-1">
                              {new Date(msg.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                              {msg.type === 'update' ? ' · photo update' : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Photo preview */}
                  {photoPreview[b.id] && (
                    <div className="relative inline-block">
                      <img src={photoPreview[b.id]} alt="preview"
                        className="h-20 w-20 object-cover rounded-lg border border-dark3" />
                      <button
                        onClick={() => {
                          setPhotoPreview(p => { const n = { ...p }; delete n[b.id]; return n; });
                          if (fileRefs.current[b.id]) fileRefs.current[b.id]!.value = '';
                        }}
                        className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                        ×
                      </button>
                    </div>
                  )}

                  {/* Input row */}
                  <div className="flex gap-2 items-end">
                    <textarea
                      rows={2}
                      value={msgInput[b.id] ?? ''}
                      onChange={e => setMsgInput(m => ({ ...m, [b.id]: e.target.value }))}
                      placeholder="Type a message or update…"
                      className="flex-1 bg-dark3 border border-dark3 rounded-lg px-3 py-2 text-cream text-xs placeholder-muted resize-none focus:outline-none focus:border-gold/50"
                    />
                    {/* Photo upload */}
                    <label className="cursor-pointer text-muted hover:text-gold transition text-lg leading-none" title="Attach photo">
                      📎
                      <input type="file" accept="image/*" className="hidden"
                        ref={el => { fileRefs.current[b.id] = el; }}
                        onChange={e => e.target.files?.[0] && handlePhoto(b.id, e.target.files[0])} />
                    </label>
                    <button
                      onClick={() => sendMessage(b.id, photoPreview[b.id] ? 'update' : 'message')}
                      disabled={sending[b.id] || (!msgInput[b.id]?.trim() && !photoPreview[b.id])}
                      className="px-3 py-2 rounded-lg text-xs font-semibold bg-gold/20 text-gold hover:bg-gold/40 disabled:opacity-40 transition">
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
