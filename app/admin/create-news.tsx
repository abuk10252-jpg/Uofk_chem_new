import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { Colors } from '../../src/constants/colors';
import { apiCall } from '../../src/utils/api';

interface QuizQ {
  question: string;
  options: string[];
  correct_answer: number;
}

export default function CreateNewsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isArabic = user?.language === 'ar';

  const [type, setType] = useState<'news' | 'poll' | 'quiz'>('news');
  const [title, setTitle] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [content, setContent] = useState('');
  const [contentAr, setContentAr] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [quizQuestions, setQuizQuestions] = useState<QuizQ[]>([
    { question: '', options: ['', '', '', ''], correct_answer: 0 }
  ]);
  const [timeLimit, setTimeLimit] = useState('10');
  const [loading, setLoading] = useState(false);

  // Poll functions
  function addPollOption() {
    setPollOptions(prev => [...prev, '']);
  }

  function updatePollOption(i: number, v: string) {
    setPollOptions(prev => prev.map((o, idx) => idx === i ? v : o));
  }

  function removePollOption(i: number) {
    if (pollOptions.length <= 2) return;
    setPollOptions(prev => prev.filter((_, idx) => idx !== i));
  }

  // Quiz functions
  function addQuestion() {
    setQuizQuestions(prev => [
      ...prev,
      { question: '', options: ['', '', '', ''], correct_answer: 0 }
    ]);
  }

  function removeQuestion(i: number) {
    if (quizQuestions.length <= 1) return;
    setQuizQuestions(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateQuestion(i: number, field: string, value: any) {
    setQuizQuestions(prev =>
      prev.map((q, idx) => idx === i ? { ...q, [field]: value } : q)
    );
  }

  function updateQuizOption(qi: number, oi: number, v: string) {
    setQuizQuestions(prev =>
      prev.map((q, idx) =>
        idx === qi
          ? { ...q, options: q.options.map((o, j) => j === oi ? v : o) }
          : q
      )
    );
  }

  async function handleCreate() {
    // التحقق من العنوان
    if (!title.trim()) {
      Alert.alert(
        isArabic ? 'خطأ' : 'Error',
        isArabic ? 'العنوان مطلوب' : 'Title is required'
      );
      return;
    }

    // التحقق من خيارات الاستطلاع
    if (type === 'poll') {
      const valid = pollOptions.filter(o => o.trim());
      if (valid.length < 2) {
        Alert.alert(
          isArabic ? 'خطأ' : 'Error',
          isArabic ? 'يجب إضافة خيارين على الأقل' : 'At least 2 poll options required'
        );
        return;
      }
    }

    // التحقق من أسئلة الاختبار
    if (type === 'quiz') {
      for (let i = 0; i < quizQuestions.length; i++) {
        const q = quizQuestions[i];
        if (!q.question.trim()) {
          Alert.alert(
            isArabic ? 'خطأ' : 'Error',
            isArabic ? `السؤال ${i + 1} فارغ` : `Question ${i + 1} is empty`
          );
          return;
        }
        const validOpts = q.options.filter(o => o.trim());
        if (validOpts.length < 2) {
          Alert.alert(
            isArabic ? 'خطأ' : 'Error',
            isArabic
              ? `السؤال ${i + 1} يحتاج خيارين على الأقل`
              : `Question ${i + 1} needs at least 2 options`
          );
          return;
        }
      }
    }

    setLoading(true);
    try {
      const body: any = {
        type,
        title: title.trim(),
        title_ar: titleAr.trim(),
        content: content.trim(),
        content_ar: contentAr.trim(),
      };

      if (type === 'poll') {
        body.poll_options = pollOptions
          .filter(o => o.trim())
          .map(o => ({ text: o.trim() }));
      }

      if (type === 'quiz') {
        body.quiz_questions = quizQuestions.map(q => ({
          question: q.question.trim(),
          options: q.options
            .filter(o => o.trim())
            .map(o => ({ text: o.trim() })),
          correct_answer: q.correct_answer,
        }));
        body.quiz_time_limit = parseInt(timeLimit) || 10;
      }

      const data = await apiCall('/news/', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (data) {
        Alert.alert(
          '✅',
          isArabic ? 'تم النشر بنجاح!' : 'Posted successfully!',
          [{ text: isArabic ? 'حسناً' : 'OK', onPress: () => router.back() }]
        );
      } else {
        throw new Error('Failed to create post');
      }
    } catch (e: any) {
      Alert.alert(
        isArabic ? 'خطأ' : 'Error',
        e.message || (isArabic ? 'فشل النشر' : 'Failed to post')
      );
    } finally {
      setLoading(false);
    }
  }

  function getTypeLabel(t: string): string {
    if (isArabic) {
      if (t === 'news') return 'خبر';
      if (t === 'poll') return 'استطلاع';
      return 'اختبار';
    }
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function getTypeIcon(t: string): string {
    if (t === 'news') return 'megaphone';
    if (t === 'poll') return 'bar-chart';
    return 'help-circle';
  }

  function getSubmitLabel(): string {
    if (isArabic) {
      if (type === 'quiz') return 'إنشاء اختبار';
      if (type === 'poll') return 'إنشاء استطلاع';
      return 'نشر الخبر';
    }
    if (type === 'quiz') return 'Create Quiz';
    if (type === 'poll') return 'Create Poll';
    return 'Post News';
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* اختيار النوع */}
        <View style={styles.typeRow}>
          {(['news', 'poll', 'quiz'] as const).map(t => (
            <TouchableOpacity
              key={t}
              testID={`type-${t}-btn`}
              style={[styles.typeBtn, type === t && styles.typeBtnActive]}
              onPress={() => setType(t)}
            >
              <Ionicons
                name={getTypeIcon(t) as any}
                size={16}
                color={type === t ? '#FFF' : Colors.textSecondary}
              />
              <Text style={[styles.typeText, type === t && styles.typeTextActive]}>
                {getTypeLabel(t)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.card}>

          {/* العنوان */}
          <Text style={styles.label}>
            {isArabic ? 'العنوان (إنجليزي) *' : 'Title (English) *'}
          </Text>
          <TextInput
            testID="news-title-input"
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder={isArabic ? 'أدخل العنوان...' : 'Enter title...'}
            placeholderTextColor={Colors.textSecondary}
            editable={!loading}
          />

          <Text style={styles.label}>
            {isArabic ? 'العنوان (عربي)' : 'Title (Arabic)'}
          </Text>
          <TextInput
            style={[styles.input, { textAlign: 'right' }]}
            value={titleAr}
            onChangeText={setTitleAr}
            placeholder="أدخل العنوان بالعربي..."
            placeholderTextColor={Colors.textSecondary}
            editable={!loading}
          />

          {/* المحتوى */}
          <Text style={styles.label}>
            {isArabic ? 'المحتوى (إنجليزي)' : 'Content (English)'}
          </Text>
          <TextInput
            testID="news-content-input"
            style={[styles.input, styles.multiline]}
            value={content}
            onChangeText={setContent}
            placeholder={isArabic ? 'اكتب المحتوى...' : 'Write content...'}
            multiline
            numberOfLines={3}
            placeholderTextColor={Colors.textSecondary}
            editable={!loading}
          />

          <Text style={styles.label}>
            {isArabic ? 'المحتوى (عربي)' : 'Content (Arabic)'}
          </Text>
          <TextInput
            style={[styles.input, styles.multiline, { textAlign: 'right' }]}
            value={contentAr}
            onChangeText={setContentAr}
            placeholder="اكتب المحتوى بالعربي..."
            multiline
            numberOfLines={3}
            placeholderTextColor={Colors.textSecondary}
            editable={!loading}
          />

          {/* خيارات الاستطلاع */}
          {type === 'poll' && (
            <View>
              <Text style={styles.label}>
                {isArabic ? 'خيارات الاستطلاع' : 'Poll Options'}
              </Text>
              {pollOptions.map((opt, i) => (
                <View key={i} style={styles.optionRow}>
                  <TextInput
                    testID={`poll-option-input-${i}`}
                    style={[styles.input, { flex: 1 }]}
                    value={opt}
                    onChangeText={v => updatePollOption(i, v)}
                    placeholder={isArabic ? `الخيار ${i + 1}` : `Option ${i + 1}`}
                    placeholderTextColor={Colors.textSecondary}
                    editable={!loading}
                  />
                  {pollOptions.length > 2 && (
                    <TouchableOpacity
                      style={styles.removeOpt}
                      onPress={() => removePollOption(i)}
                    >
                      <Ionicons name="close-circle" size={22} color={Colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity
                testID="add-poll-option-btn"
                style={styles.addOptBtn}
                onPress={addPollOption}
              >
                <Ionicons name="add" size={18} color={Colors.accent} />
                <Text style={styles.addOptText}>
                  {isArabic ? 'إضافة خيار' : 'Add Option'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* أسئلة الاختبار */}
          {type === 'quiz' && (
            <View>
              {/* وقت الاختبار */}
              <View style={styles.timeLimitRow}>
                <Text style={styles.label}>
                  {isArabic ? 'وقت الاختبار (دقيقة)' : 'Time Limit (minutes)'}
                </Text>
                <TextInput
                  testID="quiz-time-input"
                  style={[styles.input, styles.timeLimitInput]}
                  value={timeLimit}
                  onChangeText={setTimeLimit}
                  keyboardType="numeric"
                  placeholderTextColor={Colors.textSecondary}
                  editable={!loading}
                />
              </View>

              {quizQuestions.map((q, qi) => (
                <View key={qi} style={styles.questionCard}>
                  <View style={styles.qHeader}>
                    <Text style={styles.qLabel}>
                      {isArabic ? `السؤال ${qi + 1}` : `Question ${qi + 1}`}
                    </Text>
                    {quizQuestions.length > 1 && (
                      <TouchableOpacity onPress={() => removeQuestion(qi)}>
                        <Ionicons name="trash-outline" size={18} color={Colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <TextInput
                    testID={`quiz-q-${qi}`}
                    style={styles.input}
                    value={q.question}
                    onChangeText={v => updateQuestion(qi, 'question', v)}
                    placeholder={isArabic ? 'أدخل السؤال...' : 'Enter question...'}
                    placeholderTextColor={Colors.textSecondary}
                    editable={!loading}
                  />

                  <Text style={styles.correctHint}>
                    {isArabic
                      ? 'اضغط على الدائرة لتحديد الإجابة الصحيحة'
                      : 'Tap the circle to mark correct answer'}
                  </Text>

                  {q.options.map((opt, oi) => (
                    <View key={oi} style={styles.quizOptRow}>
                      <TouchableOpacity
                        testID={`quiz-correct-${qi}-${oi}`}
                        style={[
                          styles.radioBtn,
                          q.correct_answer === oi && styles.radioBtnActive,
                        ]}
                        onPress={() => updateQuestion(qi, 'correct_answer', oi)}
                      >
                        {q.correct_answer === oi && (
                          <View style={styles.radioInner} />
                        )}
                      </TouchableOpacity>
                      <TextInput
                        testID={`quiz-opt-${qi}-${oi}`}
                        style={[styles.input, { flex: 1 }]}
                        value={opt}
                        onChangeText={v => updateQuizOption(qi, oi, v)}
                        placeholder={`${isArabic ? 'الخيار' : 'Option'} ${String.fromCharCode(65 + oi)}`}
                        placeholderTextColor={Colors.textSecondary}
                        editable={!loading}
                      />
                    </View>
                  ))}
                </View>
              ))}

              <TouchableOpacity
                testID="add-question-btn"
                style={styles.addOptBtn}
                onPress={addQuestion}
              >
                <Ionicons name="add" size={18} color={Colors.accent} />
                <Text style={styles.addOptText}>
                  {isArabic ? 'إضافة سؤال' : 'Add Question'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* زر الإنشاء */}
          <TouchableOpacity
            testID="create-news-submit"
            style={[styles.btn, loading && { opacity: 0.7 }]}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="send" size={18} color="#FFF" />
                <Text style={styles.btnText}>{getSubmitLabel()}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, paddingBottom: 40 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 5, paddingVertical: 12,
    borderRadius: 12, backgroundColor: '#FFF',
    borderWidth: 1, borderColor: Colors.border,
  },
  typeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  typeTextActive: { color: '#FFF' },
  card: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04, shadowRadius: 12, elevation: 3,
  },
  label: {
    fontSize: 14, fontWeight: '600',
    color: Colors.textPrimary, marginBottom: 6, marginTop: 14,
  },
  input: {
    backgroundColor: Colors.background, borderWidth: 1,
    borderColor: Colors.border, borderRadius: 12,
    padding: 14, fontSize: 15, color: Colors.textPrimary,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  optionRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 8,
  },
  removeOpt: { padding: 4 },
  addOptBtn: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 4,
    paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.accent,
    borderStyle: 'dashed', marginTop: 8,
  },
  addOptText: { fontSize: 14, fontWeight: '600', color: Colors.accent },
  timeLimitRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: 8,
  },
  timeLimitInput: {
    width: 80, textAlign: 'center',
  },
  questionCard: {
    backgroundColor: Colors.background, borderRadius: 14,
    padding: 14, marginBottom: 12, marginTop: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  qHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  qLabel: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  quizOptRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginBottom: 8,
  },
  radioBtn: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioBtnActive: { borderColor: Colors.accent },
  radioInner: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: Colors.accent,
  },
  correctHint: {
    fontSize: 12, color: Colors.textSecondary,
    marginBottom: 8, fontStyle: 'italic',
  },
  btn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 16, marginTop: 24,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
  },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
