import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../store/authStore';
import { getAccessToken } from '../lib/auth';
import { api } from '../lib/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const { user, loading, loadUser } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => { loadUser(); }, []);

  // Register push token after user loads
  useEffect(() => {
    if (!user) return;
    (async () => {
      const token = await getAccessToken();
      if (!token) return;
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;
      try {
        const expoPushToken = (await Notifications.getExpoPushTokenAsync()).data;
        api.post('/me/push-token', { token: expoPushToken }).catch(() => {});
      } catch {}
    })();
  }, [user?.id]);

  useEffect(() => {
    if (loading) return;
    const inAuth       = segments[0] === '(auth)';
    const inTabs       = segments[0] === '(tabs)';
    const inOnboarding = segments[0] === 'onboarding';
    const inDog        = segments[0] === 'dog';
    const inBooking    = segments[0] === 'booking';
    if (!user && !inAuth) {
      router.replace('/(auth)/login');
    } else if (user && inAuth) {
      const isNew = !user.first_name;
      router.replace(isNew ? '/onboarding' : '/(tabs)/home');
    } else if (user && !inTabs && !inOnboarding && !inDog && !inBooking) {
      const isNew = !user.first_name;
      router.replace(isNew ? '/onboarding' : '/(tabs)/home');
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0E0D0B', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#C9A84C" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="dog/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="booking/[id]" options={{ animation: 'slide_from_right' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
