import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator,
  TouchableOpacity, RefreshControl, StyleSheet
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiCall } from '../../src/utils/api';
import { Colors } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';

interface Notification {
  id: string;
  title: string;
  body: string;
  file_type?: string;
  course_id?: string;
  created_at: string;
  read?: boolean;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isArabic = user?.language === 'ar';

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
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
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, []);

  function getIcon(fileType?: string): string {
    if (!fileType) return 'notifications-outline';
    const t = fileType.toLowerCase();
    if (t === 'pdf') return 'document-text';
    if (['mp4', 'mov', 'avi'].includes(t)) return 'videocam';
    if (['jpg', 'jpeg', 'png'].includes(t)) return 'image';
    if (['mp3', 'wav'].includes(t)) return 'musical-notes';
    return 'document';
  }

  function getIconColor(fileType?: string): string {
    if (!fileType) return Colors.primary;
    const t = fileType.toLowerCase();
    if (t === 'pdf') return '#EF4444';
    if (['mp4', 'mov', 'avi'].includes(t)) return '#8B5CF6';
    if (['jpg', 'jpeg', 'png'].includes(t)) return '#3B82F6';
    return Colors.accent;
  }

  function formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return isArabic ? 'الآن' : 'Just now';
      if (diffMins < 60) return isArabic ? `منذ ${diffMins} دقيقة` : `${diffMins}m ago`;
      if (diffHours < 24) return isArabic ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`;
      if (diffDays < 7) return isArabic ? `منذ ${diffDays} يوم` : `${diffDays}d ago`;

      return date.toLocaleDateString(
        isArabic ? 'ar-SA' : 'en-US',
        { year: 'numeric', month: 'short', day: 'numeric' }
      );
    } catch {
      return dateStr;
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
          colors={[Colors.primary]}
        />
      }
    >
      {/* الهيدر */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isArabic ? 'الإشعارات' : 'Notifications'}
        </Text>
        <Text style={styles.headerCount}>
          {notifications.length}
        </Text>
      </View>

      {/* لو ما فيه إشعارات */}
      {notifications.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="notifications-off-outline" size={64} color={Colors.border} />
          <Text style={styles.emptyText}>
            {isArabic ? 'لا توجد إشعارات' : 'No notifications yet'}
          </Text>
          <Text style={styles.emptySubText}>
            {isArabic
              ? 'ستظهر هنا الإشعارات عند إضافة ملفات جديدة'
              : 'Notifications will appear here when new files are added'}
          </Text>
        </View>
      ) : (
        notifications.map((n, i) => (
          <TouchableOpacity
            key={n.id || i}
            style={[styles.notifCard, !n.read && styles.notifCardUnread]}
            onPress={() => {
              if (n.course_id) {
                router.push(`/course/${n.course_id}`);
              }
            }}
            activeOpacity={n.course_id ? 0.7 : 1}
          >
            {/* أيقونة نوع الملف */}
            <View style={[
              styles.iconWrap,
              { backgroundColor: getIconColor(n.file_type) + '15' }
            ]}>
              <Ionicons
                name={getIcon(n.file_type) as any}
                size={22}
                color={getIconColor(n.file_type)}
              />
            </View>

            {/* محتوى الإشعار */}
            <View style={styles.notifContent}>
              <Text style={styles.notifTitle} numberOfLines={1}>
                {n.title}
              </Text>
              <Text style={styles.notifBody} numberOfLines={2}>
                {n.body}
              </Text>
              <Text style={styles.notifTime}>
                {formatDate(n.created_at)}
              </Text>
            </View>

            {/* مؤشر غير مقروء */}
            {!n.read && <View style={styles.unreadDot} />}

            {/* سهم لو في كورس */}
            {n.course_id && (
              <Ionicons
                name="chevron-forward"
                size={16}
                color={Colors.textSecondary}
              />
            )}
          </TouchableOpacity>
        ))
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F8' },
  content: { padding: 16 },
  center: {
    flex: 1, justifyContent: 'center',
    alignItems: 'center', backgroundColor: '#F8F8F8',
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 20, gap: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FFF', alignItems: 'center',
    justifyContent: 'center', borderWidth: 1,
    borderColor: Colors.border,
  },
  headerTitle: {
    flex: 1, fontSize: 22,
    fontWeight: '700', color: Colors.textPrimary,
  },
  headerCount: {
    fontSize: 14, color: Colors.textSecondary,
    fontWeight: '600',
  },
  emptyWrap: {
    alignItems: 'center', marginTop: 80, paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18, fontWeight: '700',
    color: Colors.textPrimary, marginTop: 16,
  },
  emptySubText: {
    fontSize: 14, color: Colors.textSecondary,
    marginTop: 8, textAlign: 'center', lineHeight: 20,
  },
  notifCard: {
    backgroundColor: '#FFF', borderRadius: 14,
    padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  notifCardUnread: {
    borderColor: Colors.accent + '40',
    backgroundColor: Colors.accent + '05',
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  notifContent: { flex: 1 },
  notifTitle: {
    fontSize: 14, fontWeight: '700', color: Colors.textPrimary,
  },
  notifBody: {
    fontSize: 13, color: Colors.textSecondary,
    marginTop: 2, lineHeight: 18,
  },
  notifTime: {
    fontSize: 11, color: '#999', marginTop: 4,
  },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.accent,
  },
});
