import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Image, BackHandler,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useShareIntentContext } from 'expo-share-intent';
import { useAuth } from '../src/context/AuthContext';
import { Colors } from '../src/constants/colors';
import { apiCall, apiPost, uploadFile } from '../src/utils/api';

type Dest = 'academic' | 'news' | 'chat' | null;

interface SharedFile {
  uri: string;
  name: string;
  mimeType: string;
  size?: number | null;
}

interface Course {
  id: string;
  name: string;
  name_ar?: string;
}

const DEFAULT_FOLDERS = ['General', 'PDFs', 'Videos', 'Images', 'Assignments', 'Exams'];
const FOLDER_LABELS_AR: Record<string, string> = {
  General: 'عام', PDFs: 'ملفات PDF', Videos: 'فيديوهات',
  Images: 'صور', Assignments: 'واجبات', Exams: 'امتحانات',
};

function normalizeUri(path: string): string {
  if (!path) return path;
  if (path.startsWith('file://') || path.startsWith('content://')) return path;
  return `file://${path}`;
}

function guessMime(name: string, mime?: string): string {
  if (mime && mime !== '*/*') return mime;
  const ext = (name.split('.').pop() || '').toLowerCase();
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    mp4: 'video/mp4', mov: 'video/quicktime', mkv: 'video/x-matroska',
    mp3: 'audio/mpeg', m4a: 'audio/m4a', ogg: 'audio/ogg',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    zip: 'application/zip', txt: 'text/plain',
  };
  return map[ext] || 'application/octet-stream';
}

function suggestFolder(mime: string): string {
  if (mime.startsWith('image/')) return 'Images';
  if (mime.startsWith('video/')) return 'Videos';
  if (mime === 'application/pdf') return 'PDFs';
  return 'General';
}

function mediaKind(mime: string): string {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'file';
}

function fileIcon(mime: string): any {
  if (mime.startsWith('video/')) return 'videocam';
  if (mime.startsWith('audio/')) return 'musical-notes';
  if (mime === 'application/pdf') return 'document-text';
  return 'document';
}

