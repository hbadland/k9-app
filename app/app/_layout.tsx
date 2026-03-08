import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import * as Sentry from '@sentry/react-native';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { getAccessToken } from '../lib/auth';
import { api } from '../lib/api';

if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.2,
  });
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const { user, loading, loadUser } = useAuthStore();
  const initTheme = useThemeStore((s) => s.init);
  useEffect(() => { initTheme(); }, []);
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

  // Navigate to booking when a push notification is tapped
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const bookingId = response.notification.request.content.data?.bookingId as string | undefined;
      if (bookingId) {
        router.push(`/booking/${bookingId}`);
      }
    });
    return () => sub.remove();
  }, []);

  // Handle deep links (e.g. k9app://reset-password?token=... from email)
  useEffect(() => {
    // Handle link when app is already open
    const sub = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url, router);
    });
    // Handle link that launched/resumed the app
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url, router);
    });
    return () => sub.remove();
  }, []);

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
          <Stack.Screen name="booking/map-replay" options={{ animation: 'slide_from_right' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function handleDeepLink(url: string, router: ReturnType<typeof useRouter>) {
  const parsed = Linking.parse(url);
  // k9app://reset-password?token=xxx
  if (parsed.path === 'reset-password' && parsed.queryParams?.token) {
    router.push(`/(auth)/reset-password?token=${parsed.queryParams.token}`);
  }
}
