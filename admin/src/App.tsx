import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { api } from './lib/api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Bookings from './pages/Bookings';
import Slots from './pages/Slots';

function Layout() {
  const { user, logout } = useAuthStore();
  return (
    <div className="min-h-screen flex">
      <nav className="w-52 bg-dark2 border-r border-dark3 flex flex-col p-5 shrink-0">
        <div className="mb-8">
          <p className="text-cream font-bold text-lg">Battersea <span className="text-gold italic">K9</span></p>
          <p className="text-muted text-xs mt-1">{user?.first_name ?? user?.email}</p>
        </div>
        <div className="space-y-1 flex-1">
          {([['/', '📊', 'Dashboard'], ['/clients', '👥', 'Clients'], ['/bookings', '📅', 'Bookings'], ['/slots', '🕐', 'Slots']] as [string, string, string][]).map(([to, icon, label]) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${isActive ? 'bg-gold text-dark font-semibold' : 'text-muted hover:text-cream'}`}>
              <span>{icon}</span>{label}
            </NavLink>
          ))}
        </div>
        <button onClick={logout} className="text-muted text-xs hover:text-cream transition">Sign out</button>
      </nav>
      <main className="flex-1 p-8 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/bookings" element={<Bookings />} />
          <Route path="/slots" element={<Slots />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const { user } = useAuthStore();

  // Try to rehydrate user from stored token on mount
  useEffect(() => {
    const token = localStorage.getItem('k9_admin_token');
    if (token && !user) {
      api.get('/me').then(({ data }) => {
        if (data.role === 'admin') useAuthStore.setState({ user: data });
      }).catch(() => localStorage.removeItem('k9_admin_token'));
    }
  }, []);

  return (
    <BrowserRouter>
      {user ? <Layout /> : <Login />}
    </BrowserRouter>
  );
}