export default function ShareIntentScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();

  const isArabic = user?.language === 'ar';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const t = (ar: string, en: string) => (isArabic ? ar : en);

  const [dest, setDest] = useState<Dest>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');

  // الأكاديمي
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [course, setCourse] = useState<Course | null>(null);
  const [courseFolders, setCourseFolders] = useState<string[]>([]);
  const [folder, setFolder] = useState<string>('General');
  const [newFolder, setNewFolder] = useState('');
  const [fileName, setFileName] = useState('');

  // الأخبار / القناة
  const [caption, setCaption] = useState('');

  const files: SharedFile[] = useMemo(() => {
    const list = (shareIntent?.files || []) as any[];
    return list.map((f, i) => {
      const name = f.fileName || `file_${Date.now()}_${i}`;
      return {
        uri: normalizeUri(f.path),
        name,
        mimeType: guessMime(name, f.mimeType),
        size: f.size,
      };
    });
  }, [shareIntent]);

  const sharedText: string = (shareIntent as any)?.text || (shareIntent as any)?.webUrl || '';

  useEffect(() => {
    if (sharedText && !caption) setCaption(sharedText);
  }, [sharedText]);

  useEffect(() => {
    if (files.length === 1) setFileName(files[0].name);
    if (files.length > 0) setFolder(suggestFolder(files[0].mimeType));
  }, [files.length]);

  // زر الرجوع في أندرويد = إلغاء
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (busy) return true;
      if (dest) { setDest(null); setCourse(null); return true; }
      finish();
      return true;
    });
    return () => sub.remove();
  }, [dest, busy]);

  function finish() {
    resetShareIntent();
    router.replace('/');
  }

  async function loadCourses() {
    setLoadingCourses(true);
    try {
      const data = await apiCall('/courses/');
      setCourses(data?.courses || []);
    } catch (e: any) {
      Alert.alert(t('خطأ', 'Error'), e?.message || t('فشل تحميل المواد', 'Failed to load courses'));
    } finally {
      setLoadingCourses(false);
    }
  }

  async function pickCourse(c: Course) {
    setCourse(c);
    try {
      const data = await apiCall(`/courses/${c.id}`);
      const set = new Set<string>((data?.course?.files || []).map((f: any) => f.folder || 'General'));
      setCourseFolders(Array.from(set).filter(f => !DEFAULT_FOLDERS.includes(f)));
    } catch {
      setCourseFolders([]);
    }
  }

  function chooseDest(d: Dest) {
    setDest(d);
    if (d === 'academic' && courses.length === 0) loadCourses();
  }

  // ---------- الرفع ----------
  async function uploadToCourse() {
    if (!course) return;
    const targetFolder = (newFolder.trim() || folder).trim();
    if (!targetFolder) {
      Alert.alert(t('اختر مجلد', 'Pick a folder'));
      return;
    }
    setBusy(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setProgress(`${i + 1}/${files.length}`);
        const fd = new FormData();
        fd.append('file', { uri: f.uri, name: f.name, type: f.mimeType } as any);
        fd.append('folder', targetFolder);
        fd.append('name', files.length === 1 ? (fileName.trim() || f.name) : f.name);
        const data = await uploadFile(`/courses/${course.id}/files`, fd);
        if (!data?.file) throw new Error('Upload failed');
      }
      Alert.alert('✅', t('تم الرفع بنجاح', 'Uploaded successfully'), [
        { text: t('حسناً', 'OK'), onPress: () => { resetShareIntent(); router.replace(`/course/${course.id}`); } },
      ]);
    } catch (e: any) {
      Alert.alert(t('خطأ', 'Error'), e?.message || t('فشل الرفع', 'Upload failed'));
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  async function publishNews() {
    const text = caption.trim();
    if (!text) {
      Alert.alert(t('خطأ', 'Error'), t('اكتب نص المنشور', 'Write the post text'));
      return;
    }
    setBusy(true);
    try {
      let imageUrl = '';
      if (files.length > 0) {
        setProgress(t('جاري رفع المرفق...', 'Uploading...'));
        const f = files[0];
        const fd = new FormData();
        fd.append('file', { uri: f.uri, name: f.name, type: f.mimeType } as any);
        const up = await uploadFile('/news/upload-attachment', fd);
        if (!up?.url) throw new Error(t('فشل رفع المرفق', 'Attachment upload failed'));
        imageUrl = up.url;
      }
      const data = await apiCall('/news/', {
        method: 'POST',
        body: JSON.stringify({
          type: 'news', title: text, title_ar: text, content: text, content_ar: text, image: imageUrl,
        }),
      });
      if (!data) throw new Error('Failed to create post');
      Alert.alert('✅', t('تم النشر بنجاح!', 'Posted successfully!'), [
        { text: t('حسناً', 'OK'), onPress: finish },
      ]);
    } catch (e: any) {
      Alert.alert(t('خطأ', 'Error'), e?.message || t('فشل النشر', 'Failed to post'));
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  async function sendToAdminChat() {
    const text = caption.trim();
    if (files.length === 0 && !text) return;
    setBusy(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setProgress(`${i + 1}/${files.length}`);
        const fd = new FormData();
        fd.append('file', { uri: f.uri, name: f.name, type: f.mimeType } as any);
        const up = await uploadFile('/admin/chat/media', fd);
        const body: any = { media_url: up?.url, media_type: up?.media_type || mediaKind(f.mimeType) };
        if (i === 0 && text) body.text = text;
        await apiPost('/admin/chat', body);
      }
      if (files.length === 0 && text) await apiPost('/admin/chat', { text });
      Alert.alert('✅', t('تم الإرسال لقناة الأدمنز', 'Sent to admins channel'), [
        { text: t('حسناً', 'OK'), onPress: () => { resetShareIntent(); router.replace('/admin-chat'); } },
      ]);
    } catch (e: any) {
      Alert.alert(t('خطأ', 'Error'), e?.message || t('فشل الإرسال', 'Failed to send'));
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  // ---------- الواجهة ----------
  if (!hasShareIntent) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('لا يوجد شيء للمشاركة', 'Nothing to share')}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/')}>
          <Text style={styles.primaryBtnText}>{t('رجوع', 'Back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed" size={48} color={Colors.textSecondary} />
        <Text style={[styles.muted, { marginTop: 12 }]}>
          {t('المشاركة للتطبيق متاحة للأدمنز فقط', 'Sharing to the app is for admins only')}
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={finish}>
          <Text style={styles.primaryBtnText}>{t('إغلاق', 'Close')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isImage = (m: string) => m.startsWith('image/');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={busy ? undefined : finish}>
          <Ionicons name="close" size={26} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('مشاركة إلى UofK Chem', 'Share to UofK Chem')}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {/* معاينة */}
        <View style={styles.card}>
          {files.map((f, i) => (
            <View key={i} style={styles.fileRow}>
              {isImage(f.mimeType) ? (
                <Image source={{ uri: f.uri }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbIcon]}>
                  <Ionicons name={fileIcon(f.mimeType)} size={22} color={Colors.primary} />
                </View>
              )}
              <Text style={styles.fileName} numberOfLines={2}>{f.name}</Text>
            </View>
          ))}
          {files.length === 0 && !!sharedText && (
            <Text style={styles.fileName} numberOfLines={4}>{sharedText}</Text>
          )}
        </View>

        {/* اختيار الوجهة */}
        {!dest && (
          <>
            <Text style={styles.sectionTitle}>{t('وين تريد ترفع؟', 'Where to?')}</Text>
            {files.length > 0 && (
              <DestCard icon="school" title={t('الأكاديمي (داخل مادة)', 'Academic (inside a course)')}
                sub={t('اختار المادة والمجلد', 'Pick course & folder')} onPress={() => chooseDest('academic')} />
            )}
            <DestCard icon="megaphone" title={t('نشر في الأخبار', 'Post in News')}
              sub={t('خبر مع المرفق', 'A post with the attachment')} onPress={() => chooseDest('news')} />
            <DestCard icon="chatbubbles" title={t('قناة الأدمنز', 'Admins channel')}
              sub={t('إرسال في القناة', 'Send in the channel')} onPress={() => chooseDest('chat')} />
          </>
        )}

        {/* الأكاديمي */}
        {dest === 'academic' && !course && (
          <>
            <Text style={styles.sectionTitle}>{t('اختر المادة', 'Select course')}</Text>
            {loadingCourses ? <ActivityIndicator color={Colors.accent} style={{ marginTop: 20 }} /> :
              courses.map(c => (
                <TouchableOpacity key={c.id} style={styles.listItem} onPress={() => pickCourse(c)}>
                  <Ionicons name="book" size={20} color={Colors.accent} />
                  <Text style={styles.listItemText}>{isArabic && c.name_ar ? c.name_ar : c.name}</Text>
                </TouchableOpacity>
              ))}
            <BackLink onPress={() => setDest(null)} label={t('رجوع', 'Back')} />
          </>
        )}

        {dest === 'academic' && course && (
          <>
            <Text style={styles.sectionTitle}>
              {t('المادة: ', 'Course: ')}{isArabic && course.name_ar ? course.name_ar : course.name}
            </Text>
            <Text style={styles.label}>{t('المجلد', 'Folder')}</Text>
            <View style={styles.chips}>
              {[...DEFAULT_FOLDERS, ...courseFolders].map(fl => (
                <TouchableOpacity key={fl}
                  style={[styles.chip, !newFolder && folder === fl && styles.chipActive]}
                  onPress={() => { setFolder(fl); setNewFolder(''); }}>
                  <Text style={[styles.chipText, !newFolder && folder === fl && styles.chipTextActive]}>
                    {isArabic ? (FOLDER_LABELS_AR[fl] || fl) : fl}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={styles.input} value={newFolder} onChangeText={setNewFolder}
              placeholder={t('أو اكتب اسم مجلد جديد', 'Or type a new folder name')}
              placeholderTextColor={Colors.textSecondary} />
            {files.length === 1 && (
              <>
                <Text style={styles.label}>{t('اسم الملف', 'File name')}</Text>
                <TextInput style={styles.input} value={fileName} onChangeText={setFileName}
                  placeholderTextColor={Colors.textSecondary} />
              </>
            )}
            <SubmitBtn busy={busy} progress={progress} label={t('رفع إلى المادة', 'Upload to course')} onPress={uploadToCourse} />
            <BackLink onPress={() => setCourse(null)} label={t('تغيير المادة', 'Change course')} />
          </>
        )}

        {/* الأخبار */}
        {dest === 'news' && (
          <>
            <Text style={styles.label}>{t('نص المنشور', 'Post text')}</Text>
            <TextInput style={[styles.input, { minHeight: 110, textAlignVertical: 'top' }]} multiline
              value={caption} onChangeText={setCaption}
              placeholder={t('اكتب الخبر...', 'Write the post...')} placeholderTextColor={Colors.textSecondary} />
            {files.length > 1 && (
              <Text style={styles.note}>{t('الخبر يقبل مرفق واحد، سيتم استخدام أول ملف فقط.', 'A post takes one attachment; only the first file is used.')}</Text>
            )}
            <SubmitBtn busy={busy} progress={progress} label={t('نشر الخبر', 'Publish')} onPress={publishNews} />
            <BackLink onPress={() => setDest(null)} label={t('رجوع', 'Back')} />
          </>
        )}

        {/* قناة الأدمنز */}
        {dest === 'chat' && (
          <>
            <Text style={styles.label}>{t('رسالة (اختياري)', 'Message (optional)')}</Text>
            <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} multiline
              value={caption} onChangeText={setCaption}
              placeholder={t('اكتب تعليق...', 'Add a caption...')} placeholderTextColor={Colors.textSecondary} />
            <SubmitBtn busy={busy} progress={progress} label={t('إرسال للقناة', 'Send to channel')} onPress={sendToAdminChat} />
            <BackLink onPress={() => setDest(null)} label={t('رجوع', 'Back')} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function DestCard({ icon, title, sub, onPress }: { icon: any; title: string; sub: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.destCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.destIcon}><Ionicons name={icon} size={24} color={Colors.accent} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.destTitle}>{title}</Text>
        <Text style={styles.destSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
    </TouchableOpacity>
  );
}

function SubmitBtn({ busy, progress, label, onPress }: { busy: boolean; progress: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.primaryBtn, busy && { opacity: 0.7 }]} disabled={busy} onPress={onPress}>
      {busy ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ActivityIndicator color="#FFF" />
          {!!progress && <Text style={styles.primaryBtnText}>{progress}</Text>}
        </View>
      ) : (
        <Text style={styles.primaryBtnText}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

function BackLink({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ alignSelf: 'center', marginTop: 14, padding: 8 }}>
      <Text style={{ color: Colors.accent, fontWeight: '700' }}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: Colors.background },
  header: { backgroundColor: Colors.primary, paddingTop: 48, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  muted: { color: Colors.textSecondary, fontSize: 15, textAlign: 'center' },
  card: { backgroundColor: Colors.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  thumb: { width: 44, height: 44, borderRadius: 8 },
  thumbIcon: { backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  fileName: { flex: 1, color: Colors.textPrimary, fontSize: 14, textAlign: 'left' },
  sectionTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 10, textAlign: 'left' },
  destCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  destIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.accentLight, alignItems: 'center', justifyContent: 'center' },
  destTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', textAlign: 'left' },
  destSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2, textAlign: 'left' },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  listItemText: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600', flex: 1, textAlign: 'left' },
  label: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700', marginTop: 10, marginBottom: 6, textAlign: 'left' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#FFF' },
  input: { backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12, color: Colors.textPrimary, fontSize: 15 },
  note: { color: Colors.warning, fontSize: 12, marginTop: 8, textAlign: 'left' },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', marginTop: 18 },
  primaryBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
});
