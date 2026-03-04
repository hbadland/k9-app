import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Dog {
  id: string; name: string; breed: string | null; age_months: number | null;
  vet_name: string | null; vet_phone: string | null;
  medical_notes: string | null; behavioural_notes: string | null;
}
interface Client {
  id: string; email: string; first_name: string | null; last_name: string | null;
  phone: string | null; address: string | null; status: string;
  admin_notes: string | null; created_at: string; dogs: Dog[] | null;
}

const STATUS_COLOURS: Record<string, string> = {
  pending:  'bg-amber-500/20 text-amber-400',
  active:   'bg-green-500/20  text-green-400',
  inactive: 'bg-zinc-500/20   text-zinc-400',
};

export default function Clients() {
  const [clients, setClients]   = useState<Client[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notes, setNotes]       = useState<Record<string, string>>({});
  const [saving, setSaving]     = useState<string | null>(null);

  const fetch = () =>
    api.get('/admin/clients')
      .then(({ data }) => {
        setClients(data);
        const n: Record<string, string> = {};
        data.forEach((c: Client) => { n[c.id] = c.admin_notes ?? ''; });
        setNotes(n);
      })
      .finally(() => setLoading(false));

  useEffect(() => { fetch(); }, []);

  const saveNotes = async (id: string) => {
    setSaving(id);
    await api.post(`/admin/clients/${id}/notes`, { notes: notes[id] ?? '' });
    setSaving(null);
  };

  const setStatus = async (id: string, status: string) => {
    await api.patch(`/admin/clients/${id}/status`, { status });
    setClients((prev) => prev.map((c) => c.id === id ? { ...c, status } : c));
  };

  if (loading) return <p className="text-muted">Loading…</p>;

  return (
    <div>
      <h2 className="text-xl font-bold text-cream mb-6">Clients ({clients.length})</h2>
      <div className="space-y-3 max-w-2xl">
        {clients.map((c) => (
          <div key={c.id} className="bg-dark2 border border-dark3 rounded-2xl overflow-hidden">
            {/* Header row */}
            <button className="w-full text-left px-5 py-4 flex items-center justify-between gap-3"
              onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
              <div className="flex-1 min-w-0">
                <p className="text-cream font-semibold truncate">
                  {[c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unnamed'}
                </p>
                <p className="text-muted text-sm truncate">{c.email}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${STATUS_COLOURS[c.status] ?? STATUS_COLOURS.pending}`}>
                {c.status}
              </span>
              <span className="text-muted text-sm shrink-0">
                {c.dogs?.length ?? 0} dog{(c.dogs?.length ?? 0) !== 1 ? 's' : ''}
              </span>
            </button>

            {/* Expanded detail */}
            {expanded === c.id && (
              <div className="border-t border-dark3 px-5 py-5 space-y-5">
                {/* Contact */}
                <div className="space-y-1 text-sm">
                  {c.phone   && <p className="text-muted">📞 {c.phone}</p>}
                  {c.address && <p className="text-muted">📍 {c.address}</p>}
                  <p className="text-muted text-xs">Joined {new Date(c.created_at).toLocaleDateString('en-GB')}</p>
                </div>

                {/* Status control */}
                <div>
                  <p className="text-muted text-xs uppercase tracking-wider mb-2">Status</p>
                  <div className="flex gap-2">
                    {(['pending', 'active', 'inactive'] as const).map((s) => (
                      <button key={s}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition
                          ${c.status === s ? 'bg-gold text-dark border-gold' : 'border-dark3 text-muted hover:text-cream'}`}
                        onClick={() => setStatus(c.id, s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dogs */}
                {(c.dogs?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-muted text-xs uppercase tracking-wider mb-2">Dogs</p>
                    <div className="space-y-2">
                      {c.dogs!.map((d) => (
                        <div key={d.id} className="bg-dark3 rounded-xl px-4 py-3">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 rounded-full bg-gold flex items-center justify-center text-dark font-bold text-sm shrink-0">
                              {d.name[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="text-cream text-sm font-medium">{d.name}</p>
                              <p className="text-muted text-xs">
                                {[d.breed, d.age_months ? `${d.age_months}mo` : null].filter(Boolean).join(' · ') || 'No details'}
                              </p>
                            </div>
                          </div>
                          {d.vet_name && <p className="text-muted text-xs">Vet: {d.vet_name}{d.vet_phone ? ` · ${d.vet_phone}` : ''}</p>}
                          {d.medical_notes     && <p className="text-muted text-xs mt-1">Medical: {d.medical_notes}</p>}
                          {d.behavioural_notes && <p className="text-muted text-xs mt-1">Behaviour: {d.behavioural_notes}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Admin notes */}
                <div>
                  <p className="text-muted text-xs uppercase tracking-wider mb-2">Admin notes</p>
                  <textarea
                    className="w-full bg-dark3 border border-dark3 rounded-xl px-4 py-3 text-cream text-sm resize-none focus:outline-none focus:border-gold"
                    rows={3} placeholder="Internal notes (not visible to client)"
                    value={notes[c.id] ?? ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [c.id]: e.target.value }))} />
                  <button
                    className="mt-2 px-4 py-2 bg-gold text-dark text-xs font-bold rounded-lg hover:opacity-90 transition disabled:opacity-50"
                    onClick={() => saveNotes(c.id)} disabled={saving === c.id}>
                    {saving === c.id ? 'Saving…' : 'Save notes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {!clients.length && <p className="text-muted">No clients yet.</p>}
      </div>
    </div>
  );
}
