import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, Alert, TouchableOpacity, RefreshControl
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiCall } from '../../../src/utils/api';
import { Colors } from '../../../src/constants/colors';
import { useAuth } from '../../../src/context/AuthContext';

interface Attempt {
  user_id: string;
  name: string;
  score: number;
  total: number;
  time_spent?: number;
  submitted_at?: string;
  created_at?: string | number;
}

const TOP_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32', '#7C9EFF', '#B388FF'];
const TOP_BG = ['#FFF9E6', '#F5F5F5', '#FBF0E8', '#EEF2FF', '#F5F0FF'];

export default function QuizResultsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const isArabic = user?.language === 'ar';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [quizTitle, setQuizTitle] = useState('');
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const loadResults = useCallback(async () => {
    try {
      const endpoint = isAdmin
        ? `/admin/quiz/${id}/results`
        : `/news/${id}/public-results`;
      const data = await apiCall(endpoint);
      if (!data?.quiz) {
        Alert.alert(isArabic ? 'خطأ' : 'Error', isArabic ? 'فشل تحميل النتائج' : 'Failed to load');
        return;
      }
      setQuizTitle(isArabic && data.quiz.title_ar ? data.quiz.title_ar : data.quiz.title);
      setPublished(!!data.quiz.quiz_results_published);
      const list = (data.attempts || data.submissions || []).slice().sort(
        (a: Attempt, b: Attempt) => {
          if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
          return (a.time_spent || 0) - (b.time_spent || 0);
        }
      );
      setAttempts(list);
    } catch (e: any) {
      Alert.alert(isArabic ? 'خطأ' : 'Error', e?.message || (isArabic ? 'فشل التحميل' : 'Failed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, isAdmin, isArabic]);

  useEffect(() => {
    loadResults();
    // تحديث تلقائي كل 20 ثانية للأدمن
    if (!isAdmin) return;
    const t = setInterval(loadResults, 20000);
    return () => clearInterval(t);
  }, [loadResults, isAdmin]);

  async function handlePublish() {
    if (publishing) return;
    Alert.alert(
      isArabic ? 'نشر النتائج' : 'Publish results',
      isArabic
        ? 'هتظهر في الأخبار بعنوان نتيجة الاختبار، والطلاب يقدروا يشوفوا الترتيب الكامل.'
        : 'A results post will appear in News for all students.',
      [
        { text: isArabic ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isArabic ? 'نشر' : 'Publish',
          onPress: async () => {
            setPublishing(true);
            try {
              await apiCall(`/news/${id}/publish-results`, { method: 'POST' });
              setPublished(true);
              Alert.alert('✅', isArabic ? 'تم نشر النتائج في الأخبار' : 'Results published to News');
            } catch {
              Alert.alert(isArabic ? 'خطأ' : 'Error', isArabic ? 'فشل النشر' : 'Publish failed');
            } finally {
              setPublishing(false);
            }
          },
        },
      ]
    );
  }

  function formatTime(seconds?: number): string {
    if (!seconds) return '—';
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  }

  function renderAttempt(item: Attempt, index: number, locked = false) {
    const total = item.total || 1;
    const pct = Math.round(((item.score || 0) / total) * 100);
    const isTop = index < 5;

    if (locked) {
      return (
        <View key={index} style={[styles.row, styles.rowLocked]}>
          <View style={styles.rankWrap}>
            <Ionicons name="lock-closed" size={16} color="#AAA" />
            <Text style={[styles.rank, { color: '#AAA' }]}>{index + 1}</Text>
          </View>
          <View style={styles.studentInfo}>
            <Text style={[styles.name, { color: '#AAA' }]}>••••••</Text>
            <Text style={styles.meta}>{isArabic ? 'مخفي — اضغط عرض الكل' : 'Hidden — show all'}</Text>
          </View>
          <Text style={[styles.score, { color: '#CCC' }]}>—/—</Text>
        </View>
      );
    }

    return (
      <View
        key={`${item.user_id}-${index}`}
        style={[
          styles.row,
          isTop && {
            borderColor: TOP_COLORS[index] + '99',
            backgroundColor: TOP_BG[index],
            borderWidth: 1.5,
          },
        ]}
      >
        <View style={styles.rankWrap}>
          <Ionicons
            name={index === 0 ? 'trophy' : index < 3 ? 'medal' : 'ribbon'}
            size={isTop ? 20 : 14}
            color={isTop ? TOP_COLORS[index] : Colors.textSecondary}
          />
          <Text style={[styles.rank, { color: isTop ? TOP_COLORS[index] : Colors.textSecondary }]}>
            {index + 1}
          </Text>
        </View>
        <View style={styles.studentInfo}>
          <Text style={styles.name} numberOfLines={1}>{item.name || '—'}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={12} color={Colors.textSecondary} />
            <Text style={styles.meta}>{formatTime(item.time_spent)}</Text>
            <Text style={styles.meta}> · {pct}%</Text>
          </View>
        </View>
        <View style={styles.scoreWrap}>
          <Text style={styles.score}>{item.score}/{total}</Text>
        </View>
      </View>
    );
  }

  const visible = showAll
    ? attempts
    : attempts.slice(0, 5);
  const hiddenCount = Math.max(0, attempts.length - 5);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={2}>{quizTitle}</Text>
          <Text style={styles.subtitle}>
            {isArabic
              ? `${attempts.length} مشارك · يُحدَّث تلقائياً`
              : `${attempts.length} participants · auto-refresh`}
          </Text>
        </View>
        {published && (
          <View style={styles.pubBadge}>
            <Text style={styles.pubBadgeText}>{isArabic ? 'منشور' : 'Published'}</Text>
          </View>
        )}
      </View>

      {attempts.length > 0 && (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>
              {Math.round(
                attempts.reduce((s, a) => s + ((a.score || 0) / (a.total || 1)) * 100, 0) /
                  attempts.length
              )}%
            </Text>
            <Text style={styles.statLabel}>{isArabic ? 'المعدل' : 'Avg'}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: Colors.success }]}>
              {attempts[0]?.score}/{attempts[0]?.total}
            </Text>
            <Text style={styles.statLabel}>{isArabic ? 'الأعلى' : 'Top'}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{attempts.length}</Text>
            <Text style={styles.statLabel}>{isArabic ? 'مشارك' : 'Joined'}</Text>
          </View>
        </View>
      )}

      <FlatList
        data={showAll ? attempts : [
          ...attempts.slice(0, 5),
          // صفوف مقفلة وهمية للعرض فقط
          ...(!showAll && hiddenCount > 0
            ? attempts.slice(5, Math.min(attempts.length, 8)).map((a, i) => ({ ...a, __locked: true, __idx: 5 + i }))
            : []),
        ]}
        keyExtractor={(item, i) => `${item.user_id || i}-${i}`}
        renderItem={({ item, index }) => {
          if ((item as any).__locked) {
            return renderAttempt(item, (item as any).__idx, true);
          }
          return renderAttempt(item, index, false);
        }}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadResults(); }}
            colors={[Colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="clipboard-outline" size={56} color={Colors.border} />
            <Text style={styles.empty}>
              {isArabic ? 'ما في محاولات بعد — النتائج تتحدث تلقائياً' : 'No attempts yet'}
            </Text>
          </View>
        }
        ListFooterComponent={
          <View style={{ gap: 10, marginTop: 8 }}>
            {hiddenCount > 0 && (
              <TouchableOpacity
                style={styles.showAllBtn}
                onPress={() => setShowAll(!showAll)}
              >
                <Ionicons name={showAll ? 'chevron-up' : 'lock-open-outline'} size={16} color={Colors.primary} />
                <Text style={styles.showAllText}>
                  {showAll
                    ? (isArabic ? 'إخفاء الباقي' : 'Hide rest')
                    : (isArabic ? `عرض الكل (${hiddenCount}+)` : `Show all (${hiddenCount}+)`)}
                </Text>
              </TouchableOpacity>
            )}

            {isAdmin && !published && (
              <TouchableOpacity
                style={styles.publishBtn}
                onPress={handlePublish}
                disabled={publishing}
              >
                {publishing ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="megaphone-outline" size={18} color="#FFF" />
                    <Text style={styles.publishText}>
                      {isArabic ? 'نشر النتائج في الأخبار' : 'Publish results to News'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {isAdmin && published && (
              <Text style={styles.publishedHint}>
                {isArabic
                  ? 'تم النشر — في الأخبار منشور «نتيجة: …» للطلاب'
                  : 'Published — students see it in News'}
              </Text>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, gap: 10, backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  pubBadge: {
    backgroundColor: Colors.success + '22', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  pubBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.success },
  statsRow: {
    flexDirection: 'row', backgroundColor: '#FFF', padding: 12, gap: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  statLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  listContent: { padding: 14, paddingBottom: 40 },
  row: {
    flexDirection: 'row', backgroundColor: '#FFF',
    padding: 12, borderRadius: 12, marginBottom: 8,
    alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  rowLocked: { opacity: 0.7, backgroundColor: '#F7F7F7' },
  rankWrap: { alignItems: 'center', width: 34 },
  rank: { fontSize: 13, fontWeight: '800', marginTop: 2 },
  studentInfo: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 },
  meta: { fontSize: 11, color: Colors.textSecondary },
  scoreWrap: { alignItems: 'flex-end' },
  score: { fontSize: 15, fontWeight: '800', color: Colors.primary },
  emptyWrap: { alignItems: 'center', paddingTop: 48, gap: 10 },
  empty: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  showAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: '#FFF',
  },
  showAllText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  publishBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: Colors.primary, paddingVertical: 14,
    borderRadius: 14, marginTop: 4,
  },
  publishText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  publishedHint: {
    textAlign: 'center', fontSize: 12, color: Colors.textSecondary, marginTop: 4,
  },
});
