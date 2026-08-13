import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { Colors } from '../../src/constants/colors';

export default function SuperAdminSettings() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const isArabic = user?.language === 'ar';

  async function handleLogout() {
    Alert.alert(
      isArabic ? 'تسجيل الخروج' : 'Logout',
      isArabic ? 'هل تريد تسجيل الخروج؟' : 'Are you sure you want to logout?',
      [
        { text: isArabic ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isArabic ? 'خروج' : 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              router.replace('/login');
            } catch {
              router.replace('/login');
            }
          },
        },
      ]
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* الهيدر */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.title}>
          {isArabic ? 'الإعدادات' : 'Settings'}
        </Text>
      </View>

      {/* بطاقة المستخدم */}
      <View style={styles.userCard}>
        <View style={styles.avatarWrap}>
          <Ionicons name="person" size={32} color={Colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <View style={styles.superBadge}>
            <Ionicons name="star" size={12} color={Colors.accent} />
            <Text style={styles.superBadgeText}>Super Admin</Text>
          </View>
        </View>
      </View>

      {/* قسم النظام */}
      <Text style={styles.sectionTitle}>
        {isArabic ? 'إعدادات النظام' : 'System Settings'}
      </Text>

      <TouchableOpacity
        style={styles.settingItem}
        onPress={() => Alert.alert(
          isArabic ? 'قريباً' : 'Coming Soon',
          isArabic ? 'هذه الميزة ستكون متاحة قريباً' : 'This feature will be available soon'
        )}
      >
        <View style={styles.settingIcon}>
          <Ionicons name="server-outline" size={22} color={Colors.accent} />
        </View>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>
            {isArabic ? 'تحكم النظام' : 'System Controls'}
          </Text>
          <Text style={styles.settingDesc}>
            {isArabic ? 'قريباً' : 'Coming Soon'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.settingItem}
        onPress={() => Alert.alert(
          isArabic ? 'قريباً' : 'Coming Soon',
          isArabic ? 'هذه الميزة ستكون متاحة قريباً' : 'This feature will be available soon'
        )}
      >
        <View style={styles.settingIcon}>
          <Ionicons name="bar-chart-outline" size={22} color={Colors.accent} />
        </View>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>
            {isArabic ? 'إحصائيات التطبيق' : 'App Statistics'}
          </Text>
          <Text style={styles.settingDesc}>
            {isArabic ? 'قريباً' : 'Coming Soon'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.settingItem}
        onPress={() => Alert.alert(
          isArabic ? 'قريباً' : 'Coming Soon',
          isArabic ? 'هذه الميزة ستكون متاحة قريباً' : 'This feature will be available soon'
        )}
      >
        <View style={styles.settingIcon}>
          <Ionicons name="notifications-outline" size={22} color={Colors.accent} />
        </View>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>
            {isArabic ? 'إرسال إشعار عام' : 'Send Global Notification'}
          </Text>
          <Text style={styles.settingDesc}>
            {isArabic ? 'قريباً' : 'Coming Soon'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.settingItem}
        onPress={() => Alert.alert(
          isArabic ? 'قريباً' : 'Coming Soon',
          isArabic ? 'هذه الميزة ستكون متاحة قريباً' : 'This feature will be available soon'
        )}
      >
        <View style={styles.settingIcon}>
          <Ionicons name="shield-checkmark-outline" size={22} color={Colors.accent} />
        </View>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>
            {isArabic ? 'سجل الأنشطة' : 'Activity Log'}
          </Text>
          <Text style={styles.settingDesc}>
            {isArabic ? 'قريباً' : 'Coming Soon'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
      </TouchableOpacity>

      {/* قسم الحساب */}
      <Text style={[styles.sectionTitle, { marginTop: 28 }]}>
        {isArabic ? 'الحساب' : 'Account'}
      </Text>

      <TouchableOpacity
        style={styles.settingItem}
        onPress={() => router.push('/super-admin/manage-roles')}
      >
        <View style={styles.settingIcon}>
          <Ionicons name="people-outline" size={22} color={Colors.accent} />
        </View>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>
            {isArabic ? 'إدارة الأدوار' : 'Manage Roles'}
          </Text>
          <Text style={styles.settingDesc}>
            {isArabic ? 'ترقية أو تخفيض المستخدمين' : 'Promote or demote users'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
      </TouchableOpacity>

      {/* زر تسجيل الخروج */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#EF4444" />
        <Text style={styles.logoutText}>
          {isArabic ? 'تسجيل الخروج' : 'Logout'}
        </Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#002147' },
  content: { padding: 20, paddingTop: 60 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, marginBottom: 24,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontSize: 24, fontWeight: '800', color: '#FFF',
  },
  userCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center',
    gap: 14, marginBottom: 28,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  avatarWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(212,175,55,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  userName: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  userEmail: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  superBadge: {
    flexDirection: 'row', alignItems: 'center',
    gap: 4, marginTop: 6, alignSelf: 'flex-start',
    backgroundColor: Colors.accent + '20',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  superBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.accent },
  sectionTitle: {
    fontSize: 13, fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1,
  },
  settingItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14, padding: 16, marginBottom: 10,
    gap: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  settingIcon: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: 'rgba(212,175,55,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  settingInfo: { flex: 1 },
  settingTitle: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  settingDesc: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 14, padding: 16, marginTop: 28,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  logoutText: { fontSize: 16, fontWeight: '700', color: '#EF4444' },
});
