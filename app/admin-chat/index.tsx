import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Image, Alert,
  Animated, LayoutAnimation, UIManager, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { apiCall, apiPost, apiPut, apiDelete, uploadFile } from '../../src/utils/api';
import { Colors } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface ChatMessage {
  id: string;
  text: string;
  sender_id: string;
  sender_name: string;
  sender_photo?: string;
  created_at: number;
  edited?: boolean;
  media_url?: string;
  media_type?: string;
  sticker?: string;
}

// ملصقات إيموجي (بديل عملي لملصقات واتساب — ما في API رسمي لاستيرادها)
const STICKER_PACKS: { title: string; items: string[] }[] = [
  {
    title: 'وجوه',
    items: ['😀', '😂', '🤣', '😍', '🥰', '😎', '🤔', '😴', '😭', '🤯', '😈', '👻', '🤖', '👽'],
  },
  {
    title: 'إشارات',
    items: ['👍', '👎', '👏', '🙌', '🤝', '✌️', '🤞', '💪', '🫡', '🫶', '❤️', '🔥', '⭐', '💯'],
  },
  {
    title: 'دراسة',
    items: ['📚', '🧪', '🔬', '⚗️', '🧬', '💊', '🎓', '📝', '💡', '🧠', '📊', '✅', '❌', '⚡'],
  },
  {
    title: 'حيوانات',
    items: ['🐱', '🐶', '🦁', '🐼', '🦊', '🐸', '🐵', '🦄', '🐝', '🦋', '🐢', '🐙'],
  },
];

