import { useState } from 'react';
import { useAuthStore } from '../store/authStore';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const login = useAuthStore((s) => s.login);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-cream mb-1">Battersea <span className="text-gold italic">K9</span></h1>
        <p className="text-muted text-sm mb-8">Admin dashboard</p>
        <form onSubmit={submit} className="space-y-3">
          <input className="w-full bg-dark2 border border-dark3 rounded-xl px-4 py-3 text-cream placeholder-muted focus:outline-none focus:border-gold"
            type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="w-full bg-dark2 border border-dark3 rounded-xl px-4 py-3 text-cream placeholder-muted focus:outline-none focus:border-gold"
            type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button className="w-full bg-gold text-dark font-bold rounded-xl py-3 hover:opacity-90 transition disabled:opacity-50"
            type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div>
    </div>
  );
}
