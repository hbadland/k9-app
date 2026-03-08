import { create } from 'zustand';
import { api, setAuthToken } from '../lib/api';

interface User { id: string; email: string; role: string; first_name: string | null; }

interface AuthState {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    if (data.user.role !== 'admin') throw new Error('Admin access only');
    localStorage.setItem('k9_admin_token', data.accessToken);
    localStorage.setItem('k9_admin_refresh', data.refreshToken);
    setAuthToken(data.accessToken);
    set({ user: data.user });
  },

  logout: () => {
    localStorage.removeItem('k9_admin_token');
    localStorage.removeItem('k9_admin_refresh');
    setAuthToken(null);
    set({ user: null });
  },
}));

// Rehydrate token on page load
const stored = localStorage.getItem('k9_admin_token');
if (stored) setAuthToken(stored);
