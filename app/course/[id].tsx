import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Alert, Linking, Modal, TextInput
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { Colors } from '../../src/constants/colors';
import { apiCall, apiDelete, uploadFile } from '../../src/utils/api';
import * as DocumentPicker from 'expo-document-picker';
import { confirmAction } from '../../src/utils/confirmAction';
import { openFileOfflineAware, isFileCached, downloadAndCacheFile } from '../../src/utils/fileCache';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';

interface FileItem {
  id: string;
  course_id: string;
  name: string;
  type: string;
  folder: string;
  size: number;
  url: string;
  created_at: string;
}

interface FolderSection {
  title: string;
  data: FileItem[];
}

export default function CourseDetailScreen() {
  const { id, openFile } = useLocalSearchParams<{ id: string; openFile?: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const lang = user?.language || 'en';
  const isArabic = lang === 'ar';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [course, setCourse] = useState<any>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<{ uri: string; name: string; mimeType?: string; folder: string } | null>(null);
  const [uploadNameInput, setUploadNameInput] = useState('');
  // عشان لو جينا من إشعار "ملف جديد" نفتح الملف تلقائي مرة واحدة بس
  const [autoOpenedFile, setAutoOpenedFile] = useState(false);
  // الفولدر المفتوح حالياً - null يعني إحنا في قائمة الفولدرات مش جوه واحد منهم
  const [activeFolder, setActiveFolder] = useState<string | null>(null);

  // الفولدرات الافتراضية
  const DEFAULT_FOLDERS = [
    { key: 'General', label: isArabic ? 'عام' : 'General', icon: 'folder' },
    { key: 'PDFs', label: isArabic ? 'ملفات PDF' : 'PDFs', icon: 'document-text' },
    { key: 'Videos', label: isArabic ? 'فيديوهات' : 'Videos', icon: 'videocam' },
    { key: 'Images', label: isArabic ? 'صور' : 'Images', icon: 'image' },
    { key: 'Assignments', label: isArabic ? 'واجبات' : 'Assignments', icon: 'clipboard' },
    { key: 'Exams', label: isArabic ? 'امتحانات' : 'Exams', icon: 'school' },
  ];

  const fetchCourse = useCallback(async () => {
    if (!id) return;
    try {
      const data = await apiCall(`/courses/${id}`);
      if (data?.course) {
        setCourse(data.course);
        setFiles(data.course.files || []);
      } else {
        Alert.alert(
          isArabic ? 'خطأ' : 'Error',
          isArabic ? 'المادة غير موجودة' : 'Course not found'
        );
        router.back();
      }
    } catch {
      Alert.alert(
        isArabic ? 'خطأ' : 'Error',
        isArabic ? 'فشل تحميل المادة' : 'Failed to load course'
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCourse();
  }, [id]);

  // فتح الملف تلقائي لو جينا من إشعار (openFile في الرابط) بمجرد ما الملفات تحمل
  useEffect(() => {
    if (!openFile || autoOpenedFile || loading || !files.length) return;
    const target = files.find(f => f.id === openFile);
    if (target) {
      setAutoOpenedFile(true);
      setActiveFolder(target.folder || 'General');
      handleDownload(target);
    }
  }, [openFile, autoOpenedFile, loading, files]);

  // تجميع الملفات في فولدرات
  function getGroupedFiles(): FolderSection[] {
    const grouped: Record<string, FileItem[]> = {};

    files.forEach(file => {
      const folder = file.folder || 'General';
      if (!grouped[folder]) grouped[folder] = [];
      grouped[folder].push(file);
    });

    return Object.keys(grouped).map(folder => ({
      title: folder,
      data: grouped[folder],
    }));
  }

  // الفولدرات الموجودة في الملفات
  function getExistingFolders(): string[] {
    const folders = new Set(files.map(f => f.folder || 'General'));
    return Array.from(folders);
  }

  async function handleUpload(folder: string) {
    setShowFolderPicker(false);
    setShowNewFolderInput(false);
    setNewFolderName('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      if (!file) return;

      // بدل ما نرفع على طول، نفتح نافذة صغيرة تدي الأدمن فرصة يغيّر اسم الملف
      setPendingUpload({ uri: file.uri, name: file.name, mimeType: file.mimeType, folder });
      setUploadNameInput(file.name);
    } catch (e: any) {
      Alert.alert(
        isArabic ? 'خطأ' : 'Error',
        e.message || (isArabic ? 'فشل اختيار الملف' : 'Failed to pick file')
      );
    }
  }

  async function confirmUpload() {
    if (!pendingUpload) return;
    const finalName = uploadNameInput.trim() || pendingUpload.name;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: pendingUpload.uri,
        name: pendingUpload.name,
        type: pendingUpload.mimeType || 'application/octet-stream',
      } as any);
      formData.append('folder', pendingUpload.folder);
      formData.append('name', finalName);

      const data = await uploadFile(`/courses/${id}/files`, formData);

      if (data?.file) {
        setFiles(prev => [data.file, ...prev]);
        setPendingUpload(null);
        Alert.alert(
          '✅',
          isArabic ? 'تم رفع الملف بنجاح' : 'File uploaded successfully'
        );
      } else {
        throw new Error('Upload failed');
      }
    } catch (e: any) {
      Alert.alert(
        isArabic ? 'خطأ' : 'Error',
        e.message || (isArabic ? 'فشل رفع الملف' : 'Upload failed')
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(fileId: string, fileName: string) {
    confirmAction({
      title: isArabic ? 'حذف الملف' : 'Delete File',
      message: isArabic ? `هل تريد حذف "${fileName}"؟` : `Delete "${fileName}"?`,
      confirmText: isArabic ? 'حذف' : 'Delete',
      cancelText: isArabic ? 'إلغاء' : 'Cancel',
      destructive: true,
      onConfirm: async () => {
        try {
          await apiDelete(`/courses/${id}/files/${fileId}`);
          setFiles(prev => prev.filter(f => f.id !== fileId));
          Alert.alert('✅', isArabic ? 'تم حذف الملف' : 'File deleted');
        } catch {
          Alert.alert(
            isArabic ? 'خطأ' : 'Error',
            isArabic ? 'فشل حذف الملف' : 'Delete failed'
          );
        }
      },
    });
  }

  async function handleDownload(item: FileItem) {
    const fileUrl = item.url || `${BASE_URL}/courses/${id}/files/${item.id}`;
    // يحمل الملف أول مرة (لو فيه نت) ويحفظه محلياً، وبعدين يفتحه أوفلاين
    await openFileOfflineAware(item.id, fileUrl, item.name, isArabic);
  }

  function getFileIcon(type: string): string {
    if (!type) return 'document-outline';
    const t = type.toLowerCase();
    if (t === 'pdf') return 'document-text';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(t)) return 'image';
    if (['mp4', 'mov', 'avi', 'mkv'].includes(t)) return 'videocam';
    if (['mp3', 'wav', 'aac'].includes(t)) return 'musical-notes';
    if (['doc', 'docx'].includes(t)) return 'document';
    if (['xls', 'xlsx'].includes(t)) return 'grid';
    if (['ppt', 'pptx'].includes(t)) return 'easel';
    if (['zip', 'rar'].includes(t)) return 'archive';
    return 'document-outline';
  }

  function getFileColor(type: string): string {
    if (!type) return Colors.primary;
    const t = type.toLowerCase();
    if (t === 'pdf') return '#EF4444';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(t)) return '#3B82F6';
    if (['mp4', 'mov', 'avi', 'mkv'].includes(t)) return '#8B5CF6';
    if (['mp3', 'wav', 'aac'].includes(t)) return '#EC4899';
    if (['doc', 'docx'].includes(t)) return '#2563EB';
    if (['xls', 'xlsx'].includes(t)) return '#16A34A';
    if (['ppt', 'pptx'].includes(t)) return '#EA580C';
    return Colors.primary;
  }

  function formatSize(bytes: number): string {
    if (!bytes || bytes < 1024) return `${bytes || 0} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  function getFolderIcon(folderName: string): string {
    const name = folderName.toLowerCase();
    if (name.includes('pdf')) return 'document-text';
    if (name.includes('video')) return 'videocam';
    if (name.includes('image') || name.includes('photo')) return 'image';
    if (name.includes('exam')) return 'school';
    if (name.includes('assign')) return 'clipboard';
    return 'folder';
  }

  function renderFile({ item }: { item: FileItem }) {
    return (
      <View style={styles.fileCard} testID={`file-card-${item.id}`}>
        <View style={[styles.fileIcon, { backgroundColor: getFileColor(item.type) + '18' }]}>
          <Ionicons
            name={getFileIcon(item.type) as any}
            size={22}
            color={getFileColor(item.type)}
          />
        </View>

        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={2}>{item.name}</Text>
          <View style={styles.fileMeta}>
            <Text style={styles.fileSize}>{formatSize(item.size)}</Text>
            <Text style={styles.fileDot}> · </Text>
            <Text style={styles.fileType}>{(item.type || 'FILE').toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.fileActions}>
          <TouchableOpacity
            testID={`download-file-${item.id}`}
            style={styles.dlBtn}
            onPress={() => handleDownload(item)}
          >
            <Ionicons name="download-outline" size={20} color={Colors.accent} />
          </TouchableOpacity>

          {isAdmin && (
            <TouchableOpacity
              testID={`delete-file-${item.id}`}
              style={styles.delBtn}
              onPress={() => handleDelete(item.id, item.name)}
            >
              <Ionicons name="trash-outline" size={18} color={Colors.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // كرت فولدر في قائمة الفولدرات - بيدوس عليه المستخدم عشان يدخل جوه ويشوف الملفات
  function renderFolderCard({ item }: { item: FolderSection }) {
    return (
      <TouchableOpacity
        style={styles.folderCard}
        activeOpacity={0.7}
        onPress={() => setActiveFolder(item.title)}
      >
        <View style={styles.folderCardIcon}>
          <Ionicons name={getFolderIcon(item.title) as any} size={22} color={Colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.folderCardTitle}>{item.title}</Text>
          <Text style={styles.folderCardCount}>
            {item.data.length} {isArabic ? 'ملف' : 'files'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  if (!course) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
        <Text style={styles.emptyText}>
          {isArabic ? 'المادة غير موجودة' : 'Course not found'}
        </Text>
      </View>
    );
  }

  const groupedFiles = getGroupedFiles();

  return (
    <View style={styles.container} testID="course-detail-screen">

      {/* هيدر الكورس */}
      <View style={styles.courseHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.courseName}>
          {isArabic && course.name_ar ? course.name_ar : course.name}
        </Text>
        {course.description || course.description_ar ? (
          <Text style={styles.courseDesc}>
            {isArabic && course.description_ar ? course.description_ar : course.description}
          </Text>
        ) : null}
        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Ionicons name="document" size={16} color={Colors.accent} />
            <Text style={styles.statNum}>{files.length}</Text>
            <Text style={styles.statLabel}>
              {isArabic ? 'ملف' : 'files'}
            </Text>
          </View>
          <View style={[styles.statItem, { marginLeft: 16 }]}>
            <Ionicons name="folder" size={16} color={Colors.accent} />
            <Text style={styles.statNum}>{groupedFiles.length}</Text>
            <Text style={styles.statLabel}>
              {isArabic ? 'مجلد' : 'folders'}
            </Text>
          </View>
        </View>
      </View>

      {/* زر رفع الملفات للأدمن */}
      {isAdmin && (
        <TouchableOpacity
          testID="upload-file-btn"
          style={styles.uploadBtn}
          onPress={() => setShowFolderPicker(true)}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="cloud-upload" size={20} color="#FFF" />
              <Text style={styles.uploadText}>
                {isArabic ? 'رفع ملف' : 'Upload File'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* اختيار الفولدر للرفع */}
      {showFolderPicker && (
        <View style={styles.folderPicker}>
          <Text style={styles.folderPickerTitle}>
            {isArabic ? 'اختر المجلد' : 'Select Folder'}
          </Text>
          <View style={styles.folderGrid}>
            {DEFAULT_FOLDERS.map(folder => (
              <TouchableOpacity
                key={folder.key}
                style={styles.folderPickerItem}
                onPress={() => handleUpload(folder.key)}
              >
                <Ionicons
                  name={folder.icon as any}
                  size={24}
                  color={Colors.primary}
                />
                <Text style={styles.folderPickerLabel}>{folder.label}</Text>
              </TouchableOpacity>
            ))}
            {/* مجلدات مخصصة اتعملت قبل كده (مش من القايمة الافتراضية) */}
            {getExistingFolders()
              .filter(f => !DEFAULT_FOLDERS.some(d => d.key === f))
              .map(folder => (
                <TouchableOpacity
                  key={folder}
                  style={styles.folderPickerItem}
                  onPress={() => handleUpload(folder)}
                >
                  <Ionicons name="folder" size={24} color={Colors.primary} />
                  <Text style={styles.folderPickerLabel}>{folder}</Text>
                </TouchableOpacity>
              ))}
          </View>

          {/* إنشاء مجلد جديد بالاسم اللي عايزه الأدمن */}
          {showNewFolderInput ? (
            <View style={styles.newFolderRow}>
              <TextInput
                style={styles.newFolderInput}
                placeholder={isArabic ? 'اسم المجلد الجديد' : 'New folder name'}
                placeholderTextColor={Colors.textSecondary}
                value={newFolderName}
                onChangeText={setNewFolderName}
                autoFocus
              />
              <TouchableOpacity
                style={styles.newFolderConfirmBtn}
                onPress={() => {
                  if (newFolderName.trim()) handleUpload(newFolderName.trim());
                }}
              >
                <Ionicons name="checkmark" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.newFolderBtn}
              onPress={() => setShowNewFolderInput(true)}
            >
              <Ionicons name="add-circle-outline" size={18} color={Colors.accent} />
              <Text style={styles.newFolderBtnText}>
                {isArabic ? 'مجلد جديد باسم مخصص' : 'New custom folder'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.cancelPickerBtn}
            onPress={() => {
              setShowFolderPicker(false);
              setShowNewFolderInput(false);
              setNewFolderName('');
            }}
          >
            <Text style={styles.cancelPickerText}>
              {isArabic ? 'إلغاء' : 'Cancel'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* نافذة تأكيد اسم الملف قبل الرفع */}
      <Modal
        visible={!!pendingUpload}
        transparent
        animationType="fade"
        onRequestClose={() => !uploading && setPendingUpload(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.nameModalContent}>
            <Text style={styles.folderPickerTitle}>
              {isArabic ? 'اسم الملف' : 'File Name'}
            </Text>
            <Text style={styles.nameModalHint}>
              {isArabic
                ? 'تقدر تغيّر الاسم اللي هيبان للطلاب، أو تسيبه زي ما هو'
                : "You can change the name students will see, or leave it as is"}
            </Text>
            <TextInput
              style={styles.newFolderInput}
              value={uploadNameInput}
              onChangeText={setUploadNameInput}
              placeholder={isArabic ? 'اسم الملف' : 'File name'}
              placeholderTextColor={Colors.textSecondary}
              editable={!uploading}
            />
            <View style={styles.modalBtnsRow}>
              <TouchableOpacity
                style={[styles.cancelPickerBtn, { flex: 1 }]}
                onPress={() => setPendingUpload(null)}
                disabled={uploading}
              >
                <Text style={styles.cancelPickerText}>
                  {isArabic ? 'إلغاء' : 'Cancel'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.uploadConfirmBtn}
                onPress={confirmUpload}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.uploadConfirmText}>
                    {isArabic ? 'رفع' : 'Upload'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* قائمة الملفات مجمعة في فولدرات - قائمة الفولدرات، أو محتوى فولدر معيّن لو اتفتح */}
      {files.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="folder-open-outline" size={64} color={Colors.border} />
          <Text style={styles.emptyText}>
            {isArabic ? 'لا توجد ملفات بعد' : 'No files yet'}
          </Text>
          {isAdmin && (
            <Text style={styles.emptySubText}>
              {isArabic ? 'اضغط رفع ملف لإضافة ملفات' : 'Press Upload File to add files'}
            </Text>
          )}
        </View>
      ) : activeFolder === null ? (
        // قائمة الفولدرات
        <FlatList
          data={groupedFiles}
          keyExtractor={section => section.title}
          renderItem={renderFolderCard}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        // جوه فولدر معيّن - قائمة الملفات بتاعته بس
        <FlatList
          data={groupedFiles.find(g => g.title === activeFolder)?.data || []}
          keyExtractor={item => item.id}
          renderItem={renderFile}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <TouchableOpacity
              style={styles.folderBackRow}
              onPress={() => setActiveFolder(null)}
            >
              <Ionicons name="arrow-back" size={18} color={Colors.accent} />
              <Text style={styles.folderBackText}>
                {isArabic ? 'كل المجلدات' : 'All folders'}
              </Text>
              <Text style={styles.folderBackTitle}>· {activeFolder}</Text>
            </TouchableOpacity>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: {
    flex: 1, justifyContent: 'center',
    alignItems: 'center', backgroundColor: Colors.background,
  },
  backBtn: { marginBottom: 8 },
  courseHeader: {
    backgroundColor: '#FFF', padding: 20,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  courseName: {
    fontSize: 22, fontWeight: '800',
    color: Colors.textPrimary, marginBottom: 6,
  },
  courseDesc: {
    fontSize: 14, color: Colors.textSecondary,
    lineHeight: 20, marginBottom: 12,
  },
  stats: { flexDirection: 'row' },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statNum: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  statLabel: { fontSize: 13, color: Colors.textSecondary },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', backgroundColor: Colors.accent,
    margin: 16, marginBottom: 8, paddingVertical: 14,
    borderRadius: 12, gap: 8,
  },
  uploadText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  folderPicker: {
    backgroundColor: '#FFF', margin: 16, marginTop: 0,
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  folderPickerTitle: {
    fontSize: 16, fontWeight: '700',
    color: Colors.textPrimary, marginBottom: 12,
  },
  folderGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  folderPickerItem: {
    width: '30%', alignItems: 'center',
    backgroundColor: Colors.background, borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: Colors.border,
  },
  folderPickerLabel: {
    fontSize: 12, color: Colors.textPrimary,
    fontWeight: '600', marginTop: 4, textAlign: 'center',
  },
  cancelPickerBtn: {
    marginTop: 12, alignItems: 'center',
    paddingVertical: 10,
  },
  cancelPickerText: {
    fontSize: 14, color: Colors.textSecondary, fontWeight: '600',
  },
  newFolderBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 12, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.accent,
    borderStyle: 'dashed',
  },
  newFolderBtnText: {
    fontSize: 13, fontWeight: '600', color: Colors.accent,
  },
  newFolderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12,
  },
  newFolderInput: {
    flex: 1, backgroundColor: Colors.background, borderWidth: 1,
    borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 10, fontSize: 14, color: Colors.textPrimary,
  },
  newFolderConfirmBtn: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', padding: 24,
  },
  nameModalContent: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 20,
  },
  nameModalHint: {
    fontSize: 12, color: Colors.textSecondary, marginBottom: 12, marginTop: 4,
  },
  modalBtnsRow: {
    flexDirection: 'row', gap: 10, marginTop: 16,
  },
  uploadConfirmBtn: {
    flex: 1, backgroundColor: Colors.accent, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', justifyContent: 'center',
  },
  uploadConfirmText: {
    color: '#FFF', fontSize: 14, fontWeight: '700',
  },
  folderCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF', marginHorizontal: 16,
    marginBottom: 10, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(0,33,71,0.05)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03, shadowRadius: 8, elevation: 2,
  },
  folderCardIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.accent + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  folderCardTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  folderCardCount: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  folderBackRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  folderBackText: { fontSize: 14, fontWeight: '700', color: Colors.accent },
  folderBackTitle: { fontSize: 14, color: Colors.textSecondary },
  listContent: { paddingBottom: 32 },
  fileCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', marginHorizontal: 16,
    marginBottom: 8, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(0,33,71,0.05)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03, shadowRadius: 8, elevation: 2,
  },
  fileIcon: {
    width: 46, height: 46, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  fileInfo: { flex: 1 },
  fileName: {
    fontSize: 15, fontWeight: '600',
    color: Colors.textPrimary, marginBottom: 4,
  },
  fileMeta: { flexDirection: 'row', alignItems: 'center' },
  fileSize: { fontSize: 12, color: Colors.textSecondary },
  fileDot: { fontSize: 12, color: Colors.border },
  fileType: {
    fontSize: 12, color: Colors.textSecondary, fontWeight: '600',
  },
  fileActions: { flexDirection: 'row', gap: 8 },
  dlBtn: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: 'rgba(212,175,55,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  delBtn: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyWrap: { alignItems: 'center', marginTop: 80 },
  emptyText: {
    fontSize: 16, color: Colors.textSecondary,
    marginTop: 12, fontWeight: '600',
  },
  emptySubText: {
    fontSize: 13, color: Colors.textSecondary, marginTop: 4,
  },
});
