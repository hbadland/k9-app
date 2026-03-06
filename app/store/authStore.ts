import { create } from 'zustand';
import { api } from '../lib/api';
import { saveTokens, clearTokens, getRefreshToken } from '../lib/auth';

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
  loginWithGoogle: (idToken: string) => Promise<void>;
  loginWithApple: (identityToken: string, fullName?: { givenName?: string | null; familyName?: string | null } | null) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    if (!data.accessToken) throw new Error('No token received');
    await saveTokens(data.accessToken, data.refreshToken);
    setTimeout(() => set({ user: data.user }), 50);
  },

  register: async (email, password, firstName, lastName) => {
    const { data } = await api.post('/auth/register', { email, password, firstName, lastName });
    if (!data.accessToken) throw new Error('No token received');
    await saveTokens(data.accessToken, data.refreshToken);
    setTimeout(() => set({ user: data.user }), 50);
  },

  loginWithGoogle: async (idToken) => {
    const { data } = await api.post('/auth/google', { idToken });
    if (!data.accessToken) throw new Error('No token received');
    await saveTokens(data.accessToken, data.refreshToken);
    setTimeout(() => set({ user: data.user }), 50);
  },

  loginWithApple: async (identityToken, fullName) => {
    const { data } = await api.post('/auth/apple', { identityToken, fullName });
    if (!data.accessToken) throw new Error('No token received');
    await saveTokens(data.accessToken, data.refreshToken);
    setTimeout(() => set({ user: data.user }), 50);
  },

  logout: async () => {
    const refreshToken = await getRefreshToken();
    await api.post('/auth/logout', { refreshToken }).catch(() => {});
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
