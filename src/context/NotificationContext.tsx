import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { doc, setDoc } from 'firebase/firestore';
import { apiPost } from '../utils/api';
import { getFirebaseDb } from '../firebase';
import { useAuth } from './AuthContext';

// إعداد كيفية ظهور الإشعارات
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
  clearUnreadCount: () => void;
  sendLocalNotification: (title: string, body: string, data?: any) => Promise<void>;
  refreshPushToken: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  expoPushToken: null,
  notification: null,
  unreadCount: 0,
  clearUnreadCount: () => {},
  sendLocalNotification: async () => {},
  refreshPushToken: async () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const lastSavedTokenRef = useRef<string | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {
      if (token) setExpoPushToken(token);
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(n => {
      setNotification(n);
      setUnreadCount(prev => prev + 1);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
    });

    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        registerForPushNotificationsAsync().then(token => {
          if (token) setExpoPushToken(token);
        });
      }
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
      appStateSub.remove();
    };
  }, []);

  // حفظ التوكن في Firestore مباشرة + عبر الـ API
  useEffect(() => {
    if (!expoPushToken || !user?.uid) return;
    if (user.uid === 'local-test-super-admin') return;
    if (lastSavedTokenRef.current === expoPushToken) return;

    savePushToken(user.uid, expoPushToken)
      .then(ok => {
        if (ok) lastSavedTokenRef.current = expoPushToken;
      })
      .catch(err => {
        console.warn('Failed to save push token:', err?.message || err);
      });
  }, [expoPushToken, user?.uid]);

  async function savePushToken(uid: string, token: string): Promise<boolean> {
    if (savingRef.current) return false;
    savingRef.current = true;
    let ok = false;

    // 1) حفظ مباشر في Firestore (ما يعتمد على السيرفر)
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
      console.warn('❌ Firestore push_token save failed:', e?.message || e);
    }

    // 2) عبر الـ API كنسخة احتياطية
    try {
      await apiPost('/auth/push-token', { push_token: token });
      console.log('✅ push_token saved via API');
      ok = true;
    } catch (e: any) {
      console.warn('❌ API push_token save failed:', e?.message || e);
    }

    savingRef.current = false;
    return ok;
  }

  const refreshPushToken = async () => {
    const token = await registerForPushNotificationsAsync();
    if (token) {
      setExpoPushToken(token);
      lastSavedTokenRef.current = null;
    }
  };

  const clearUnreadCount = () => {
    setUnreadCount(0);
  };

  const sendLocalNotification = async (title: string, body: string, data?: any) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: true,
      },
      trigger: null,
    });
  };

  return (
    <NotificationContext.Provider
      value={{
        expoPushToken,
        notification,
        unreadCount,
        clearUnreadCount,
        sendLocalNotification,
        refreshPushToken,
      }}>
      {children}
    </NotificationContext.Provider>
  );
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.log('Must use physical device for Push Notifications');
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'default',
      });
      await Notifications.setNotificationChannelAsync('news', {
        name: 'الأخبار',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Push permission not granted:', finalStatus);
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn(
        'EAS projectId مش موجود في app.json (extra.eas.projectId). شغّل "eas init" مرة واحدة.'
      );
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData?.data;
    if (!token || !token.startsWith('ExponentPushToken')) {
      console.warn('Invalid Expo push token:', token);
      return null;
    }
    console.log('📱 Expo push token:', token);
    return token;
  } catch (error: any) {
    console.warn('Error getting push token:', error?.message || error);
    return null;
  }
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
