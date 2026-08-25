import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Image, Alert,
  Modal, Pressable
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiCall, uploadFile, CHEMI_BASE_URL } from '../../src/utils/api';
import { Colors } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
}

interface AttachedFile {
  uri: string;
  name: string;
  type: string; // mime
}

interface Model {
  id: string;
  label: string;
}

const STORAGE_KEY = 'chemi_conversations';

export default function ChemiScreen() {
  const { user } = useAuth();
  const isArabic = user?.language === 'ar';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);

  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [showModelPicker, setShowModelPicker] = useState(false);

  const [showAttachPopup, setShowAttachPopup] = useState(false);
  const [showCoursePicker, setShowCoursePicker] = useState(false);
  const [courseFiles, setCourseFiles] = useState<{ id: string; name: string; files: { id: string; name: string }[] }[]>([]);
  const [loadingCourseFiles, setLoadingCourseFiles] = useState(false);
  const [openCourseId, setOpenCourseId] = useState<string | null>(null);

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [transcribing, setTranscribing] = useState(false);

  const [showSidebar, setShowSidebar] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string>('c' + Date.now());

  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    loadModels();
    loadConversations();
  }, []);

  useEffect(() => {
    if (messages.length) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  async function loadModels() {
    try {
      const data = await apiCall('/ai/models', {}, CHEMI_BASE_URL);
      if (data?.models) {
        setModels(data.models);
        setSelectedModel(data.default);
      }
    } catch (e) {
      console.warn('فشل تحميل الموديلات:', e);
    }
  }

  async function loadConversations() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) setConversations(JSON.parse(raw));
    } catch {}
  }

  async function saveConversations(next: Conversation[]) {
    setConversations(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }

  function startNewChat() {
    setCurrentConvId('c' + Date.now());
    setMessages([]);
    setAttachedFile(null);
    setShowSidebar(false);
  }

  function loadConversation(conv: Conversation) {
    setCurrentConvId(conv.id);
    setMessages(conv.messages);
    setShowSidebar(false);
  }

  function persistTurn(userText: string, botText: string) {
    const existing = conversations.find(c => c.id === currentConvId);
    const updatedMsgs: ChatMessage[] = existing
      ? [...existing.messages, { role: 'user', content: userText }, { role: 'assistant', content: botText }]
      : [{ role: 'user', content: userText }, { role: 'assistant', content: botText }];

    let next: Conversation[];
    if (existing) {
      next = conversations.map(c => (c.id === currentConvId ? { ...c, messages: updatedMsgs } : c));
    } else {
      next = [...conversations, { id: currentConvId, title: userText.slice(0, 40) || 'محادثة جديدة', messages: updatedMsgs }];
    }
    saveConversations(next);
  }

  // ===== إرفاق ملفات =====
  async function pickCamera() {
    setShowAttachPopup(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(isArabic ? 'إذن مطلوب' : 'Permission needed', isArabic ? 'محتاجين إذن الكاميرا' : 'Camera permission needed');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets?.[0]) {
      const a = result.assets[0];
      setAttachedFile({ uri: a.uri, name: 'photo.jpg', type: 'image/jpeg' });
    }
  }

  async function pickGallery() {
    setShowAttachPopup(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(isArabic ? 'إذن مطلوب' : 'Permission needed', isArabic ? 'محتاجين إذن المعرض' : 'Gallery permission needed');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled && result.assets?.[0]) {
      const a = result.assets[0];
      setAttachedFile({ uri: a.uri, name: a.fileName || 'image.jpg', type: a.mimeType || 'image/jpeg' });
    }
  }

  async function pickFile() {
    setShowAttachPopup(false);
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (!result.canceled && result.assets?.[0]) {
      const a = result.assets[0];
      setAttachedFile({ uri: a.uri, name: a.name, type: a.mimeType || 'application/octet-stream' });
    }
  }

  async function openCoursePicker() {
    setShowAttachPopup(false);
    setShowCoursePicker(true);
    setLoadingCourseFiles(true);
    try {
      const data = await apiCall('/ai/course-files-list', {}, CHEMI_BASE_URL);
      setCourseFiles(data?.courses || []);
    } catch (e) {
      console.warn('فشل تحميل قائمة ملفات المواد:', e);
    } finally {
      setLoadingCourseFiles(false);
    }
  }

  async function pickCourseFile(courseId: string, courseName: string, fileId: string, fileName: string) {
    setShowCoursePicker(false);
    setSending(true);
    try {
      const data = await apiCall(`/ai/course-file?course_id=${courseId}&file_id=${fileId}`, {}, CHEMI_BASE_URL);
      if (data?.text) {
        // بنحط محتوى الملف كسياق مرفق، والطالب يقول داير يعمل شنو بيه
        setAttachedFile({
          uri: `server-file://${fileId}`,
          name: `${fileName} (${courseName})`,
          type: 'text/course-file',
        });
        (attachedFileTextRef.current as any) = data.text;
      } else {
        Alert.alert(isArabic ? 'تنبيه' : 'Notice', data?.note || (isArabic ? 'الملف مش مدعوم لسع' : 'File type not supported yet'));
      }
    } catch (e) {
      console.warn('فشل قراءة ملف المادة:', e);
    } finally {
      setSending(false);
    }
  }
  const attachedFileTextRef = useRef<string | null>(null);

  function removeAttachedFile() {
    setAttachedFile(null);
    attachedFileTextRef.current = null;
  }

  // ===== التسجيل الصوتي =====
  async function startRecording() {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(isArabic ? 'إذن مطلوب' : 'Permission needed', isArabic ? 'فعّل إذن الميكروفون' : 'Enable microphone permission');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec);
    } catch (e: any) {
      Alert.alert(isArabic ? 'خطأ' : 'Error', e?.message || (isArabic ? 'فشل التسجيل' : 'Recording failed'));
    }
  }

  async function stopRecording() {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      if (!uri) return;

      setTranscribing(true);
      const formData = new FormData();
      formData.append('audio', { uri, name: 'voice.m4a', type: 'audio/m4a' } as any);

      const data = await uploadFile('/ai/transcribe', formData, CHEMI_BASE_URL);
      if (data?.text) setText(prev => (prev ? `${prev} ${data.text}` : data.text));
    } catch (e: any) {
      Alert.alert(isArabic ? 'خطأ' : 'Error', e?.message || (isArabic ? 'فشل تحويل الصوت' : 'Transcription failed'));
    } finally {
      setTranscribing(false);
    }
  }

  // ===== إرسال الرسالة =====
  async function sendMessage() {
    const trimmed = text.trim();
    if (!trimmed && !attachedFile) return;

    const label = attachedFile ? `${trimmed} 📎 ${attachedFile.name}` : trimmed;
    setMessages(prev => [...prev, { role: 'user', content: label }]);
    setText('');
    setSending(true);

    try {
      const formData = new FormData();
      // لو الملف جاي من "ملفات المادة" (محتواه اتقرا من السيرفر أصلاً) نبعت النص كجزء من الرسالة
      if (attachedFile?.type === 'text/course-file' && attachedFileTextRef.current) {
        formData.append('message', `${trimmed}\n\n[محتوى الملف: ${attachedFile.name}]\n${attachedFileTextRef.current}`);
      } else {
        formData.append('message', trimmed);
        if (attachedFile) {
          formData.append('file', { uri: attachedFile.uri, name: attachedFile.name, type: attachedFile.type } as any);
        }
      }
      formData.append('history', JSON.stringify(messages));
      if (selectedModel) formData.append('model', selectedModel);

      const data = await uploadFile('/ai/chat', formData, CHEMI_BASE_URL);

      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
      persistTurn(label, data.answer);
      removeAttachedFile();
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ ' + (e?.message || 'حصل خطأ') }]);
    } finally {
      setSending(false);
    }
  }

  function renderMessage({ item }: { item: ChatMessage }) {
    const isMine = item.role === 'user';
    return (
      <View style={[styles.msgRow, isMine ? styles.msgRowMine : styles.msgRowBot]}>
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleBot]}>
          <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.content}</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* شريط علوي: محادثات قديمة + اختيار الموديل */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => setShowSidebar(true)} style={styles.iconBtn}>
          <Ionicons name="menu" size={22} color={Colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowModelPicker(true)} style={styles.modelBtn}>
          <Text style={styles.modelBtnText} numberOfLines={1}>
            {models.find(m => m.id === selectedModel)?.label || (isArabic ? 'اختار موديل' : 'Select model')}
          </Text>
          <Ionicons name="chevron-down" size={14} color={Colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={startNewChat} style={styles.iconBtn}>
          <Ionicons name="add-circle-outline" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {messages.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="sparkles" size={40} color={Colors.accent} />
          <Text style={styles.emptyTitle}>CHEMI</Text>
          <Text style={styles.emptySubtitle}>
            {isArabic ? 'اسأل، أو ارفق PDF/صورة وقول داير شنو' : 'Ask, or attach a PDF/image and say what you need'}
          </Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      {sending && (
        <View style={styles.typingRow}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      )}

      {attachedFile && (
        <View style={styles.attachChip}>
          <Ionicons name="attach" size={16} color={Colors.primary} />
          <Text style={styles.attachChipText} numberOfLines={1}>{attachedFile.name}</Text>
          <TouchableOpacity onPress={removeAttachedFile}>
            <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* شريط الإدخال */}
      <View style={styles.composer}>
        <View>
          {showAttachPopup && (
            <View style={styles.attachPopup}>
              <TouchableOpacity style={styles.attachOption} onPress={pickCamera}>
                <Ionicons name="camera-outline" size={18} color={Colors.primary} />
                <Text style={styles.attachOptionText}>{isArabic ? 'افتح الكاميرا وصوّر' : 'Camera'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachOption} onPress={pickGallery}>
                <Ionicons name="image-outline" size={18} color={Colors.primary} />
                <Text style={styles.attachOptionText}>{isArabic ? 'استورد من المعرض' : 'Gallery'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachOption} onPress={pickFile}>
                <Ionicons name="document-outline" size={18} color={Colors.primary} />
                <Text style={styles.attachOptionText}>{isArabic ? 'رفع ملف' : 'Upload file'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachOption} onPress={openCoursePicker}>
                <Ionicons name="library-outline" size={18} color={Colors.primary} />
                <Text style={styles.attachOptionText}>{isArabic ? 'من ملفات المادة' : 'From course files'}</Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowAttachPopup(!showAttachPopup)}>
            <Ionicons name="attach" size={22} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.iconBtn, recording && styles.iconBtnRecording]}
          onPress={recording ? stopRecording : startRecording}
        >
          {transcribing ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Ionicons name="mic-outline" size={22} color={recording ? '#FFF' : Colors.primary} />
          )}
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={isArabic ? 'اكتب رسالتك...' : 'Type a message...'}
          placeholderTextColor={Colors.textSecondary}
          multiline
        />

        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() && !attachedFile) && { opacity: 0.5 }]}
          onPress={sendMessage}
          disabled={(!text.trim() && !attachedFile) || sending}
        >
          <Ionicons name="send" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* سايدبار المحادثات القديمة */}
      <Modal visible={showSidebar} animationType="slide" transparent onRequestClose={() => setShowSidebar(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowSidebar(false)}>
          <Pressable style={styles.sidebar}>
            <View style={styles.sidebarHeader}>
              <Text style={styles.sidebarTitle}>{isArabic ? 'المحادثات' : 'Conversations'}</Text>
              <TouchableOpacity onPress={() => setShowSidebar(false)}>
                <Ionicons name="close" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.newChatBtn} onPress={startNewChat}>
              <Ionicons name="add" size={16} color="#FFF" />
              <Text style={styles.newChatBtnText}>{isArabic ? 'محادثة جديدة' : 'New chat'}</Text>
            </TouchableOpacity>
            <FlatList
              data={[...conversations].reverse()}
              keyExtractor={c => c.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.convItem, item.id === currentConvId && styles.convItemActive]}
                  onPress={() => loadConversation(item)}
                >
                  <Text style={styles.convItemText} numberOfLines={1}>{item.title}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.convEmpty}>{isArabic ? 'مفيش محادثات محفوظة لسع' : 'No saved conversations yet'}</Text>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* اختيار الموديل */}
      <Modal visible={showModelPicker} animationType="fade" transparent onRequestClose={() => setShowModelPicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowModelPicker(false)}>
          <Pressable style={styles.centeredCard}>
            <Text style={styles.sidebarTitle}>{isArabic ? 'اختار الموديل' : 'Select model'}</Text>
            {models.map(m => (
              <TouchableOpacity
                key={m.id}
                style={styles.modelOption}
                onPress={() => { setSelectedModel(m.id); setShowModelPicker(false); }}
              >
                <Text style={styles.modelOptionText}>{m.label}</Text>
                {m.id === selectedModel && <Ionicons name="checkmark" size={18} color={Colors.accent} />}
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* اختيار ملف من مواد التطبيق - يشتغل حتى لو الطالب ما حمّل الملف عندو */}
      <Modal visible={showCoursePicker} animationType="fade" transparent onRequestClose={() => setShowCoursePicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowCoursePicker(false)}>
          <Pressable style={styles.centeredCard}>
            <Text style={styles.sidebarTitle}>{isArabic ? 'ملفات المواد' : 'Course files'}</Text>
            {loadingCourseFiles ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
            ) : (
              <FlatList
                style={{ maxHeight: 360 }}
                data={courseFiles}
                keyExtractor={c => c.id}
                renderItem={({ item: course }) => (
                  <View>
                    <TouchableOpacity
                      style={styles.courseRow}
                      onPress={() => setOpenCourseId(openCourseId === course.id ? null : course.id)}
                    >
                      <Ionicons name="book-outline" size={16} color={Colors.primary} />
                      <Text style={styles.courseRowText}>{course.name}</Text>
                      <Ionicons name={openCourseId === course.id ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.textSecondary} />
                    </TouchableOpacity>
                    {openCourseId === course.id && course.files.map(f => (
                      <TouchableOpacity
                        key={f.id}
                        style={styles.fileRow}
                        onPress={() => pickCourseFile(course.id, course.name, f.id, f.name)}
                      >
                        <Ionicons name="document-text-outline" size={14} color={Colors.textSecondary} />
                        <Text style={styles.fileRowText} numberOfLines={1}>{f.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                ListEmptyComponent={
                  <Text style={styles.convEmpty}>{isArabic ? 'مفيش مواد متاحة' : 'No courses available'}</Text>
                }
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
  },
  iconBtnRecording: { backgroundColor: '#DC2626' },
  modelBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: Colors.primaryLight, borderRadius: 12,
  },
  modelBtnText: { fontSize: 12.5, fontWeight: '700', color: Colors.primary },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginTop: 6 },
  emptySubtitle: { fontSize: 13.5, color: Colors.textSecondary, textAlign: 'center' },

  listContent: { padding: 14, paddingBottom: 10 },
  msgRow: { marginBottom: 10 },
  msgRowMine: { alignItems: 'flex-end' },
  msgRowBot: { alignItems: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14 },
  bubbleMine: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleBot: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14.5, lineHeight: 21, color: Colors.textPrimary },
  bubbleTextMine: { color: '#FFF' },

  typingRow: { paddingHorizontal: 16, paddingBottom: 4 },

  attachChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 12, marginBottom: 6, padding: 8,
    backgroundColor: Colors.primaryLight, borderRadius: 10,
  },
  attachChipText: { flex: 1, fontSize: 12.5, color: Colors.primary, fontWeight: '600' },

  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: 10, backgroundColor: Colors.surface,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  input: {
    flex: 1, backgroundColor: Colors.background, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14.5, maxHeight: 100, color: Colors.textPrimary,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  attachPopup: {
    position: 'absolute', bottom: 46, left: 0,
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 6, minWidth: 190,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10,
    elevation: 8, zIndex: 10,
  },
  attachOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14 },
  attachOptionText: { fontSize: 13.5, color: Colors.textPrimary, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sidebar: { width: '82%', maxWidth: 320, height: '100%', backgroundColor: Colors.surface, alignSelf: 'flex-end' },
  sidebarHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sidebarTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  newChatBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    margin: 14, padding: 12, backgroundColor: Colors.primary, borderRadius: 12,
  },
  newChatBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13.5 },
  convItem: { paddingVertical: 12, paddingHorizontal: 16 },
  convItemActive: { backgroundColor: Colors.primaryLight },
  convItemText: { fontSize: 13.5, color: Colors.textPrimary },
  convEmpty: { textAlign: 'center', color: Colors.textSecondary, fontSize: 13, padding: 20 },

  centeredCard: {
    backgroundColor: Colors.surface, borderRadius: 18, padding: 18,
    marginHorizontal: 24, marginBottom: '30%',
  },
  modelOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modelOptionText: { fontSize: 14, color: Colors.textPrimary },

  courseRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  courseRowText: { flex: 1, fontSize: 13.5, fontWeight: '700', color: Colors.textPrimary },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingRight: 24 },
  fileRowText: { flex: 1, fontSize: 12.5, color: Colors.textSecondary },
});
