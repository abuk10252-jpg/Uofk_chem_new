import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet } from 'react-native';
import { Colors } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';

export default function TabLayout() {
  const { user } = useAuth();

  // تحديد العنوان حسب اللغة
  const isArabic = user?.language === 'ar';

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        // ترانزيشن سلس بين التابات بدل التبديل المفاجئ
        animation: 'shift',
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: Colors.border,
          height: Platform.OS === 'ios' ? 88 : 72,
          paddingBottom: Platform.OS === 'ios' ? 26 : 12,
          paddingTop: 10,
          elevation: 12,
          shadowColor: '#0B1F3A',
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
        },
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
        // منع الهيدر من الظهور في الشاشات الفرعية
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="academic"
        options={{
          title: 'Academic',
          headerTitle: isArabic ? 'الأكاديميات' : 'Academic',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book" size={size} color={color} />
          ),
          tabBarLabel: isArabic ? 'الأكاديميات' : 'Academic',
        }}
      />
      <Tabs.Screen
        name="chemi"
        options={{
          title: 'CHEMI',
          headerTitle: 'CHEMI',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sparkles" size={size} color={color} />
          ),
          tabBarLabel: 'CHEMI',
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: 'News',
          headerTitle: isArabic ? 'الأخبار' : 'News',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="newspaper" size={size} color={color} />
          ),
          tabBarLabel: isArabic ? 'الأخبار' : 'News',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerTitle: isArabic ? 'الملف الشخصي' : 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
          tabBarLabel: isArabic ? 'الملف الشخصي' : 'Profile',
        }}
      />
    </Tabs>
  );
}
