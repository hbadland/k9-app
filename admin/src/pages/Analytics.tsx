import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface MonthlyTrend { month: string; credits_sold: number; bookings: number; }
interface TopClient { id: string; email: string; first_name: string | null; last_name: string | null; booking_count: number; }
interface Analytics {
  this_month: { credits_sold: number; credits_used: number };
  monthly_trends: MonthlyTrend[];
  top_clients: TopClient[];
  all_time: { total_credits_sold: number; total_credits_used: number };
}

export default function Analytics() {
  const [data, setData]     = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/analytics')
      .then(({ data }) => setData(data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-muted">Loading analytics…</p>;
  if (!data)   return <p className="text-red-400">Failed to load analytics.</p>;

  const maxSold = Math.max(...data.monthly_trends.map(t => t.credits_sold), 1);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-cream">Analytics</h1>

      {/* This month stats */}
      <div>
        <h2 className="text-xs uppercase tracking-widest text-muted mb-4">This month</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Credits sold" value={data.this_month?.credits_sold ?? 0} />
          <StatCard label="Credits used" value={data.this_month?.credits_used ?? 0} />
          <StatCard label="All-time sold" value={data.all_time?.total_credits_sold ?? 0} />
          <StatCard label="All-time used" value={data.all_time?.total_credits_used ?? 0} />
        </div>
      </div>

      {/* Monthly trend chart */}
      <div className="bg-dark2 border border-dark3 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-cream mb-5">Monthly Credits (last 6 months)</h2>
        {data.monthly_trends.length === 0 ? (
          <p className="text-muted text-sm">No data yet.</p>
        ) : (
          <div className="flex items-end gap-3 h-40">
            {data.monthly_trends.map((t) => (
              <div key={t.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-muted">{t.credits_sold}</span>
                <div
                  className="w-full bg-gold/80 rounded-t-md transition-all"
                  style={{ height: `${Math.max((t.credits_sold / maxSold) * 120, 4)}px` }}
                />
                <span className="text-[10px] text-muted whitespace-nowrap">
                  {new Date(t.month + '-01').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top clients */}
      <div className="bg-dark2 border border-dark3 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-dark3">
          <h2 className="text-sm font-semibold text-cream">Top Clients (last 30 days)</h2>
        </div>
        {data.top_clients.length === 0 ? (
          <p className="text-muted text-sm p-5">No bookings in the last 30 days.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark3 text-muted text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3">Client</th>
                <th className="text-right px-5 py-3">Bookings</th>
              </tr>
            </thead>
            <tbody>
              {data.top_clients.map((c, i) => (
                <tr key={c.id} className={i < data.top_clients.length - 1 ? 'border-b border-dark3' : ''}>
                  <td className="px-5 py-3">
                    <p className="text-cream font-medium">
                      {[c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unnamed'}
                    </p>
                    <p className="text-muted text-xs">{c.email}</p>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-gold font-bold text-lg">{c.booking_count}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-dark2 border border-dark3 rounded-2xl p-5">
      <p className="text-muted text-xs uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-bold text-gold">{value}</p>
    </div>
  );
}
