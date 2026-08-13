import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '../src/context/AuthContext';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    if (loading) return; // لسه بنستنى Firebase يرد

    const inAuthScreen = segments[0] === 'login' || segments[0] === 'register';
    const inPendingScreen = segments[0] === 'pending';
    const atSplash = segments[0] === undefined; // index.tsx

    if (!user) {
      if (!inAuthScreen) router.replace('/login');
      return;
    }

    if (user.status !== 'approved') {
      if (!inPendingScreen) router.replace('/pending');
      return;
    }

    // approved
    if (inAuthScreen || inPendingScreen || atSplash) {
      router.replace('/home');
    }
  }, [user, loading, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="pending" />
      <Stack.Screen name="home" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <RootLayoutNav />
    </AuthProvider>
  );
}
