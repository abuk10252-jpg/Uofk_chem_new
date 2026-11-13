import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { doc, setDoc } from 'firebase/firestore';
import { apiPost } from '../utils/api';
import { getFirebaseDb } from '../firebase';
import { useAuth } from './AuthContext';

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch (e) {
  console.warn('setNotificationHandler failed:', e);
}

interface NotificationContextType {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  unreadCount: number;
  lastError: string | null;
  clearUnreadCount: () => void;
  sendLocalNotification: (title: string, body: string, data?: any) => Promise<void>;
  refreshPushToken: () => Promise<{ ok: boolean; token?: string; error?: string }>;
}

const NotificationContext = createContext<NotificationContextType>({
  expoPushToken: null,
  notification: null,
  unreadCount: 0,
  lastError: null,
  clearUnreadCount: () => {},
  sendLocalNotification: async () => {},
  refreshPushToken: async () => ({ ok: false }),
});

async function registerForPushNotificationsAsync(): Promise<{ token?: string; error?: string }> {
  try {
    if (!Device.isDevice && Platform.OS !== 'web') {
      return { error: 'الإشعارات تحتاج جهاز حقيقي' };
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return { error: 'صلاحية الإشعارات مرفوضة' };
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#002147',
      });
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      return { error: 'EAS projectId غير موجود في الإعدادات' };
    }

    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenData?.data;
      if (!token || !String(token).startsWith('ExponentPushToken')) {
        return { error: 'توكن غير صالح من Expo: ' + String(token) };
      }
      console.log('📱 Expo push token:', token);
      return { token };
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.warn('getExpoPushTokenAsync error:', msg);
      if (Platform.OS === 'web' || /vapidPublicKey/i.test(msg)) {
        return {
          error:
            'إشعارات الويب تحتاج vapidPublicKey في app.json ثم إعادة نشر الويب. الأفضل تثبيت تطبيق APK للإشعارات.',
        };
      }
      if (/FCM|Firebase|GoogleService/i.test(msg)) {
        return {
          error: 'فشل جلب توكن Expo. على أندرويد غالباً تحتاج إعداد FCM في EAS.',
        };
      }
      return { error: 'فشل جلب توكن الإشعارات: ' + msg };
    }
  } catch (error: any) {
    return { error: error?.message || String(error) };
  }
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const lastSavedTokenRef = useRef<string | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => {
      registerForPushNotificationsAsync().then(result => {
        if (result.token) {
          setExpoPushToken(result.token);
          setLastError(null);
        } else if (result.error) {
          setLastError(result.error);
        }
      });
    }, 800);

    notificationListener.current = Notifications.addNotificationReceivedListener(n => {
      setNotification(n);
      setUnreadCount(c => c + 1);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {
      setUnreadCount(0);
    });

    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        registerForPushNotificationsAsync().then(result => {
          if (result.token) {
            setExpoPushToken(result.token);
            setLastError(null);
          }
        });
      }
    });

    return () => {
      clearTimeout(t);
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
      appStateSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!expoPushToken || !user?.uid) return;
    if (user.uid === 'local-test-super-admin') return;
    if (lastSavedTokenRef.current === expoPushToken) return;

    let cancelled = false;
    (async () => {
      for (let attempt = 1; attempt <= 3; attempt++) {
        if (cancelled) return;
        const ok = await savePushToken(user.uid, expoPushToken);
        if (ok) {
          lastSavedTokenRef.current = expoPushToken;
          setLastError(null);
          return;
        }
        await new Promise(r => setTimeout(r, attempt * 1500));
      }
      setLastError('فشل حفظ توكن الإشعارات بعد عدة محاولات');
    })();

    return () => {
      cancelled = true;
    };
  }, [expoPushToken, user?.uid]);

  async function savePushToken(uid: string, token: string): Promise<boolean> {
    if (savingRef.current) return false;
    savingRef.current = true;
    let ok = false;

    try {
      const db = getFirebaseDb();
      await setDoc(
        doc(db, 'users', uid),
        {
          push_token: token,
          push_token_updated_at: Date.now(),
          push_platform: Platform.OS,
        },
        { merge: true }
      );
      console.log('✅ push_token saved to Firestore for', uid);
      ok = true;
    } catch (e: any) {
      console.warn('Firestore push_token save failed:', e?.message || e);
    }

    try {
      await apiPost('/auth/push-token', { push_token: token, platform: Platform.OS });
      console.log('✅ push_token sent to API');
      ok = true;
    } catch (e: any) {
      console.warn('API push_token save failed:', e?.message || e);
    }

    savingRef.current = false;
    return ok;
  }

  async function refreshPushToken() {
    const result = await registerForPushNotificationsAsync();
    if (result.token) {
      setExpoPushToken(result.token);
      setLastError(null);
      lastSavedTokenRef.current = null;
      if (user?.uid) {
        await savePushToken(user.uid, result.token);
        lastSavedTokenRef.current = result.token;
      }
      return { ok: true, token: result.token };
    }
    if (result.error) setLastError(result.error);
    return { ok: false, error: result.error };
  }

  async function sendLocalNotification(title: string, body: string, data?: any) {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: data || {}, sound: true },
      trigger: null,
    });
  }

  return (
    <NotificationContext.Provider
      value={{
        expoPushToken,
        notification,
        unreadCount,
        lastError,
        clearUnreadCount: () => setUnreadCount(0),
        sendLocalNotification,
        refreshPushToken,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
