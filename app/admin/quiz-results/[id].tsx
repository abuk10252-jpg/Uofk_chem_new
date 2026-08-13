import React, { useEffect, useState } from 'react';
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
  time_spent: number;
  submitted_at: string;
}

export default function QuizResultsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const isArabic = user?.language === 'ar';

  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [quizTitle, setQuizTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadResults();
  }, []);

  async function loadResults() {
    try {
      const data = await apiCall(`/admin/quiz/${id}/results`);

      if (!data?.quiz) {
        Alert.alert(
          isArabic ? 'خطأ' : 'Error',
          isArabic ? 'فشل تحميل النتائج' : 'Failed to load quiz results'
        );
        return;
      }

      setQuizTitle(
        isArabic && data.quiz.title_ar
          ? data.quiz.title_ar
          : data.quiz.title
      );

      // ترتيب حسب أعلى نتيجة
      const sorted = (data.attempts || []).sort(
        (a: Attempt, b: Attempt) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.time_spent - b.time_spent; // لو النتيجة متساوية الأسرع يتقدم
        }
      );

      setAttempts(sorted);
    } catch (e) {
      Alert.alert(
        isArabic ? 'خطأ' : 'Error',
        isArabic ? 'فشل تحميل النتائج' : 'Failed to load results'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function getRankColor(index: number): string {
    if (index === 0) return '#FFD700'; // ذهبي
    if (index === 1) return '#C0C0C0'; // فضي
    if (index === 2) return '#CD7F32'; // برونزي
    return Colors.textSecondary;
  }

  function getRankIcon(index: number): string {
    if (index === 0) return 'trophy';
    if (index === 1) return 'medal';
    if (index === 2) return 'ribbon';
    return 'person-outline';
  }

  function formatTime(seconds: number): string {
    if (!seconds) return '0s';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }

  function getScoreColor(score: number, total: number): string {
    if (!total) return Colors.textSecondary;
    const pct = (score / total) * 100;
    if (pct >= 80) return Colors.success;
    if (pct >= 60) return Colors.warning;
    return Colors.error;
  }

  function renderAttempt({ item, index }: { item: Attempt; index: number }) {
    const pct = item.total > 0
      ? Math.round((item.score / item.total) * 100)
      : 0;

    return (
      <View style={[
        styles.row,
        index === 0 && styles.firstPlace,
      ]}>
        {/* الترتيب */}
        <View style={styles.rankWrap}>
          <Ionicons
            name={getRankIcon(index) as any}
            size={index < 3 ? 22 : 16}
            color={getRankColor(index)}
          />
          <Text style={[styles.rank, { color: getRankColor(index) }]}>
            {index + 1}
          </Text>
        </View>

        {/* معلومات الطالب */}
        <View style={styles.studentInfo}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={12} color={Colors.textSecondary} />
            <Text style={styles.meta}>{formatTime(item.time_spent)}</Text>
            {item.submitted_at && (
              <>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.meta}>
                  {new Date(item.submitted_at).toLocaleDateString(
                    isArabic ? 'ar-SA' : 'en-US'
                  )}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* النتيجة */}
        <View style={styles.scoreWrap}>
          <Text style={[styles.score, { color: getScoreColor(item.score, item.total) }]}>
            {item.score}/{item.total}
          </Text>
          <Text style={[styles.pct, { color: getScoreColor(item.score, item.total) }]}>
            {pct}%
          </Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* الهيدر */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={2}>{quizTitle}</Text>
          <Text style={styles.subtitle}>
            {isArabic
              ? `${attempts.length} محاولة - مرتبة حسب أعلى نتيجة`
              : `${attempts.length} attempts - Sorted by highest score`}
          </Text>
        </View>
      </View>

      {/* إحصائيات سريعة */}
      {attempts.length > 0 && (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>
              {Math.round(
                attempts.reduce((sum, a) => sum + (a.score / a.total) * 100, 0) /
                attempts.length
              )}%
            </Text>
            <Text style={styles.statLabel}>
              {isArabic ? 'المعدل' : 'Average'}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: Colors.success }]}>
              {attempts[0]?.score}/{attempts[0]?.total}
            </Text>
            <Text style={styles.statLabel}>
              {isArabic ? 'أعلى نتيجة' : 'Highest'}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: Colors.error }]}>
              {attempts[attempts.length - 1]?.score}/{attempts[attempts.length - 1]?.total}
            </Text>
            <Text style={styles.statLabel}>
              {isArabic ? 'أدنى نتيجة' : 'Lowest'}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{attempts.length}</Text>
            <Text style={styles.statLabel}>
              {isArabic ? 'محاولة' : 'Attempts'}
            </Text>
          </View>
        </View>
      )}

      <FlatList
        data={attempts}
        keyExtractor={(_, i) => i.toString()}
        renderItem={renderAttempt}
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
            <Ionicons name="clipboard-outline" size={64} color={Colors.border} />
            <Text style={styles.empty}>
              {isArabic ? 'لا توجد محاولات بعد' : 'No attempts yet'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: {
    flex: 1, justifyContent: 'center',
    alignItems: 'center', backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, gap: 12, backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  title: {
    fontSize: 18, fontWeight: '800', color: Colors.textPrimary,
  },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  statsRow: {
    flexDirection: 'row', backgroundColor: '#FFF',
    padding: 16, gap: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  statItem: {
    flex: 1, alignItems: 'center', gap: 2,
  },
  statNum: {
    fontSize: 18, fontWeight: '800', color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 11, color: Colors.textSecondary, fontWeight: '600',
  },
  listContent: { padding: 16, paddingBottom: 32 },
  row: {
    flexDirection: 'row', backgroundColor: '#FFF',
    padding: 14, borderRadius: 14, marginBottom: 8,
    alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: 'rgba(0,33,71,0.05)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03, shadowRadius: 6, elevation: 2,
  },
  firstPlace: {
    borderColor: '#FFD700',
    backgroundColor: '#FFFBEB',
  },
  rankWrap: { alignItems: 'center', width: 36 },
  rank: { fontSize: 14, fontWeight: '800', marginTop: 2 },
  studentInfo: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  meta: { fontSize: 12, color: Colors.textSecondary },
  metaDot: { fontSize: 12, color: Colors.textSecondary },
  scoreWrap: { alignItems: 'center' },
  score: { fontSize: 16, fontWeight: '800' },
  pct: { fontSize: 12, fontWeight: '600' },
  emptyWrap: { alignItems: 'center', marginTop: 80, gap: 12 },
  empty: { fontSize: 16, color: Colors.textSecondary, fontWeight: '600' },
});
