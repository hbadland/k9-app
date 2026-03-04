import { create } from 'zustand';
import { api } from '../lib/api';
import { saveTokens, clearTokens } from '../lib/auth';

interface User {
  id: string;
  email: string;
  role: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  address: string | null;
  status: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName?: string, lastName?: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    await saveTokens(data.accessToken, data.refreshToken);
    set({ user: data.user });
  },

  register: async (email, password, firstName, lastName) => {
    const { data } = await api.post('/auth/register', { email, password, firstName, lastName });
    await saveTokens(data.accessToken, data.refreshToken);
    set({ user: data.user });
  },

  logout: async () => {
    await api.post('/auth/logout').catch(() => {});
    await clearTokens();
    set({ user: null });
  },

  loadUser: async () => {
    set({ loading: true });
    try {
      const { data } = await api.get('/me');
      set({ user: data });
    } catch {
      set({ user: null });
    } finally {
      set({ loading: false });
    }
  },
}));
