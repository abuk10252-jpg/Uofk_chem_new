import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Linking, Alert, Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { Colors } from '../../src/constants/colors';
import AnimatedPressable from '../../src/components/AnimatedPressable';
import { apiCall } from '../../src/utils/api';
import { confirmAction } from '../../src/utils/confirmAction';
import * as ImagePicker from 'expo-image-picker';

export default function ProfileTab() {
  const { user, logout, updatePhoto } = useAuth();
  const { theme, toggleTheme } = useTheme();
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
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

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
          (n: any) => n.type === 'quiz' && n.created_by === user?.id
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

  async function handlePickPhoto() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          isArabic ? 'إذن مطلوب' : 'Permission needed',
          isArabic
            ? 'محتاجين إذن الوصول للصور عشان تقدر تغيّر صورة البروفايل'
            : 'We need access to your photos to update your profile picture'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (result.canceled || !result.assets?.[0]) return;

      setUploadingPhoto(true);
      const res = await updatePhoto(result.assets[0].uri);
      if (!res.success) {
        Alert.alert(isArabic ? 'خطأ' : 'Error', res.message);
      }
    } catch (e) {
      Alert.alert(
        isArabic ? 'خطأ' : 'Error',
        isArabic ? 'فشل تغيير الصورة' : 'Failed to update photo'
      );
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleLogout() {
    confirmAction({
      title: isArabic ? 'تسجيل الخروج' : 'Logout',
      message: isArabic ? 'هل تريد تسجيل الخروج؟' : 'Are you sure you want to logout?',
      confirmText: isArabic ? 'خروج' : 'Logout',
      cancelText: isArabic ? 'إلغاء' : 'Cancel',
      destructive: true,
      onConfirm: async () => {
        try {
          await logout();
          router.replace('/login');
        } catch (e) {
          console.warn('logout error:', e);
          router.replace('/login');
        }
      },
    });
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

      {/* زر الوضع الليلي وزر الإشعارات */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <AnimatedPressable
          onPress={toggleTheme}
          style={styles.themeToggleBtn}
        >
          <Ionicons
            name={theme === 'dark' ? 'sunny-outline' : 'moon-outline'}
            size={20}
            color={Colors.accent}
          />
        </AnimatedPressable>

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
        <TouchableOpacity
          style={styles.avatar}
          onPress={handlePickPhoto}
          disabled={uploadingPhoto}
          activeOpacity={0.7}
        >
          {uploadingPhoto ? (
            <ActivityIndicator color={Colors.primary} />
          ) : user?.profile_pic ? (
            <Image source={{ uri: user.profile_pic }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={30} color="#FFF" />
          )}
          <View style={styles.avatarEditBadge}>
            <Ionicons name="camera" size={12} color="#FFF" />
          </View>
        </TouchableOpacity>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.name || '---'}</Text>
          <Text style={styles.profileEmail}>{user?.email || '---'}</Text>
          {user?.university_id ? (
            <Text style={styles.profileEmail}>
              {isArabic ? 'الرقم الجامعي: ' : 'ID: '}{user.university_id}
            </Text>
          ) : null}
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>
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

          <TouchableOpacity
            style={styles.adminLink}
            onPress={() => router.push('/admin-chat')}
          >
            <Ionicons name="chatbubbles-outline" size={20} color={Colors.primary} />
            <Text style={styles.adminLinkText}>
              {isArabic ? 'قناة الأدمنز' : 'Admin Channel'}
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
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingTop: 12 },
  themeToggleBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  notifDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.error, position: 'absolute', top: 0, right: 0,
    borderWidth: 2, borderColor: Colors.background,
  },
  notifPopup: {
    backgroundColor: Colors.card, borderRadius: 20, padding: 18,
    marginBottom: 18, borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1, shadowRadius: 20, elevation: 6,
  },
  notifTitle: {
    fontSize: 17, fontWeight: '800',
    color: Colors.textPrimary, marginBottom: 14, letterSpacing: -0.3,
  },
  notifItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  notifItemTitle: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  notifItemBody: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  seeAllText: {
    fontSize: 13, color: Colors.accent,
    fontWeight: '700', marginTop: 12, textAlign: 'center',
  },
  profileCard: {
    backgroundColor: Colors.primary, padding: 22, borderRadius: 24,
    flexDirection: 'row', alignItems: 'center', marginBottom: 22,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25, shadowRadius: 20, elevation: 8,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center',
    alignItems: 'center', marginRight: 16, overflow: 'visible',
    borderWidth: 3, borderColor: Colors.accent,
  },
  avatarImage: {
    width: 66, height: 66, borderRadius: 33,
  },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.primary,
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 20, fontWeight: '800', color: '#FFF', letterSpacing: -0.3 },
  profileEmail: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 3 },
  roleBadge: {
    marginTop: 10, paddingHorizontal: 12,
    paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  roleText: { fontSize: 12, fontWeight: '700', color: Colors.accent },
  section: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 15, fontWeight: '800',
    marginBottom: 14, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  emptyText: { color: Colors.textSecondary, fontSize: 14 },
  courseItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, padding: 16,
    borderRadius: 16, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.border, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  courseItemText: { flex: 1, fontSize: 15, color: Colors.textPrimary, fontWeight: '600' },
  quizCard: {
    backgroundColor: Colors.card, padding: 18,
    borderRadius: 18, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  quizTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  quizMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  quizRow: { flexDirection: 'row', marginTop: 12, gap: 10 },
  quizBtn: {
    flex: 1, backgroundColor: Colors.accent,
    paddingVertical: 12, borderRadius: 14,
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', gap: 6,
  },
  quizBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  adminLink: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, padding: 16,
    borderRadius: 16, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.border, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  adminLinkText: { flex: 1, fontSize: 15, color: Colors.textPrimary, fontWeight: '600' },
  logoutBtn: {
    backgroundColor: Colors.error, paddingVertical: 16,
    borderRadius: 16, flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center', gap: 8,
    shadowColor: Colors.error, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 4,
  },
  logoutText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