export default function AdminChatScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const isArabic = user?.language === 'ar';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [channelPhoto, setChannelPhoto] = useState('');
  const [showTools, setShowTools] = useState(true);
  const [showStickers, setShowStickers] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingMs, setRecordingMs] = useState(0);
  const listRef = useRef<FlatList>(null);
  const toolsAnim = useRef(new Animated.Value(1)).current;
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiCall('/admin/chat');
      if (data?.messages) setMessages(data.messages);
    } catch (e) {
      console.warn('فشل تحميل دردشة الأدمن:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInfo = useCallback(async () => {
    try {
      const data = await apiCall('/admin/chat/info');
      if (data?.photo_url) setChannelPhoto(data.photo_url);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    loadInfo();
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, [load, loadInfo]);

  useEffect(() => {
    if (messages.length) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages.length]);

  // تصغير أيقونات الأدوات لما يبدأ الكتابة (زي واتساب)
  useEffect(() => {
    const typing = text.trim().length > 0;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowTools(!typing);
    Animated.timing(toolsAnim, {
      toValue: typing ? 0 : 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [text]);

  async function handleSend(payload?: {
    text?: string;
    media_url?: string;
    media_type?: string;
    sticker?: string;
  }) {
    const trimmed = (payload?.text ?? text).trim();
    const sticker = payload?.sticker;
    const media_url = payload?.media_url;
    const media_type = payload?.media_type;

    if ((!trimmed && !sticker && !media_url) || sending) return;
    setSending(true);

    if (editingId && trimmed) {
      try {
        await apiPut(`/admin/chat/${editingId}`, { text: trimmed });
        setMessages(prev =>
          prev.map(m => (m.id === editingId ? { ...m, text: trimmed, edited: true } : m))
        );
        setEditingId(null);
        setText('');
      } catch (e) {
        console.warn('فشل تعديل الرسالة:', e);
      } finally {
        setSending(false);
      }
      return;
    }

    if (!payload) setText('');
    setShowStickers(false);

    try {
      const body: any = {};
      if (trimmed) body.text = trimmed;
      if (sticker) body.sticker = sticker;
      if (media_url) {
        body.media_url = media_url;
        body.media_type = media_type || 'file';
      }
      const data = await apiPost('/admin/chat', body);
      if (data?.message) setMessages(prev => [...prev, data.message]);
    } catch (e) {
      console.warn('فشل إرسال الرسالة:', e);
      if (!payload && trimmed) setText(trimmed);
      Alert.alert(isArabic ? 'خطأ' : 'Error', isArabic ? 'فشل إرسال الرسالة' : 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setText('');
  }

  function handleLongPress(item: ChatMessage) {
    const isOwner = item.sender_id === user?.uid;
    const isSuperAdmin = user?.role === 'super_admin';
    if (!isOwner && !isSuperAdmin) return;

    const options: any[] = [];
    if (isOwner && !item.media_url && !item.sticker) {
      options.push({
        text: isArabic ? 'تعديل' : 'Edit',
        onPress: () => {
          setEditingId(item.id);
          setText(item.text);
        },
      });
    }
    options.push({
      text: isArabic ? 'حذف' : 'Delete',
      style: 'destructive',
      onPress: () => confirmDelete(item.id),
    });
    options.push({ text: isArabic ? 'إلغاء' : 'Cancel', style: 'cancel' });
    Alert.alert(isArabic ? 'خيارات الرسالة' : 'Message options', '', options);
  }

  function confirmDelete(id: string) {
    Alert.alert(
      isArabic ? 'حذف الرسالة' : 'Delete message',
      isArabic ? 'متأكد إنك عايز تحذف الرسالة دي؟' : 'Are you sure?',
      [
        { text: isArabic ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isArabic ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiDelete(`/admin/chat/${id}`);
              setMessages(prev => prev.filter(m => m.id !== id));
            } catch (e) {
              console.warn('فشل حذف الرسالة:', e);
            }
          },
        },
      ]
    );
  }

  async function uploadMedia(uri: string, name: string, mime: string) {
    const form = new FormData();
    form.append('file', {
      uri,
      name,
      type: mime,
    } as any);
    const data = await uploadFile('/admin/chat/media', form);
    return data as { url: string; media_type: string };
  }

  async function pickImage(fromCamera: boolean) {
    try {
      if (fromCamera) {
        const p = await ImagePicker.requestCameraPermissionsAsync();
        if (!p.granted) {
          Alert.alert(isArabic ? 'إذن مطلوب' : 'Permission', isArabic ? 'فعّل إذن الكاميرا' : 'Enable camera');
          return;
        }
      } else {
        const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!p.granted) {
          Alert.alert(isArabic ? 'إذن مطلوب' : 'Permission', isArabic ? 'فعّل إذن الصور' : 'Enable photos');
          return;
        }
      }

      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.75, allowsEditing: true })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.75,
          });

      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setSending(true);
      const uploaded = await uploadMedia(
        asset.uri,
        `img_${Date.now()}.jpg`,
        asset.mimeType || 'image/jpeg'
      );
      await handleSend({ media_url: uploaded.url, media_type: uploaded.media_type || 'image' });
    } catch (e: any) {
      Alert.alert(isArabic ? 'خطأ' : 'Error', e?.message || 'فشل رفع الصورة');
      setSending(false);
    }
  }

  async function startRecording() {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(isArabic ? 'إذن مطلوب' : 'Permission', isArabic ? 'فعّل الميكروفون' : 'Enable mic');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(rec);
      setRecordingMs(0);
      recTimer.current = setInterval(() => setRecordingMs(ms => ms + 200), 200);
    } catch (e: any) {
      Alert.alert(isArabic ? 'خطأ' : 'Error', e?.message || 'فشل التسجيل');
    }
  }

  async function stopRecording(send: boolean) {
    if (!recording) return;
    try {
      if (recTimer.current) clearInterval(recTimer.current);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setRecordingMs(0);
      if (!send || !uri) return;
      setSending(true);
      const uploaded = await uploadMedia(uri, `voice_${Date.now()}.m4a`, 'audio/m4a');
      await handleSend({ media_url: uploaded.url, media_type: 'audio' });
    } catch (e: any) {
      Alert.alert(isArabic ? 'خطأ' : 'Error', e?.message || 'فشل إرسال الصوت');
      setSending(false);
    }
  }

  function formatTime(ts: number) {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString(isArabic ? 'ar' : 'en', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  function renderMessage({ item }: { item: ChatMessage }) {
    const isMine = item.sender_id === user?.uid;
    const isSticker = item.media_type === 'sticker' || !!item.sticker;
    const isImage = item.media_type === 'image' && item.media_url;
    const isAudio = item.media_type === 'audio' && item.media_url;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={280}
      >
        <View style={[styles.row, isMine && styles.rowMine]}>
          {!isMine && (
            <View style={styles.avatar}>
              {item.sender_photo ? (
                <Image source={{ uri: item.sender_photo }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={14} color={Colors.primary} />
              )}
            </View>
          )}
          <View
            style={[
              styles.bubble,
              isMine && styles.bubbleMine,
              isSticker && styles.bubbleSticker,
            ]}
          >
            {!isMine && <Text style={styles.senderName}>{item.sender_name}</Text>}

            {isSticker && (
              <Text style={styles.stickerEmoji}>{item.sticker || item.text}</Text>
            )}

            {isImage && (
              <Image source={{ uri: item.media_url }} style={styles.msgImage} />
            )}

            {isAudio && (
              <TouchableOpacity
                style={styles.audioRow}
                onPress={async () => {
                  try {
                    const { sound } = await Audio.Sound.createAsync({ uri: item.media_url! });
                    await sound.playAsync();
                  } catch {}
                }}
              >
                <Ionicons name="play-circle" size={28} color={isMine ? '#0B1F3A' : Colors.primary} />
                <Text style={styles.audioLabel}>{isArabic ? 'رسالة صوتية' : 'Voice message'}</Text>
              </TouchableOpacity>
            )}

            {!isSticker && !!item.text && (
              <Text style={[styles.msgText, isMine && styles.msgTextMine]}>{item.text}</Text>
            )}

            <View style={styles.metaRow}>
              {item.edited && (
                <Text style={styles.editedLabel}>{isArabic ? 'معدّلة' : 'edited'}</Text>
              )}
              <Text style={styles.timeLabel}>{formatTime(item.created_at)}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  const recSec = Math.floor(recordingMs / 1000);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.chatBg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      {/* Header زي واتساب */}
      <TouchableOpacity
        style={styles.header}
        activeOpacity={0.9}
        onPress={() => router.push('/admin-chat/info')}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerIcon}>
          {channelPhoto ? (
            <Image source={{ uri: channelPhoto }} style={styles.headerPhoto} />
          ) : (
            <Ionicons name="shield-checkmark" size={20} color="#FFF" />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            {isArabic ? 'قناة الأدمنز' : 'Admin Channel'}
          </Text>
          <Text style={styles.headerSub}>
            {isArabic ? 'اضغط لمعلومات القناة' : 'Tap for channel info'}
          </Text>
        </View>
      </TouchableOpacity>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      {editingId && (
        <View style={styles.editingBar}>
          <Ionicons name="create-outline" size={16} color={Colors.primary} />
          <Text style={styles.editingText}>{isArabic ? 'بتعدّل رسالة' : 'Editing message'}</Text>
          <TouchableOpacity onPress={cancelEdit}>
            <Ionicons name="close" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* ملصقات */}
      {showStickers && (
        <View style={styles.stickerPanel}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 36 }}>
            {STICKER_PACKS.map(pack => (
              <Text key={pack.title} style={styles.packTitle}>{pack.title}</Text>
            ))}
          </ScrollView>
          <ScrollView style={{ maxHeight: 160 }}>
            {STICKER_PACKS.map(pack => (
              <View key={pack.title} style={styles.stickerGrid}>
                {pack.items.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={styles.stickerBtn}
                    onPress={() => handleSend({ sticker: s })}
                  >
                    <Text style={styles.stickerBtnText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* شريط التسجيل */}
      {recording ? (
        <View style={styles.recBar}>
          <TouchableOpacity onPress={() => stopRecording(false)} style={styles.recCancel}>
            <Ionicons name="trash-outline" size={22} color={Colors.error} />
          </TouchableOpacity>
          <View style={styles.recDot} />
          <Text style={styles.recTime}>
            {String(Math.floor(recSec / 60)).padStart(2, '0')}:
            {String(recSec % 60).padStart(2, '0')}
          </Text>
          <TouchableOpacity onPress={() => stopRecording(true)} style={styles.recSend}>
            <Ionicons name="send" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.composer}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => {
              setShowStickers(s => !s);
            }}
          >
            <Ionicons
              name={showStickers ? 'keypad-outline' : 'happy-outline'}
              size={24}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>

          {showTools && (
            <Animated.View style={[styles.toolsRow, { opacity: toolsAnim }]}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => pickImage(false)}>
                <Ionicons name="attach-outline" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => pickImage(true)}>
                <Ionicons name="camera-outline" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </Animated.View>
          )}

          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder={isArabic ? 'رسالة' : 'Message'}
              placeholderTextColor={Colors.textSecondary}
              multiline
              textAlign={isArabic ? 'right' : 'left'}
            />
          </View>

          {text.trim() ? (
            <TouchableOpacity
              style={[styles.sendBtn, sending && { opacity: 0.6 }]}
              onPress={() => handleSend()}
              disabled={sending}
            >
              <Ionicons name={editingId ? 'checkmark' : 'send'} size={18} color="#FFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.micBtn} onPress={startRecording}>
              <Ionicons name="mic" size={22} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: Platform.OS === 'ios' ? 54 : 42,
    paddingBottom: 12,
    paddingHorizontal: 12,
    backgroundColor: Colors.chatHeader,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  backBtn: { padding: 4 },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerPhoto: { width: 40, height: 40, borderRadius: 20 },
  headerTitle: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 1 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 12, paddingBottom: 20 },

  row: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-end',
    gap: 6,
    marginBottom: 6,
  },
  rowMine: { flexDirection: 'row', alignSelf: 'flex-end' },

  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 28, height: 28, borderRadius: 14 },

  bubble: {
    maxWidth: '78%',
    backgroundColor: Colors.bubbleIn,
    borderRadius: 16,
    borderTopRightRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleMine: {
    backgroundColor: Colors.bubbleOut,
    borderTopRightRadius: 16,
    borderTopLeftRadius: 4,
  },
  bubbleSticker: {
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
    paddingHorizontal: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accent,
    marginBottom: 2,
  },
  msgText: { fontSize: 15.5, color: Colors.textPrimary, lineHeight: 22 },
  msgTextMine: { color: Colors.textPrimary },
  stickerEmoji: { fontSize: 56, lineHeight: 64 },
  msgImage: {
    width: 220,
    height: 220,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: '#ddd',
  },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 160,
    paddingVertical: 4,
  },
  audioLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 2,
  },
  editedLabel: { fontSize: 10, color: '#888' },
  timeLabel: { fontSize: 10, color: '#888' },

  editingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  editingText: { flex: 1, fontSize: 12.5, color: Colors.primary, fontWeight: '600' },

  stickerPanel: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
    paddingBottom: 4,
  },
  packTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginHorizontal: 12,
    marginBottom: 4,
  },
  stickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  stickerBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerBtnText: { fontSize: 28 },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  toolsRow: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: 6 },
  inputWrap: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: {
    fontSize: 15.5,
    color: Colors.textPrimary,
    maxHeight: 100,
    paddingVertical: 4,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },

  recBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.surface,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  recCancel: { padding: 8 },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.error,
  },
  recTime: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  recSend: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
