import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator
} from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiCall } from '../../src/utils/api';
import { Colors } from '../../src/constants/colors';

export default function SuperAdminHome() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const isArabic = user?.language === 'ar';

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCourses: 0,
    pendingUsers: 0,
    totalAdmins: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const [usersData, coursesData] = await Promise.all([
        apiCall('/admin/users'),
        apiCall('/courses/'),
      ]);

      const users = usersData?.users || [];
      const courses = coursesData?.courses || [];

      setStats({
        totalUsers: users.length,
        totalCourses: courses.length,
        pendingUsers: users.filter((u: any) => u.status === 'pending').length,
        totalAdmins: users.filter((u: any) => u.role === 'admin').length,
      });
    } catch (e) {
      console.warn('fetchStats error:', e);
    } finally {
      setLoadingStats(false);
    }
  }

  async function handleLogout() {
    try {
      await logout();
      router.replace('/login');
    } catch {
      router.replace('/login');
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* الهيدر */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>
            {isArabic ? 'لوحة السوبر أدمن' : 'Super Admin Dashboard'}
          </Text>
          <Text style={styles.subtitle}>
            {isArabic ? 'مرحباً، ' : 'Welcome, '}{user?.name}
          </Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* إحصائيات */}
      {loadingStats ? (
        <ActivityIndicator color={Colors.accent} style={{ marginBottom: 24 }} />
      ) : (
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="people" size={24} color={Colors.accent} />
            <Text style={styles.statNum}>{stats.totalUsers}</Text>
            <Text style={styles.statLabel}>
              {isArabic ? 'المستخدمين' : 'Users'}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="book" size={24} color={Colors.accent} />
            <Text style={styles.statNum}>{stats.totalCourses}</Text>
            <Text style={styles.statLabel}>
              {isArabic ? 'المواد' : 'Courses'}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time" size={24} color="#F59E0B" />
            <Text style={[styles.statNum, { color: '#F59E0B' }]}>
              {stats.pendingUsers}
            </Text>
            <Text style={styles.statLabel}>
              {isArabic ? 'قيد الانتظار' : 'Pending'}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="shield" size={24} color="#10B981" />
            <Text style={[styles.statNum, { color: '#10B981' }]}>
              {stats.totalAdmins}
            </Text>
            <Text style={styles.statLabel}>
              {isArabic ? 'الأدمنية' : 'Admins'}
            </Text>
          </View>
        </View>
      )}

      {/* صلاحيات الأدمن العادية */}
      <Text style={styles.sectionTitle}>
        {isArabic ? 'إدارة المحتوى' : 'Content Management'}
      </Text>

      <TouchableOpacity
        style={styles.btn}
        onPress={() => router.push('/admin/users')}
      >
        <Ionicons name="people-outline" size={22} color="#002147" />
        <Text style={styles.btnText}>
          {isArabic ? 'إدارة المستخدمين' : 'Manage Users'}
        </Text>
        <Ionicons name="chevron-forward" size={18} color="#002147" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btn}
        onPress={() => router.push('/admin/create-course')}
      >
        <Ionicons name="book-outline" size={22} color="#002147" />
        <Text style={styles.btnText}>
          {isArabic ? 'إنشاء مادة' : 'Create Course'}
        </Text>
        <Ionicons name="chevron-forward" size={18} color="#002147" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btn}
        onPress={() => router.push('/admin/create-news')}
      >
        <Ionicons name="newspaper-outline" size={22} color="#002147" />
        <Text style={styles.btnText}>
          {isArabic ? 'إنشاء منشور' : 'Create Post'}
        </Text>
        <Ionicons name="chevron-forward" size={18} color="#002147" />
      </TouchableOpacity>

      {/* صلاحيات السوبر أدمن */}
      <View style={styles.superSection}>
        <Text style={styles.superSectionTitle}>
          {isArabic ? 'أدوات السوبر أدمن' : 'Super Admin Tools'}
        </Text>

        <TouchableOpacity
          style={styles.superBtn}
          onPress={() => router.push('/super-admin/manage-roles')}
        >
          <View style={styles.superBtnIcon}>
            <Ionicons name="shield-checkmark" size={22} color={Colors.accent} />
          </View>
          <View style={styles.superBtnInfo}>
            <Text style={styles.superBtnTitle}>
              {isArabic ? 'إدارة الأدوار' : 'Manage Roles'}
            </Text>
            <Text style={styles.superBtnDesc}>
              {isArabic
                ? 'ترقية أو تخفيض صلاحيات المستخدمين'
                : 'Promote or demote user roles'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.superBtn}
          onPress={() => router.push('/super-admin/settings')}
        >
          <View style={styles.superBtnIcon}>
            <Ionicons name="settings" size={22} color={Colors.accent} />
          </View>
          <View style={styles.superBtnInfo}>
            <Text style={styles.superBtnTitle}>
              {isArabic ? 'الإعدادات' : 'Settings'}
            </Text>
            <Text style={styles.superBtnDesc}>
              {isArabic
                ? 'إعدادات النظام والتطبيق'
                : 'System and app settings'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.superBtn}
          onPress={() => router.push('/(tabs)/academic')}
        >
          <View style={styles.superBtnIcon}>
            <Ionicons name="eye" size={22} color={Colors.accent} />
          </View>
          <View style={styles.superBtnInfo}>
            <Text style={styles.superBtnTitle}>
              {isArabic ? 'عرض التطبيق' : 'View App'}
            </Text>
            <Text style={styles.superBtnDesc}>
              {isArabic
                ? 'تصفح التطبيق كطالب'
                : 'Browse app as student'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#002147' },
  content: { padding: 20, paddingTop: 60 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 24,
  },
  title: {
    fontSize: 26, fontWeight: '800',
    color: '#FFF', marginBottom: 6,
  },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.7)' },
  logoutBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 12, marginBottom: 28,
  },
  statCard: {
    width: '47%', backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, padding: 16, alignItems: 'center', gap: 6,
  },
  statNum: {
    fontSize: 28, fontWeight: '800', color: '#FFF',
  },
  statLabel: {
    fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16, fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1,
  },
  btn: {
    backgroundColor: Colors.accent, padding: 16,
    borderRadius: 12, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  btnText: {
    flex: 1, color: '#002147',
    fontSize: 16, fontWeight: '700',
  },
  superSection: {
    marginTop: 28, paddingTop: 24,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)',
  },
  superSectionTitle: {
    fontSize: 16, fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1,
  },
  superBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, padding: 16, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  superBtnIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(212,175,55,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  superBtnInfo: { flex: 1 },
  superBtnTitle: {
    fontSize: 15, fontWeight: '700', color: '#FFF',
  },
  superBtnDesc: {
    fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2,
  },
});
