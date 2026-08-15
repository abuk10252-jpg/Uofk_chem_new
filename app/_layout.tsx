import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { NotificationProvider } from '../src/context/NotificationContext';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';

SplashScreen.preventAutoHideAsync();

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: any) {
    console.error('App crash caught:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <ScrollView style={styles.crashContainer} contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
          <Text style={styles.crashTitle}>⚠️ حصل خطأ في التطبيق</Text>
          <Text style={styles.crashSubtitle}>خد Screenshot للي تحت وابعته:</Text>
          <View style={styles.crashBox}>
            <Text style={styles.crashText}>{String(this.state.error?.message || this.state.error)}</Text>
            {!!this.state.error?.stack && (
              <Text style={styles.crashStack}>{this.state.error.stack}</Text>
            )}
          </View>
          <TouchableOpacity style={styles.crashBtn} onPress={() => this.setState({ error: null })}>
            <Text style={styles.crashBtnText}>حاول تاني</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

function GlobalCrashCatcher({ children }: { children: React.ReactNode }) {
  const [fatalError, setFatalError] = useState<string | null>(null);

  useEffect(() => {
    // @ts-ignore
    const defaultHandler = global.ErrorUtils?.getGlobalHandler?.();
    // @ts-ignore
    global.ErrorUtils?.setGlobalHandler?.((error: any, isFatal?: boolean) => {
      setFatalError(`${isFatal ? '[Fatal] ' : ''}${error?.message || error}\n\n${error?.stack || ''}`);
    });
    return () => {
      // @ts-ignore
      if (defaultHandler) global.ErrorUtils?.setGlobalHandler?.(defaultHandler);
    };
  }, []);

  if (fatalError) {
    return (
      <ScrollView style={styles.crashContainer} contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
        <Text style={styles.crashTitle}>⚠️ حصل خطأ فادح</Text>
        <Text style={styles.crashSubtitle}>خد Screenshot للي تحت وابعته:</Text>
        <View style={styles.crashBox}>
          <Text style={styles.crashText}>{fatalError}</Text>
        </View>
        <TouchableOpacity style={styles.crashBtn} onPress={() => setFatalError(null)}>
          <Text style={styles.crashBtnText}>حاول تاني</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return <>{children}</>;
}

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [fontLoaded, setFontLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync({
          'SpaceMono': require('../assets/fonts/SpaceMono-Regular.ttf'),
        });
      } catch (e) {
        console.warn('Error loading fonts:', e);
      } finally {
        setFontLoaded(true);
      }
    }
    loadFonts();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 6000);
    return () => clearTimeout(t);
  }, []);

  const effectivelyLoading = loading && !timedOut;

  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinTimeElapsed(true), 1300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (fontLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontLoaded]);

  useEffect(() => {
    if (!fontLoaded || effectivelyLoading || !minTimeElapsed) return;

    if (!user) {
      router.replace('/login');
    } else if (user.status === 'pending' || !user.status) {
      router.replace('/pending');
    } else if (user.status === 'rejected') {
      router.replace('/pending');
    } else if (user.status === 'approved') {
      if (segments[0] === 'login' || segments[0] === 'pending' || segments[0] === undefined) {
        if (user.role === 'super_admin') {
          router.replace('/super-admin');
        } else if (user.role === 'admin') {
          router.replace('/admin');
        } else {
          router.replace('/(tabs)/academic');
        }
      }
    }
  }, [user, effectivelyLoading, fontLoaded, segments, minTimeElapsed]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" options={{ title: 'تسجيل الدخول' }} />
      <Stack.Screen name="register" options={{ title: 'إنشاء حساب' }} />
      <Stack.Screen name="pending" options={{ title: 'قيد المراجعة' }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="admin/index" options={{ title: 'لوحة التحكم' }} />
      <Stack.Screen name="admin/create-course" options={{ title: 'إضافة مقرر' }} />
      <Stack.Screen name="admin/create-news" options={{ title: 'إضافة خبر' }} />
      <Stack.Screen name="admin/users" options={{ title: 'إدارة المستخدمين' }} />
      <Stack.Screen name="admin/quiz-results" options={{ title: 'نتائج الاختبارات' }} />
      <Stack.Screen name="super-admin/index" options={{ title: 'المشرف العام' }} />
      <Stack.Screen name="super-admin/manage-roles" options={{ title: 'إدارة الصلاحيات' }} />
      <Stack.Screen name="super-admin/settings" options={{ title: 'الإعدادات' }} />
      <Stack.Screen name="course/[id]" options={{ title: 'المقرر' }} />
      <Stack.Screen name="notifications/index" options={{ title: 'الإشعارات' }} />
      <Stack.Screen name="+html" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GlobalCrashCatcher>
        <AuthProvider>
          <NotificationProvider>
            <StatusBar style="auto" />
            <RootLayoutNav />
          </NotificationProvider>
        </AuthProvider>
      </GlobalCrashCatcher>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#002147' },
  loadingText: { marginTop: 20, fontSize: 16, color: '#007AFF', fontFamily: 'System' },
  splashTitle: { fontSize: 38, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5, textAlign: 'center' },
  splashDivider: { width: 60, height: 2, backgroundColor: '#D4AF37', marginVertical: 14, alignSelf: 'center' },
  splashSubtitle: { fontSize: 13, color: '#D4AF37', textAlign: 'center', letterSpacing: 0.5 },
  crashContainer: { flex: 1, backgroundColor: '#FFF0F0' },
  crashTitle: { fontSize: 20, fontWeight: '800', color: '#B91C1C', marginBottom: 6, textAlign: 'right' },
  crashSubtitle: { fontSize: 14, color: '#7F1D1D', marginBottom: 16, textAlign: 'right' },
  crashBox: { backgroundColor: '#FFF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#FECACA' },
  crashText: { fontSize: 14, color: '#111', fontWeight: '700', textAlign: 'left' },
  crashStack: { fontSize: 11, color: '#555', marginTop: 10, textAlign: 'left' },
  crashBtn: { marginTop: 20, backgroundColor: '#B91C1C', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  crashBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});
