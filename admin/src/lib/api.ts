import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const api = axios.create({ baseURL: API_URL });

export const setAuthToken = (token: string | null) => {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
};

// On 401, attempt token refresh once then redirect to login
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && !original.url?.includes('/auth/')) {
      original._retry = true;
      const refreshToken = localStorage.getItem('k9_admin_refresh');
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
          localStorage.setItem('k9_admin_token', data.accessToken);
          localStorage.setItem('k9_admin_refresh', data.refreshToken);
          setAuthToken(data.accessToken);
          original.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(original);
        } catch {
          // Refresh failed — fall through to logout
        }
      }
      localStorage.removeItem('k9_admin_token');
      localStorage.removeItem('k9_admin_refresh');
      setAuthToken(null);
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
