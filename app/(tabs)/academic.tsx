import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, RefreshControl, Modal, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { Colors } from '../../src/constants/colors';
import { apiCall, apiPut, apiDelete } from '../../src/utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Course {
  id: string;
  name: string;
  name_ar: string;
  description: string;
  description_ar: string;
  file_count: number;
}

interface SearchResults {
  courses?: Course[];
  files?: any[];
}

export default function AcademicTab() {
  const { user } = useAuth();
  const router = useRouter();
  const lang = user?.language || 'en';
  const isArabic = lang === 'ar';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // البحث
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<any>(null);

  // تعديل الكورس
  const [editModal, setEditModal] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [editName, setEditName] = useState('');
  const [editNameAr, setEditNameAr] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDescAr, setEditDescAr] = useState('');
  const [saving, setSaving] = useState(false);

  // إنشاء كورس جديد
  const [createModal, setCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNameAr, setNewNameAr] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDescAr, setNewDescAr] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchCourses = useCallback(async () => {
    try {
      const data = await apiCall('/courses/');
      if (data?.courses) {
        setCourses(data.courses);
        await AsyncStorage.setItem('courses', JSON.stringify(data.courses));
      } else {
        // تحميل من الكاش لو السيرفر فشل
        const cached = await AsyncStorage.getItem('courses');
        if (cached) setCourses(JSON.parse(cached));
      }
    } catch (e) {
      const cached = await AsyncStorage.getItem('courses');
      if (cached) setCourses(JSON.parse(cached));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, []);

  // البحث مع debounce عشان ما يبعث request لكل حرف
  function handleSearch(q: string) {
    setSearch(q);

    if (searchTimeout) clearTimeout(searchTimeout);

    if (q.length < 2) {
      setSearchResults(null);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await apiCall(`/search?q=${encodeURIComponent(q)}`);
        if (data) setSearchResults(data);
      } catch {
        setSearchResults(null);
      } finally {
        setSearching(false);
      }
    }, 500); // انتظر 500ms بعد آخر حرف

    setSearchTimeout(timeout);
  }

  function clearSearch() {
    setSearch('');
    setSearchResults(null);
    if (searchTimeout) clearTimeout(searchTimeout);
  }

  function openEdit(c: Course) {
    setEditCourse(c);
    setEditName(c.name);
    setEditNameAr(c.name_ar || '');
    setEditDesc(c.description || '');
    setEditDescAr(c.description_ar || '');
    setEditModal(true);
  }

  async function handleSaveEdit() {
    if (!editCourse || !editName.trim()) {
      Alert.alert('خطأ', 'اسم الكورس مطلوب');
      return;
    }
    setSaving(true);
    try {
      const data = await apiPut(`/courses/${editCourse.id}`, {
        name: editName.trim(),
        name_ar: editNameAr.trim(),
        description: editDesc.trim(),
        description_ar: editDescAr.trim(),
      });
      if (data) {
        setEditModal(false);
        fetchCourses();
        Alert.alert('✅', isArabic ? 'تم تحديث الكورس' : 'Course updated');
      }
    } catch {
      Alert.alert('خطأ', 'فشل تحديث الكورس');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCourse(course: Course) {
    Alert.alert(
      isArabic ? 'حذف الكورس' : 'Delete Course',
      isArabic
        ? `هل تريد حذف "${course.name_ar || course.name}"؟`
        : `Delete "${course.name}"?`,
      [
        { text: isArabic ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isArabic ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiDelete(`/courses/${course.id}`);
              fetchCourses();
              Alert.alert('✅', isArabic ? 'تم حذف الكورس' : 'Course deleted');
            } catch {
              Alert.alert('خطأ', 'فشل حذف الكورس');
            }
          },
        },
      ]
    );
  }

  async function handleCreateCourse() {
    if (!newName.trim()) {
      Alert.alert('خطأ', 'اسم الكورس مطلوب');
      return;
    }
    setCreating(true);
    try {
      const data = await apiCall('/courses/', {
        method: 'POST',
        body: JSON.stringify({
          name: newName.trim(),
          name_ar: newNameAr.trim(),
          description: newDesc.trim(),
          description_ar: newDescAr.trim(),
        }),
      });
      if (data) {
        setCreateModal(false);
        setNewName(''); setNewNameAr('');
        setNewDesc(''); setNewDescAr('');
        fetchCourses();
        Alert.alert('✅', isArabic ? 'تم إنشاء الكورس' : 'Course created');
      }
    } catch {
      Alert.alert('خطأ', 'فشل إنشاء الكورس');
    } finally {
      setCreating(false);
    }
  }

  function renderCourse({ item }: { item: Course }) {
    const courseName = isArabic && item.name_ar ? item.name_ar : item.name;
    const courseDesc = isArabic && item.description_ar
      ? item.description_ar
      : item.description;

    return (
      <TouchableOpacity
        style={styles.courseCard}
        onPress={() => router.push(`/course/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.courseIcon}>
          <Ionicons name="book" size={24} color={Colors.accent} />
        </View>

        <View style={styles.courseInfo}>
          <Text style={styles.courseName} numberOfLines={1}>{courseName}</Text>
          {courseDesc ? (
            <Text style={styles.courseDesc} numberOfLines={2}>{courseDesc}</Text>
          ) : null}
          <View style={styles.courseStats}>
            <Ionicons name="document-outline" size={12} color={Colors.textSecondary} />
            <Text style={styles.statText}>
              {' '}{item.file_count || 0} {isArabic ? 'ملف' : 'files'}
            </Text>
          </View>
        </View>

        {isAdmin && (
          <View style={styles.adminActions}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => openEdit(item)}
            >
              <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: '#FEE2E2' }]}
              onPress={() => handleDeleteCourse(item)}
            >
              <Ionicons name="trash-outline" size={16} color={Colors.error} />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  function renderSearchResults() {
    if (searching) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      );
    }

    if (!searchResults) return null;

    const hasCourses = (searchResults.courses?.length || 0) > 0;
    const hasFiles = (searchResults.files?.length || 0) > 0;

    if (!hasCourses && !hasFiles) {
      return (
        <View style={styles.center}>
          <Ionicons name="search-outline" size={48} color={Colors.textSecondary} />
          <Text style={styles.emptyText}>
            {isArabic ? 'لا توجد نتائج' : 'No results found'}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.searchResultsWrap}>
        {hasCourses && (
          <>
            <Text style={styles.sectionLabel}>
              {isArabic ? 'المواد' : 'Courses'}
            </Text>
            {searchResults.courses!.map(c => (
              <TouchableOpacity
                key={c.id}
                style={styles.searchItem}
                onPress={() => {
                  clearSearch();
                  router.push(`/course/${c.id}`);
                }}
              >
                <Ionicons name="book-outline" size={20} color={Colors.primary} />
                <Text style={styles.searchItemText}>
                  {isArabic && c.name_ar ? c.name_ar : c.name}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </>
        )}

        {hasFiles && (
          <>
            <Text style={styles.sectionLabel}>
              {isArabic ? 'الملفات' : 'Files'}
            </Text>
            {searchResults.files!.map(f => (
              <TouchableOpacity
                key={f.id}
                style={styles.searchItem}
                onPress={() => {
                  clearSearch();
                  router.push(`/course/${f.course_id}`);
                }}
              >
                <Ionicons name="document-outline" size={20} color={Colors.accent} />
                <Text style={styles.searchItemText}>{f.name}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* شريط البحث */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={20} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder={isArabic ? 'البحث في المواد والملفات...' : 'Search courses & files...'}
          placeholderTextColor={Colors.textSecondary}
          value={search}
          onChangeText={handleSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={clearSearch}>
            <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* نتائج البحث */}
      {search.length >= 2 ? renderSearchResults() : (
        <FlatList
          data={courses}
          keyExtractor={item => item.id}
          renderItem={renderCourse}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchCourses(); }}
              colors={[Colors.primary]}
            />
          }
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.headerTitle}>
                {isArabic ? 'المواد الدراسية' : 'Courses'}
              </Text>
              {isAdmin && (
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => setCreateModal(true)}
                >
                  <Ionicons name="add" size={18} color="#FFF" />
                  <Text style={styles.addBtnText}>
                    {isArabic ? 'إضافة مادة' : 'Add Course'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {isArabic ? 'لا توجد مواد' : 'No courses yet'}
            </Text>
          }
        />
      )}

      {/* Modal تعديل الكورس */}
      <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {isArabic ? 'تعديل المادة' : 'Edit Course'}
            </Text>

            <TextInput
              testID="edit-course-name"
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Course Name (EN)"
              placeholderTextColor={Colors.textSecondary}
            />
            <TextInput
              testID="edit-course-name-ar"
              style={[styles.modalInput, { textAlign: 'right' }]}
              value={editNameAr}
              onChangeText={setEditNameAr}
              placeholder="اسم المادة (عربي)"
              placeholderTextColor={Colors.textSecondary}
            />
            <TextInput
              style={styles.modalInput}
              value={editDesc}
              onChangeText={setEditDesc}
              placeholder="Description (EN)"
              multiline
              placeholderTextColor={Colors.textSecondary}
            />
            <TextInput
              style={[styles.modalInput, { textAlign: 'right' }]}
              value={editDescAr}
              onChangeText={setEditDescAr}
              placeholder="الوصف (عربي)"
              multiline
              placeholderTextColor={Colors.textSecondary}
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEditModal(false)}
              >
                <Text style={styles.cancelText}>
                  {isArabic ? 'إلغاء' : 'Cancel'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="save-edit-course"
                style={styles.saveBtn}
                onPress={handleSaveEdit}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Text style={styles.saveText}>{isArabic ? 'حفظ' : 'Save'}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal إنشاء كورس جديد */}
      <Modal visible={createModal} transparent animationType="slide" onRequestClose={() => setCreateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {isArabic ? 'إضافة مادة جديدة' : 'Add New Course'}
            </Text>

            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Course Name (EN)"
              placeholderTextColor={Colors.textSecondary}
            />
            <TextInput
              style={[styles.modalInput, { textAlign: 'right' }]}
              value={newNameAr}
              onChangeText={setNewNameAr}
              placeholder="اسم المادة (عربي)"
              placeholderTextColor={Colors.textSecondary}
            />
            <TextInput
              style={styles.modalInput}
              value={newDesc}
              onChangeText={setNewDesc}
              placeholder="Description (EN)"
              multiline
              placeholderTextColor={Colors.textSecondary}
            />
            <TextInput
              style={[styles.modalInput, { textAlign: 'right' }]}
              value={newDescAr}
              onChangeText={setNewDescAr}
              placeholder="الوصف (عربي)"
              multiline
              placeholderTextColor={Colors.textSecondary}
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setCreateModal(false)}
              >
                <Text style={styles.cancelText}>
                  {isArabic ? 'إلغاء' : 'Cancel'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleCreateCourse}
                disabled={creating}
              >
                {creating
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Text style={styles.saveText}>{isArabic ? 'إنشاء' : 'Create'}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', margin: 16, marginBottom: 8,
    paddingHorizontal: 16, borderRadius: 12, height: 48,
    borderWidth: 1, borderColor: Colors.border, gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.textPrimary },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  listHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16, marginTop: 8,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  addBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.accent, paddingHorizontal: 14,
    paddingVertical: 8, borderRadius: 10, gap: 4,
  },
  addBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  courseCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 16,
    padding: 16, marginBottom: 12,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04, shadowRadius: 12, elevation: 3,
    borderWidth: 1, borderColor: 'rgba(0,33,71,0.05)',
  },
  courseIcon: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: 'rgba(212,175,55,0.1)',
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  courseInfo: { flex: 1 },
  courseName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  courseDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginBottom: 6 },
  courseStats: { flexDirection: 'row', alignItems: 'center' },
  statText: { fontSize: 12, color: Colors.textSecondary },
  adminActions: { flexDirection: 'column', gap: 6, marginLeft: 8 },
  iconBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15, color: Colors.textSecondary,
    textAlign: 'center', marginTop: 40,
  },
  searchResultsWrap: { paddingHorizontal: 16, flex: 1 },
  sectionLabel: {
    fontSize: 14, fontWeight: '700', color: Colors.primary,
    marginTop: 16, marginBottom: 8,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  searchItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', padding: 14,
    borderRadius: 12, marginBottom: 8, gap: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchItemText: { fontSize: 15, color: Colors.textPrimary, flex: 1 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', padding: 24,
  },
  modalContent: { backgroundColor: '#FFF', borderRadius: 20, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: 16 },
  modalInput: {
    backgroundColor: Colors.background, borderWidth: 1,
    borderColor: Colors.border, borderRadius: 12,
    padding: 14, fontSize: 15, color: Colors.textPrimary, marginBottom: 12,
  },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  saveBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: Colors.primary, alignItems: 'center',
  },
  saveText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
