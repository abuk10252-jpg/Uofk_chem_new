import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Linking, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { Colors } from '../../src/constants/colors';
import { apiCall } from '../../src/utils/api';

export default function ProfileTab() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const lang = user?.language || 'en';
  const isArabic = lang === 'ar';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingNoti, setLoadingNoti] = useState(true);
  const [showNotifs, setShowNotifs] = useState(false);
  const [courses, setCourses] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);

  useEffect(() => {
    fetchNotifications();
    fetchCourses();
    if (isAdmin) fetchMyQuizzes();
  }, []);

  async function fetchNotifications() {
    try {
      const data = await apiCall('/notifications');
      if (data?.notifications) {
        setNotifications(data.notifications);
      } else {
        setNotifications([]);
      }
    } catch (e) {
      console.warn('fetchNotifications error:', e);
      setNotifications([]);
    } finally {
      setLoadingNoti(false);
    }
  }

  async function fetchCourses() {
    try {
      const data = await apiCall('/courses/');
      if (data?.courses) {
        setCourses(data.courses);
      } else {
        setCourses([]);
      }
    } catch (e) {
      console.warn('fetchCourses error:', e);
      setCourses([]);
    }
  }

  async function fetchMyQuizzes() {
    setLoadingQuizzes(true);
    try {
      // جلب الأخبار وفلترة الكويزات اللي أنشأها الأدمن
      const data = await apiCall('/news/');
      if (data?.news) {
        const myQuizzes = data.news.filter(
          (n: any) => n.type === 'quiz' && n.created_by_id === user?.id
        );
        setQuizzes(myQuizzes);
      } else {
        setQuizzes([]);
      }
    } catch (e) {
      console.warn('fetchMyQuizzes error:', e);
      setQuizzes([]);
    } finally {
      setLoadingQuizzes(false);
    }
  }

  function openQuizResults(id: string) {
    router.push(`/admin/quiz-results/${id}`);
  }

  async function downloadQuizPDF(id: string) {
    try {
      const url = `${process.env.EXPO_PUBLIC_API_URL}/admin/quiz/${id}/results/pdf`;
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          isArabic ? 'خطأ' : 'Error',
          isArabic ? 'لا يمكن فتح الرابط' : 'Cannot open URL'
        );
      }
    } catch (e) {
      Alert.alert(
        isArabic ? 'خطأ' : 'Error',
        isArabic ? 'فشل تحميل الـ PDF' : 'Failed to download PDF'
      );
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
            } catch (e) {
              console.warn('logout error:', e);
              router.replace('/login');
            }
          },
        },
      ]
    );
  }

  const roleLabel =
    user?.role === 'super_admin'
      ? 'Super Admin'
      : user?.role === 'admin'
      ? 'Admin'
      : isArabic ? 'طالب' : 'Student';

  const roleColor =
    user?.role === 'super_admin'
      ? Colors.accent
      : user?.role === 'admin'
      ? Colors.primary
      : Colors.success;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* زر الإشعارات */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10 }}>
        <TouchableOpacity
          onPress={() => setShowNotifs(!showNotifs)}
          style={{ position: 'relative' }}
        >
          <Ionicons name="notifications-outline" size={28} color={Colors.accent} />
          {notifications.length > 0 && (
            <View style={styles.notifDot} />
          )}
        </TouchableOpacity>
      </View>

      {/* Popup الإشعارات */}
      {showNotifs && (
        <View style={styles.notifPopup}>
          <Text style={styles.notifTitle}>
            {isArabic ? 'الإشعارات' : 'Notifications'}
          </Text>
          {loadingNoti ? (
            <ActivityIndicator color={Colors.primary} />
          ) : notifications.length === 0 ? (
            <Text style={styles.emptyText}>
              {isArabic ? 'لا توجد إشعارات' : 'No notifications'}
            </Text>
          ) : (
            notifications.slice(0, 5).map((n: any, i: number) => (
              <View key={i} style={styles.notifItem}>
                <Ionicons
                  name={
                    n.file_type === 'pdf'
                      ? 'document-text'
                      : n.file_type === 'mp4'
                      ? 'videocam'
                      : 'document'
                  }
                  size={18}
                  color={Colors.accent}
                />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.notifItemTitle} numberOfLines={1}>
                    {n.title}
                  </Text>
                  <Text style={styles.notifItemBody} numberOfLines={1}>
                    {n.body}
                  </Text>
                </View>
              </View>
            ))
          )}
          {notifications.length > 5 && (
            <TouchableOpacity
              onPress={() => {
                setShowNotifs(false);
                router.push('/notifications');
              }}
            >
              <Text style={styles.seeAllText}>
                {isArabic ? 'عرض الكل' : 'See all'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* بطاقة المستخدم */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={28} color={Colors.primary} />
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.name || '---'}</Text>
          <Text style={styles.profileEmail}>{user?.email || '---'}</Text>
          {user?.university_id ? (
            <Text style={styles.profileEmail}>
              {isArabic ? 'الرقم الجامعي: ' : 'ID: '}{user.university_id}
            </Text>
          ) : null}
          <View style={[styles.roleBadge, { backgroundColor: roleColor + '20' }]}>
            <Text style={[styles.roleText, { color: roleColor }]}>
              {roleLabel}
            </Text>
          </View>
        </View>
      </View>

      {/* قسم الكورسات */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {isArabic ? 'المواد الدراسية' : 'Courses'}
        </Text>
        {courses.length === 0 ? (
          <Text style={styles.emptyText}>
            {isArabic ? 'لا توجد مواد' : 'No courses yet'}
          </Text>
        ) : (
          courses.slice(0, 5).map((c: any) => (
            <TouchableOpacity
              key={c.id}
              style={styles.courseItem}
              onPress={() => router.push(`/course/${c.id}`)}
            >
              <Ionicons name="book-outline" size={18} color={Colors.primary} />
              <Text style={styles.courseItemText} numberOfLines={1}>
                {isArabic && c.name_ar ? c.name_ar : c.name}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* قسم كويزات الأدمن */}
      {isAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isArabic ? 'اختباراتي' : 'My Quizzes'}
          </Text>
          {loadingQuizzes ? (
            <ActivityIndicator color={Colors.primary} />
          ) : quizzes.length === 0 ? (
            <Text style={styles.emptyText}>
              {isArabic ? 'لا توجد اختبارات' : 'No quizzes yet'}
            </Text>
          ) : (
            quizzes.map((q: any) => (
              <View key={q.id} style={styles.quizCard}>
                <Text style={styles.quizTitle} numberOfLines={1}>
                  {isArabic && q.title_ar ? q.title_ar : q.title}
                </Text>
                <Text style={styles.quizMeta}>
                  {q.quiz_submissions?.length || 0}{' '}
                  {isArabic ? 'إجابة' : 'submissions'}
                </Text>
                <View style={styles.quizRow}>
                  <TouchableOpacity
                    style={styles.quizBtn}
                    onPress={() => openQuizResults(q.id)}
                  >
                    <Ionicons name="bar-chart-outline" size={16} color="#FFF" />
                    <Text style={styles.quizBtnText}>
                      {isArabic ? 'النتائج' : 'Results'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.quizBtn, { backgroundColor: Colors.primary }]}
                    onPress={() => downloadQuizPDF(q.id)}
                  >
                    <Ionicons name="download-outline" size={16} color="#FFF" />
                    <Text style={styles.quizBtnText}>PDF</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* روابط سريعة للأدمن */}
      {isAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isArabic ? 'لوحة التحكم' : 'Admin Panel'}
          </Text>
          <TouchableOpacity
            style={styles.adminLink}
            onPress={() => router.push('/admin')}
          >
            <Ionicons name="shield-outline" size={20} color={Colors.primary} />
            <Text style={styles.adminLinkText}>
              {isArabic ? 'لوحة الإدارة' : 'Admin Panel'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>

          {user?.role === 'super_admin' && (
            <TouchableOpacity
              style={styles.adminLink}
              onPress={() => router.push('/super-admin')}
            >
              <Ionicons name="star-outline" size={20} color={Colors.accent} />
              <Text style={styles.adminLinkText}>
                {isArabic ? 'لوحة السوبر أدمن' : 'Super Admin Panel'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* زر تسجيل الخروج */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#FFF" />
        <Text style={styles.logoutText}>
          {isArabic ? 'تسجيل الخروج' : 'Logout'}
        </Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F8' },
  content: { padding: 16 },
  notifDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: 'red', position: 'absolute', top: 0, right: 0,
  },
  notifPopup: {
    backgroundColor: '#FFF', borderRadius: 12, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  notifTitle: {
    fontSize: 16, fontWeight: '700',
    color: Colors.textPrimary, marginBottom: 12,
  },
  notifItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  notifItemTitle: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  notifItemBody: { fontSize: 12, color: Colors.textSecondary },
  seeAllText: {
    fontSize: 13, color: Colors.accent,
    fontWeight: '600', marginTop: 8, textAlign: 'center',
  },
  profileCard: {
    backgroundColor: '#FFF', padding: 16, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  avatar: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#EEE', justifyContent: 'center',
    alignItems: 'center', marginRight: 14,
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  profileEmail: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  roleBadge: {
    marginTop: 6, paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start',
  },
  roleText: { fontSize: 12, fontWeight: '700' },
  section: { marginBottom: 25 },
  sectionTitle: {
    fontSize: 18, fontWeight: '700',
    marginBottom: 12, color: Colors.textPrimary,
  },
  emptyText: { color: Colors.textSecondary, fontSize: 14 },
  courseItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', padding: 14,
    borderRadius: 10, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.border, gap: 10,
  },
  courseItemText: { flex: 1, fontSize: 14, color: Colors.textPrimary, fontWeight: '600' },
  quizCard: {
    backgroundColor: '#FFF', padding: 16,
    borderRadius: 12, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  quizTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  quizMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  quizRow: { flexDirection: 'row', marginTop: 10, gap: 10 },
  quizBtn: {
    flex: 1, backgroundColor: Colors.accent,
    paddingVertical: 10, borderRadius: 10,
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', gap: 6,
  },
  quizBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  adminLink: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', padding: 14,
    borderRadius: 10, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.border, gap: 10,
  },
  adminLinkText: { flex: 1, fontSize: 14, color: Colors.textPrimary, fontWeight: '600' },
  logoutBtn: {
    backgroundColor: Colors.accent, paddingVertical: 14,
    borderRadius: 12, flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center', gap: 6,
  },
  logoutText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
