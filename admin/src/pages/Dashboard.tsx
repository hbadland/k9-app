import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Stats { clients: number; dogs: number; }

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.get('/dogs/admin/clients').then(({ data }) => {
      const dogs = data.reduce((acc: number, c: any) => acc + (c.dogs?.length ?? 0), 0);
      setStats({ clients: data.length, dogs });
    }).catch(() => {});
  }, []);

  return (
    <div>
      <h2 className="text-xl font-bold text-cream mb-6">Overview</h2>
      <div className="grid grid-cols-2 gap-4 max-w-sm">
        <div className="bg-dark2 border border-dark3 rounded-2xl p-5">
          <p className="text-muted text-xs uppercase tracking-wider mb-1">Clients</p>
          <p className="text-3xl font-bold text-gold">{stats?.clients ?? '—'}</p>
        </div>
        <div className="bg-dark2 border border-dark3 rounded-2xl p-5">
          <p className="text-muted text-xs uppercase tracking-wider mb-1">Dogs</p>
          <p className="text-3xl font-bold text-gold">{stats?.dogs ?? '—'}</p>
        </div>
      </div>
      <div className="mt-8 bg-dark2 border border-dark3 rounded-2xl p-5 max-w-sm">
        <p className="text-muted text-xs uppercase tracking-wider mb-1">Bookings</p>
        <p className="text-cream text-sm">Coming in Phase 3</p>
      </div>
    </div>
  );
}
