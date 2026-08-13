import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, TextInput, RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiCall } from '../../src/utils/api';
import { useAuth } from '../../src/context/AuthContext';
import { Colors } from '../../src/constants/colors';

export default function ManageRoles() {
  const { user } = useAuth();
  const router = useRouter();
  const isArabic = user?.language === 'ar';

  const [users, setUsers] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  async function loadUsers() {
    try {
      const data = await apiCall('/admin/users');
      if (data?.users) {
        setUsers(data.users);
        setFiltered(data.users);
      } else {
        setUsers([]);
        setFiltered([]);
      }
    } catch (e: any) {
      Alert.alert(
        isArabic ? 'خطأ' : 'Error',
        isArabic ? 'فشل تحميل المستخدمين' : 'Failed to load users'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function handleSearch(q: string) {
    setSearch(q);
    if (!q.trim()) {
      setFiltered(users);
      return;
    }
    const lower = q.toLowerCase();
    setFiltered(
      users.filter(u =>
        u.name?.toLowerCase().includes(lower) ||
        u.email?.toLowerCase().includes(lower) ||
        u.university_id?.toLowerCase().includes(lower)
      )
    );
  }

  async function updateRole(uid: string, role: string, userName: string) {
    // منع السوبر أدمن من تغيير دوره
    if (uid === user?.id) {
      Alert.alert(
        isArabic ? 'تنبيه' : 'Warning',
        isArabic ? 'لا يمكنك تغيير دورك' : 'You cannot change your own role'
      );
      return;
    }

    const roleLabel =
      role === 'super_admin'
        ? 'Super Admin'
        : role === 'admin'
        ? 'Admin'
        : isArabic ? 'طالب' : 'Student';

    Alert.alert(
      isArabic ? 'تأكيد' : 'Confirm',
      isArabic
        ? `هل تريد تغيير دور "${userName}" إلى ${roleLabel}؟`
        : `Change "${userName}" role to ${roleLabel}?`,
      [
        { text: isArabic ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isArabic ? 'تأكيد' : 'Confirm',
          onPress: async () => {
            setUpdating(uid);
            try {
              const data = await apiCall(`/admin/set-role/${uid}`, {
                method: 'POST',
                body: JSON.stringify({ role }),
              });
              if (data) {
                Alert.alert(
                  '✅',
                  isArabic
                    ? `تم تغيير الدور إلى ${roleLabel}`
                    : `Role updated to ${roleLabel}`
                );
                loadUsers();
              }
            } catch (e: any) {
              Alert.alert(
                isArabic ? 'خطأ' : 'Error',
                isArabic ? 'فشل تغيير الدور' : 'Failed to update role'
              );
            } finally {
              setUpdating(null);
            }
          },
        },
      ]
    );
  }

  function getRoleColor(role: string): string {
    if (role === 'super_admin') return Colors.accent;
    if (role === 'admin') return Colors.primary;
    return Colors.success;
  }

  function getRoleLabel(role: string): string {
    if (role === 'super_admin') return 'Super Admin';
    if (role === 'admin') return 'Admin';
    return isArabic ? 'طالب' : 'Student';
  }

  function renderUser({ item }: { item: any }) {
    const isCurrentUser = item.id === user?.id;
    const isUpdating = updating === item.id;

    return (
      <View style={[styles.userCard, isCurrentUser && styles.currentUserCard]}>

        {/* معلومات المستخدم */}
        <View style={styles.userInfo}>
          <View style={styles.avatarWrap}>
            <Ionicons name="person" size={20} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              {isCurrentUser && (
                <Text style={styles.youBadge}>
                  {isArabic ? 'أنت' : 'You'}
                </Text>
              )}
            </View>
            <Text style={styles.email} numberOfLines={1}>{item.email}</Text>
            {item.university_id && (
              <Text style={styles.uid}>
                {isArabic ? 'الرقم: ' : 'ID: '}{item.university_id}
              </Text>
            )}
            <View style={[
              styles.roleBadge,
              { backgroundColor: getRoleColor(item.role) + '20' }
            ]}>
              <Text style={[styles.roleText, { color: getRoleColor(item.role) }]}>
                {getRoleLabel(item.role)}
              </Text>
            </View>
          </View>
        </View>

        {/* أزرار تغيير الدور */}
        {!isCurrentUser && (
          <View style={styles.btnRow}>
            {isUpdating ? (
              <ActivityIndicator color={Colors.accent} />
            ) : (
              <>
                <TouchableOpacity
                  style={[
                    styles.roleBtn,
                    item.role === 'student' && styles.roleBtnActive,
                  ]}
                  onPress={() => updateRole(item.id, 'student', item.name)}
                  disabled={item.role === 'student'}
                >
                  <Ionicons
                    name="school-outline"
                    size={14}
                    color={item.role === 'student' ? '#FFF' : Colors.primary}
                  />
                  <Text style={[
                    styles.roleBtnText,
                    item.role === 'student' && styles.roleBtnTextActive,
                  ]}>
                    {isArabic ? 'طالب' : 'Student'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.roleBtn,
                    item.role === 'admin' && styles.roleBtnActive,
                  ]}
                  onPress={() => updateRole(item.id, 'admin', item.name)}
                  disabled={item.role === 'admin'}
                >
                  <Ionicons
                    name="shield-outline"
                    size={14}
                    color={item.role === 'admin' ? '#FFF' : Colors.primary}
                  />
                  <Text style={[
                    styles.roleBtnText,
                    item.role === 'admin' && styles.roleBtnTextActive,
                  ]}>
                    Admin
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.roleBtn,
                    styles.superRoleBtn,
                    item.role === 'super_admin' && styles.superRoleBtnActive,
                  ]}
                  onPress={() => updateRole(item.id, 'super_admin', item.name)}
                  disabled={item.role === 'super_admin'}
                >
                  <Ionicons
                    name="star-outline"
                    size={14}
                    color={item.role === 'super_admin' ? '#FFF' : Colors.accent}
                  />
                  <Text style={[
                    styles.roleBtnText,
                    { color: item.role === 'super_admin' ? '#FFF' : Colors.accent },
                  ]}>
                    Super
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
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
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.title}>
          {isArabic ? 'إدارة الأدوار' : 'Manage Roles'}
        </Text>
        <Text style={styles.totalCount}>
          {filtered.length} {isArabic ? 'مستخدم' : 'users'}
        </Text>
      </View>

      {/* البحث */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color="rgba(255,255,255,0.6)" />
        <TextInput
          style={styles.searchInput}
          placeholder={isArabic ? 'بحث بالاسم أو البريد...' : 'Search by name or email...'}
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={search}
          onChangeText={handleSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderUser}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadUsers(); }}
            tintColor={Colors.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="people-outline" size={48} color="rgba(255,255,255,0.3)" />
            <Text style={styles.emptyText}>
              {isArabic ? 'لا توجد نتائج' : 'No users found'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#002147' },
  center: {
    flex: 1, justifyContent: 'center',
    alignItems: 'center', backgroundColor: '#002147',
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 60,
    paddingBottom: 16, gap: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    flex: 1, fontSize: 22,
    fontWeight: '800', color: '#FFF',
  },
  totalCount: {
    fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600',
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 20, marginBottom: 16,
    borderRadius: 12, paddingHorizontal: 14,
    height: 46, gap: 10,
  },
  searchInput: {
    flex: 1, fontSize: 14,
    color: '#FFF',
  },
  listContent: { paddingHorizontal: 20, paddingBottom: 32 },
  userCard: {
    backgroundColor: '#FFF', borderRadius: 14,
    padding: 16, marginBottom: 12,
  },
  currentUserCard: {
    borderWidth: 2, borderColor: Colors.accent,
  },
  userInfo: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 12, marginBottom: 12,
  },
  avatarWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: {
    fontSize: 16, fontWeight: '700',
    color: Colors.textPrimary, flex: 1,
  },
  youBadge: {
    fontSize: 11, fontWeight: '700',
    color: Colors.accent,
    backgroundColor: Colors.accent + '20',
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 6,
  },
  email: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  uid: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  roleBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 10,
    paddingVertical: 3, borderRadius: 8, marginTop: 6,
  },
  roleText: { fontSize: 12, fontWeight: '700' },
  btnRow: {
    flexDirection: 'row', gap: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  roleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 8,
    borderRadius: 10, borderWidth: 1,
    borderColor: Colors.primary, gap: 4,
  },
  roleBtnActive: {
    backgroundColor: Colors.primary, borderColor: Colors.primary,
  },
  superRoleBtn: { borderColor: Colors.accent },
  superRoleBtnActive: {
    backgroundColor: Colors.accent, borderColor: Colors.accent,
  },
  roleBtnText: {
    fontSize: 12, fontWeight: '700', color: Colors.primary,
  },
  roleBtnTextActive: { color: '#FFF' },
  emptyWrap: {
    alignItems: 'center', marginTop: 60, gap: 12,
  },
  emptyText: {
    fontSize: 16, color: 'rgba(255,255,255,0.5)', fontWeight: '600',
  },
});
