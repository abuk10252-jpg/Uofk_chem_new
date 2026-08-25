import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Alert, Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { useAuth } from '../../src/context/AuthContext';
import { Colors } from '../../src/constants/colors';
import { apiCall, uploadFile } from '../../src/utils/api';

interface QuizQ {
  question: string;
  options: string[];
  correct_answer: number;
}

interface Attachment {
  uri: string;
  name: string;
  type: 'image' | 'video' | 'audio' | 'file';
  mimeType?: string;
}

export default function CreateNewsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isArabic = user?.language === 'ar';

  const [type, setType] = useState<'news' | 'poll' | 'quiz'>('news');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [quizQuestions, setQuizQuestions] = useState<QuizQ[]>([
    { question: '', options: ['', '', '', ''], correct_answer: 0 }
  ]);
  const [timeLimit, setTimeLimit] = useState('10');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);

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

  // ========== المرفقات ==========
  async function pickImage(fromCamera = false) {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(isArabic ? 'خطأ' : 'Error', isArabic ? 'محتاج إذن الكاميرا/المعرض' : 'Permission required');
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.All,
          quality: 0.8,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.All,
          quality: 0.8,
        });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const isVideo = asset.type === 'video';
      setAttachment({
        uri: asset.uri,
        name: asset.fileName || `media_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
        type: isVideo ? 'video' : 'image',
        mimeType: asset.mimeType,
      });
    }
  }

  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setAttachment({
        uri: asset.uri,
        name: asset.name,
        type: 'file',
        mimeType: asset.mimeType || 'application/octet-stream',
      });
    }
  }

  async function startRecording() {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(isArabic ? 'خطأ' : 'Error', isArabic ? 'محتاج إذن الميكروفون' : 'Microphone permission required');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (e) {
      Alert.alert(isArabic ? 'خطأ' : 'Error', isArabic ? 'فشل بدء التسجيل' : 'Failed to start recording');
    }
  }

  async function stopRecording() {
    if (!recordingRef.current) return;
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setIsRecording(false);
      if (uri) {
        setAttachment({
          uri,
          name: `voice_${Date.now()}.m4a`,
          type: 'audio',
          mimeType: 'audio/m4a',
        });
      }
    } catch (e) {
      setIsRecording(false);
      Alert.alert(isArabic ? 'خطأ' : 'Error', isArabic ? 'فشل إيقاف التسجيل' : 'Failed to stop recording');
    }
  }

  async function uploadAttachment(): Promise<string | null> {
    if (!attachment) return null;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: attachment.uri,
        name: attachment.name,
        type: attachment.mimeType || 'application/octet-stream',
      } as any);

      const data = await uploadFile('/news/upload-attachment', formData);
      return data?.url || null;
    } catch (e: any) {
      console.warn('Upload failed:', e);
      Alert.alert(isArabic ? 'خطأ' : 'Error', isArabic ? 'فشل رفع المرفق' : 'Failed to upload attachment');
      return null;
    } finally {
      setUploading(false);
    }
  }

  // ========== إنشاء الخبر ==========
  async function handleCreate() {
    if (!title.trim()) {
      Alert.alert(
        isArabic ? 'خطأ' : 'Error',
        isArabic ? 'العنوان مطلوب' : 'Title is required'
      );
      return;
    }

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
      let imageUrl = '';
      if (attachment) {
        const uploaded = await uploadAttachment();
        if (!uploaded) {
          setLoading(false);
          return;
        }
        imageUrl = uploaded;
      }

      const body: any = {
        type,
        title: title.trim(),
        title_ar: title.trim(),
        content: content.trim(),
        content_ar: content.trim(),
        image: imageUrl,
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
        <View style={styles.typeRow}>
          {(['news', 'poll', 'quiz'] as const).map(t => (
            <TouchableOpacity
              key={t}
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
          <Text style={styles.label}>{isArabic ? 'العنوان *' : 'Title *'}</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder={isArabic ? 'أدخل العنوان...' : 'Enter title...'}
            placeholderTextColor={Colors.textSecondary}
            editable={!loading}
          />

          <Text style={styles.label}>{isArabic ? 'المحتوى' : 'Content'}</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={content}
            onChangeText={setContent}
            placeholder={isArabic ? 'اكتب المحتوى...' : 'Write content...'}
            multiline
            numberOfLines={3}
            placeholderTextColor={Colors.textSecondary}
            editable={!loading}
          />

          {attachment && (
            <View style={styles.attachmentPreview}>
              {attachment.type === 'image' ? (
                <Image source={{ uri: attachment.uri }} style={styles.previewImage} />
              ) : (
                <View style={styles.filePreview}>
                  <Ionicons
                    name={
                      attachment.type === 'video' ? 'videocam' :
                      attachment.type === 'audio' ? 'mic' : 'document'
                    }
                    size={28}
                    color={Colors.primary}
                  />
                  <Text style={styles.fileName} numberOfLines={1}>{attachment.name}</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.removeAttachment}
                onPress={() => setAttachment(null)}
              >
                <Ionicons name="close-circle" size={24} color={Colors.error} />
              </TouchableOpacity>
            </View>
          )}

          {type === 'poll' && (
            <View>
              <Text style={styles.label}>{isArabic ? 'خيارات الاستطلاع' : 'Poll Options'}</Text>
              {pollOptions.map((opt, i) => (
                <View key={i} style={styles.optionRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={opt}
                    onChangeText={v => updatePollOption(i, v)}
                    placeholder={isArabic ? `الخيار ${i + 1}` : `Option ${i + 1}`}
                    placeholderTextColor={Colors.textSecondary}
                    editable={!loading}
                  />
                  {pollOptions.length > 2 && (
                    <TouchableOpacity style={styles.removeOpt} onPress={() => removePollOption(i)}>
                      <Ionicons name="close-circle" size={22} color={Colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity style={styles.addOptBtn} onPress={addPollOption}>
                <Ionicons name="add" size={18} color={Colors.accent} />
                <Text style={styles.addOptText}>{isArabic ? 'إضافة خيار' : 'Add Option'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {type === 'quiz' && (
            <View>
              <View style={styles.timeLimitRow}>
                <Text style={styles.label}>{isArabic ? 'وقت الاختبار (دقيقة)' : 'Time Limit (minutes)'}</Text>
                <TextInput
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
                    <Text style={styles.qLabel}>{isArabic ? `السؤال ${qi + 1}` : `Question ${qi + 1}`}</Text>
                    {quizQuestions.length > 1 && (
                      <TouchableOpacity onPress={() => removeQuestion(qi)}>
                        <Ionicons name="trash-outline" size={18} color={Colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <TextInput
                    style={styles.input}
                    value={q.question}
                    onChangeText={v => updateQuestion(qi, 'question', v)}
                    placeholder={isArabic ? 'أدخل السؤال...' : 'Enter question...'}
                    placeholderTextColor={Colors.textSecondary}
                    editable={!loading}
                  />

                  <Text style={styles.correctHint}>
                    {isArabic ? 'اضغط على الدائرة لتحديد الإجابة الصحيحة' : 'Tap the circle to mark correct answer'}
                  </Text>

                  {q.options.map((opt, oi) => (
                    <View key={oi} style={styles.quizOptRow}>
                      <TouchableOpacity
                        style={[styles.radioBtn, q.correct_answer === oi && styles.radioBtnActive]}
                        onPress={() => updateQuestion(qi, 'correct_answer', oi)}
                      >
                        {q.correct_answer === oi && <View style={styles.radioInner} />}
                      </TouchableOpacity>
                      <TextInput
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

              <TouchableOpacity style={styles.addOptBtn} onPress={addQuestion}>
                <Ionicons name="add" size={18} color={Colors.accent} />
                <Text style={styles.addOptText}>{isArabic ? 'إضافة سؤال' : 'Add Question'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, (loading || uploading) && styles.submitDisabled]}
          onPress={handleCreate}
          disabled={loading || uploading}
        >
          {(loading || uploading) ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitText}>{getSubmitLabel()}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.attachBar}>
        <TouchableOpacity style={styles.attachBtn} onPress={() => pickImage(true)}>
          <Ionicons name="camera" size={24} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.attachBtnSecondary} onPress={() => pickImage(false)}>
          <Ionicons name="image" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.attachBtnSecondary} onPress={pickDocument}>
          <Ionicons name="attach" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.attachBtnSecondary, isRecording && styles.recordingBtn]}
          onPress={isRecording ? stopRecording : startRecording}
        >
          <Ionicons
            name={isRecording ? 'stop-circle' : 'mic'}
            size={22}
            color={isRecording ? '#FFF' : Colors.textSecondary}
          />
        </TouchableOpacity>

        {attachment && (
          <Text style={styles.attachHint} numberOfLines={1}>
            {attachment.name}
          </Text>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, paddingBottom: 100 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.card,
  },
  typeBtnActive: { backgroundColor: Colors.primary },
  typeText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  typeTextActive: { color: '#FFF' },
  card: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 16, marginBottom: 16,
  },
  label: {
    fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, marginTop: 10,
  },
  input: {
    backgroundColor: Colors.background, borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: Colors.border,
  },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  removeOpt: { padding: 4 },
  addOptBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingVertical: 8,
  },
  addOptText: { color: Colors.accent, fontWeight: '600', fontSize: 14 },
  timeLimitRow: { marginBottom: 8 },
  timeLimitInput: { width: 80 },
  questionCard: {
    backgroundColor: Colors.background, borderRadius: 12, padding: 12, marginTop: 12,
  },
  qHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  qLabel: { fontWeight: '700', color: Colors.text, fontSize: 14 },
  correctHint: { fontSize: 12, color: Colors.textSecondary, marginVertical: 6 },
  quizOptRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  radioBtn: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
  },
  radioBtnActive: { borderColor: Colors.primary },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primary },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', marginTop: 8,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#FFF', fontWeight: '700', fontSize: 16 },

  attachmentPreview: {
    marginTop: 12, borderRadius: 12, overflow: 'hidden', position: 'relative',
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
  },
  previewImage: { width: '100%', height: 180, resizeMode: 'cover' },
  filePreview: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14,
  },
  fileName: { flex: 1, color: Colors.text, fontSize: 14 },
  removeAttachment: { position: 'absolute', top: 8, right: 8 },

  attachBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.card, paddingHorizontal: 14, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
  },
  attachBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  attachBtnSecondary: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  recordingBtn: { backgroundColor: Colors.error },
  attachHint: {
    flex: 1, fontSize: 12, color: Colors.textSecondary, marginLeft: 4,
  },
});
