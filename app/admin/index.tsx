import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert
} from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { apiCall } from '../../src/utils/api';

export default function AdminHome() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const isArabic = user?.language === 'ar';

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCourses: 0,
    pendingUsers: 0,
    totalFiles: 0,
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
      const totalFiles = courses.reduce(
        (sum: number, c: any) => sum + (c.file_count || 0), 0
      );

      setStats({
        totalUsers: users.length,
        totalCourses: courses.length,
        pendingUsers: users.filter((u: any) => u.status === 'pending').length,
        totalFiles,
      });
    } catch (e) {
      console.warn('fetchStats error:', e);
    } finally {
      setLoadingStats(false);
    }
  }

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
        <View>
          <Text style={styles.title}>
            {isArabic ? 'لوحة الأدمن' : 'Admin Dashboard'}
          </Text>
          <Text style={styles.subtitle}>
            {isArabic ? 'مرحباً، ' : 'Welcome, '}{user?.name}
          </Text>
        </View>
        <View style={styles.adminBadge}>
          <Ionicons name="shield-checkmark" size={16} color={Colors.accent} />
          <Text style={styles.adminBadgeText}>Admin</Text>
        </View>
      </View>

      {/* الإحصائيات */}
      {loadingStats ? (
        <ActivityIndicator color={Colors.accent} style={{ marginBottom: 24 }} />
      ) : (
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="people" size={22} color={Colors.accent} />
            <Text style={styles.statNum}>{stats.totalUsers}</Text>
            <Text style={styles.statLabel}>
              {isArabic ? 'المستخدمين' : 'Users'}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="book" size={22} color={Colors.accent} />
            <Text style={styles.statNum}>{stats.totalCourses}</Text>
            <Text style={styles.statLabel}>
              {isArabic ? 'المواد' : 'Courses'}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time" size={22} color="#F59E0B" />
            <Text style={[styles.statNum, { color: '#F59E0B' }]}>
              {stats.pendingUsers}
            </Text>
            <Text style={styles.statLabel}>
              {isArabic ? 'قيد الانتظار' : 'Pending'}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="document" size={22} color="#10B981" />
            <Text style={[styles.statNum, { color: '#10B981' }]}>
              {stats.totalFiles}
            </Text>
            <Text style={styles.statLabel}>
              {isArabic ? 'الملفات' : 'Files'}
            </Text>
          </View>
        </View>
      )}

      {/* قسم الإدارة */}
      <Text style={styles.sectionTitle}>
        {isArabic ? 'إدارة المحتوى' : 'Content Management'}
      </Text>

      <TouchableOpacity
        style={styles.btn}
        onPress={() => router.push('/admin/users')}
      >
        <View style={styles.btnIcon}>
          <Ionicons name="people" size={22} color={Colors.accent} />
        </View>
        <View style={styles.btnInfo}>
          <Text style={styles.btnTitle}>
            {isArabic ? 'إدارة المستخدمين' : 'Manage Users'}
          </Text>
          <Text style={styles.btnDesc}>
            {isArabic
              ? 'قبول ورفض وإدارة الطلاب'
              : 'Approve, reject and manage students'}
          </Text>
        </View>
        {stats.pendingUsers > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{stats.pendingUsers}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btn}
        onPress={() => router.push('/admin/create-course')}
      >
        <View style={styles.btnIcon}>
          <Ionicons name="book" size={22} color={Colors.accent} />
        </View>
        <View style={styles.btnInfo}>
          <Text style={styles.btnTitle}>
            {isArabic ? 'إنشاء مادة' : 'Create Course'}
          </Text>
          <Text style={styles.btnDesc}>
            {isArabic
              ? 'إضافة مادة دراسية جديدة'
              : 'Add a new academic course'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btn}
        onPress={() => router.push('/admin/create-news')}
      >
        <View style={styles.btnIcon}>
          <Ionicons name="newspaper" size={22} color={Colors.accent} />
        </View>
        <View style={styles.btnInfo}>
          <Text style={styles.btnTitle}>
            {isArabic ? 'إنشاء منشور' : 'Create Post'}
          </Text>
          <Text style={styles.btnDesc}>
            {isArabic
              ? 'خبر أو استطلاع أو اختبار'
              : 'News, quiz or poll'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btn}
        onPress={() => router.push('/(tabs)/academic')}
      >
        <View style={styles.btnIcon}>
          <Ionicons name="eye" size={22} color={Colors.accent} />
        </View>
        <View style={styles.btnInfo}>
          <Text style={styles.btnTitle}>
            {isArabic ? 'عرض التطبيق' : 'View App'}
          </Text>
          <Text style={styles.btnDesc}>
            {isArabic
              ? 'تصفح التطبيق كطالب'
              : 'Browse app as student'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" />
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
  container: { flex: 1, backgroundColor: Colors.primary },
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
  adminBadge: {
    flexDirection: 'row', alignItems: 'center',
    gap: 4, backgroundColor: Colors.accent + '20',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 10,
  },
  adminBadgeText: {
    fontSize: 13, fontWeight: '700', color: Colors.accent,
  },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 12, marginBottom: 28,
  },
  statCard: {
    width: '47%', backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, padding: 16,
    alignItems: 'center', gap: 6,
  },
  statNum: {
    fontSize: 28, fontWeight: '800', color: '#FFF',
  },
  statLabel: {
    fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 13, fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1,
  },
  btn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, padding: 16, marginBottom: 12,
    gap: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  btnIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.accent + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  btnInfo: { flex: 1 },
  btnTitle: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  btnDesc: {
    fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2,
  },
  badge: {
    backgroundColor: '#EF4444', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
    minWidth: 22, alignItems: 'center',
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 14, padding: 16, marginTop: 16,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  logoutText: { fontSize: 16, fontWeight: '700', color: '#EF4444' },
});
