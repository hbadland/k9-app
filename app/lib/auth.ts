import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'k9_access_token';
const REFRESH_KEY = 'k9_refresh_token';

let memAccess: string | null = null;
let memRefresh: string | null = null;

export const saveTokens = async (accessToken: string, refreshToken: string) => {
  memAccess = accessToken;
  memRefresh = refreshToken;
  try {
    await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
  } catch (e) {
    console.warn('[auth] SecureStore write failed, using memory only', e);
  }
};

export const getAccessToken = async () => {
  try {
    return await SecureStore.getItemAsync(ACCESS_KEY) ?? memAccess;
  } catch {
    return memAccess;
  }
};

export const getRefreshToken = async () => {
  try {
    return await SecureStore.getItemAsync(REFRESH_KEY) ?? memRefresh;
  } catch {
    return memRefresh;
  }
};

export const clearTokens = async () => {
  memAccess = null;
  memRefresh = null;
  try {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  } catch {}
};
