import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { applyTheme } from '../constants/colors';

type ThemeName = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeName;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
});

const STORAGE_KEY = 'app_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        const initial: ThemeName = saved === 'dark' ? 'dark' : 'light';
        // لازم نطبق الألوان هنا قبل أي شاشة تتعمل رندر، عشان StyleSheet.create()
        // المستخدمة في كل شاشات التطبيق بتاخد قيم الألوان مرة واحدة بس وقت تحميل
        // الملف - مش بتتحدث تلقائي لمجرد remount عادي
        applyTheme(initial);
        setTheme(initial);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  async function toggleTheme() {
    const next: ThemeName = theme === 'light' ? 'dark' : 'light';
    await AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
    applyTheme(next);
    setTheme(next);

    // إعادة تحميل حقيقية لملفات الجافاسكريبت (مش مجرد remount) عشان كل
    // الشاشات تاخد الألوان الجديدة صح - remount عادي ما بيكفي هنا لأن أغلب
    // الشاشات بتستخدم StyleSheet.create() اللي بتتقيّم مرة واحدة بس
    try {
      await Updates.reloadAsync();
    } catch {
      // في وضع التطوير المحلي (Expo Go / dev client) إعادة التحميل دي ممكن
      // ما تشتغلش - في الحالة دي الثيم لسه بيتحفظ صح وهيتطبق صح لما تقفل
      // وتفتح التطبيق تاني
    }
  }

  if (!ready) return null;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
