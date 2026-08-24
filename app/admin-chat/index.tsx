import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Image, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiCall, apiPost, apiPut, apiDelete } from '../../src/utils/api';
import { Colors } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';

interface ChatMessage {
  id: string;
  text: string;
  sender_id: string;
  sender_name: string;
  sender_photo?: string;
  created_at: number;
  edited?: boolean;
}

// قناة دردشة خاصة بالأدمنز والسوبر أدمن بس - بأسلوب واتساب (تعديل/حذف الرسايل + بروفايل القناة)
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
  const listRef = useRef<FlatList>(null);

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
    } catch (e) {
      console.warn('فشل تحميل معلومات القناة:', e);
    }
  }, []);

  useEffect(() => {
    load();
    loadInfo();
    // بولّنق بسيط كل 4 ثواني عشان يبان جديد الرسائل من الأدمنز التانيين
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, [load, loadInfo]);

  useEffect(() => {
    if (messages.length) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);

    if (editingId) {
      try {
        await apiPut(`/admin/chat/${editingId}`, { text: trimmed });
        setMessages(prev => prev.map(m => (m.id === editingId ? { ...m, text: trimmed, edited: true } : m)));
        setEditingId(null);
        setText('');
      } catch (e) {
        console.warn('فشل تعديل الرسالة:', e);
      } finally {
        setSending(false);
      }
      return;
    }

    setText('');
    try {
      const data = await apiPost('/admin/chat', { text: trimmed });
      if (data?.message) {
        setMessages(prev => [...prev, data.message]);
      }
    } catch (e) {
      console.warn('فشل إرسال الرسالة:', e);
      setText(trimmed);
    } finally {
      setSending(false);
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setText('');
  }

  // اضغط مطولاً على أي رسالة - زي واتساب بالظبط: تعديل / حذف
  function handleLongPress(item: ChatMessage) {
    const isOwner = item.sender_id === user?.uid;
    const isSuperAdmin = user?.role === 'super_admin';
    if (!isOwner && !isSuperAdmin) return;

    const options: any[] = [];
    if (isOwner) {
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
      isArabic ? 'متأكد إنك عايز تحذف الرسالة دي؟' : 'Are you sure you want to delete this message?',
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

  function renderMessage({ item }: { item: ChatMessage }) {
    const isMine = item.sender_id === user?.uid;
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={300}
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
          <View style={[styles.bubble, isMine && styles.bubbleMine]}>
            {!isMine && <Text style={styles.senderName}>{item.sender_name}</Text>}
            <Text style={[styles.msgText, isMine && styles.msgTextMine]}>{item.text}</Text>
            {item.edited && (
              <Text style={styles.editedLabel}>{isArabic ? 'معدّلة' : 'edited'}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#ECE5DD' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableOpacity
        style={styles.header}
        activeOpacity={0.85}
        onPress={() => router.push('/admin-chat/info')}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerIcon}>
          {channelPhoto ? (
            <Image source={{ uri: channelPhoto }} style={styles.headerPhoto} />
          ) : (
            <Ionicons name="shield-checkmark" size={18} color="#FFF" />
          )}
        </View>
        <Text style={styles.headerTitle}>
          {isArabic ? 'قناة الأدمنز' : 'Admin Channel'}
        </Text>
      </TouchableOpacity>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={Colors.primary} />
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

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={isArabic ? 'اكتب رسالة...' : 'Type a message...'}
          placeholderTextColor={Colors.textSecondary}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
        >
          <Ionicons name={editingId ? 'checkmark' : 'send'} size={18} color="#FFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingTop: 50, paddingBottom: 14, paddingHorizontal: 16,
    backgroundColor: Colors.primary,
  },
  backBtn: { padding: 4 },
  headerIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  headerPhoto: { width: 32, height: 32, borderRadius: 16 },
  headerTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  listContent: { padding: 12, paddingBottom: 20 },

  row: { flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 6, marginBottom: 8 },
  rowMine: { flexDirection: 'row', alignSelf: 'flex-end' },

  avatar: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 26, height: 26, borderRadius: 13 },

  bubble: {
    maxWidth: '78%', backgroundColor: '#FFF',
    borderRadius: 14, borderTopRightRadius: 4,
    paddingVertical: 8, paddingHorizontal: 12,
  },
  bubbleMine: {
    backgroundColor: '#DCF8C6',
    borderTopRightRadius: 14, borderTopLeftRadius: 4,
  },
  senderName: { fontSize: 12, fontWeight: '700', color: Colors.primary, marginBottom: 2 },
  msgText: { fontSize: 14.5, color: '#1a1a1a', lineHeight: 20 },
  msgTextMine: { color: '#1a1a1a' },
  editedLabel: { fontSize: 10, color: '#888', marginTop: 2, textAlign: 'left' },

  editingBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#F0F0F0', borderTopWidth: 1, borderTopColor: '#E0E0E0',
  },
  editingText: { flex: 1, fontSize: 12.5, color: Colors.primary, fontWeight: '600' },

  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: 10, backgroundColor: '#F0F0F0',
  },
  input: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14.5, maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
});
