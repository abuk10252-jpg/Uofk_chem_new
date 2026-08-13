import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // نخفي السبلاش الأصلي (الثابت) فورًا، وبعدين شاشة index بتعرض
    // نسخة متحركة (بتكبر وتصغر) بدل الصورة الثابتة.
    SplashScreen.hideAsync();
  }, []);

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
      </Stack>
    </>
  );
}
