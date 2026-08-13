import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Alert, TextInput, RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { Colors } from '../../src/constants/colors';
import { apiCall } from '../../src/utils/api';

interface UserItem {
  id: string;
  email: string;
  university_id: string;
  name: string;
  role: string;
  status: string;
  last_online: string;
}

export default function AdminUsersScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const lang = user?.language || 'en';
  const isArabic = lang === 'ar';
  const isSuperAdmin = user?.role === 'super_admin';

  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const data = await apiCall('/admin/users');
      if (data?.users) {
        setUsers(data.users);
      } else {
        setUsers([]);
        Alert.alert(
          isArabic ? 'خطأ' : 'Error',
          isArabic ? 'فشل تحميل المستخدمين' : 'Failed to load users'
        );
      }
    } catch (e) {
      Alert.alert(
        isArabic ? 'خطأ' : 'Error',
        isArabic ? 'تحقق من الإنترنت' : 'Check your connection'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleApprove(userId: string, userName: string) {
    Alert.alert(
      isArabic ? 'تأكيد' : 'Confirm',
      isArabic ? `قبول "${userName}"؟` : `Approve "${userName}"?`,
      [
        { text: isArabic ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isArabic ? 'قبول' : 'Approve',
          onPress: async () => {
            setActionLoading(userId);
            try {
              await apiCall(`/admin/approve/${userId}`, { method: 'POST' });
              setUsers(prev =>
                prev.map(u => u.id === userId ? { ...u, status: 'approved' } : u)
              );
              Alert.alert('✅', isArabic ? 'تم القبول' : 'User approved');
            } catch {
              Alert.alert(
                isArabic ? 'خطأ' : 'Error',
                isArabic ? 'فشل القبول' : 'Failed to approve'
              );
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  }

  async function handleReject(userId: string, userName: string) {
    Alert.alert(
      isArabic ? 'تأكيد' : 'Confirm',
      isArabic ? `رفض "${userName}"؟` : `Reject "${userName}"?`,
      [
        { text: isArabic ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isArabic ? 'رفض' : 'Reject',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(userId);
            try {
              await apiCall(`/admin/reject/${userId}`, { method: 'POST' });
              setUsers(prev =>
                prev.map(u => u.id === userId ? { ...u, status: 'rejected' } : u)
              );
              Alert.alert('✅', isArabic ? 'تم الرفض' : 'User rejected');
            } catch {
              Alert.alert(
                isArabic ? 'خطأ' : 'Error',
                isArabic ? 'فشل الرفض' : 'Failed to reject'
              );
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  }

  function getStatusColor(status: string): string {
    if (status === 'approved') return Colors.success;
    if (status === 'pending') return Colors.warning;
    return Colors.error;
  }

  function getStatusLabel(status: string): string {
    if (isArabic) {
      if (status === 'approved') return 'مقبول';
      if (status === 'pending') return 'قيد الانتظار';
      return 'مرفوض';
    }
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  function getRoleLabel(role: string): string {
    if (role === 'super_admin') return 'Super Admin';
    if (role === 'admin') return 'Admin';
    return isArabic ? 'طالب' : 'Student';
  }

  // فلترة + بحث
  const filtered = users.filter(u => {
    // إخفاء السوبر أدمن من قائمة الأدمن العادي
    if (!isSuperAdmin && u.role === 'super_admin') return false;

    // فلتر الحالة
    if (filter !== 'all' && u.status !== filter) return false;

    // البحث
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.university_id?.toLowerCase().includes(q)
      );
    }

    return true;
  });

  const pendingCount = users.filter(u => u.status === 'pending').length;
  const approvedCount = users.filter(u => u.status === 'approved').length;
  const rejectedCount = users.filter(u => u.status === 'rejected').length;

  function renderUser({ item }: { item: UserItem }) {
    const isSelf = item.id === user?.id;
    const isLoading = actionLoading === item.id;

    return (
      <View style={styles.userCard}>

        {/* هيدر البطاقة */}
        <View style={styles.userHeader}>
          <View style={[styles.userAvatar, { backgroundColor: Colors.primary }]}>
            <Text style={styles.avatarText}>
              {item.name?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>

          <View style={styles.userInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.userName} numberOfLines={1}>{item.name}</Text>
              {isSelf && (
                <Text style={styles.youBadge}>
                  {isArabic ? 'أنت' : 'You'}
                </Text>
              )}
            </View>
            <Text style={styles.userEmail} numberOfLines={1}>{item.email}</Text>
            <Text style={styles.userId}>
              {isArabic ? 'الرقم: ' : 'ID: '}{item.university_id}
            </Text>
          </View>

          <View style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) + '15' }
          ]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {getStatusLabel(item.status)}
            </Text>
          </View>
        </View>

        {/* الدور */}
        <View style={styles.roleLine}>
          <Ionicons
            name={item.role === 'super_admin' ? 'star' : item.role === 'admin' ? 'shield' : 'school'}
            size={14}
            color={Colors.textSecondary}
          />
          <Text style={styles.roleLabel}>
            {isArabic ? 'الدور: ' : 'Role: '}
            <Text style={styles.roleValue}>{getRoleLabel(item.role)}</Text>
          </Text>
        </View>

        {/* أزرار الإجراءات */}
        {!isSelf && (
          <View style={styles.actions}>
            {isLoading ? (
              <ActivityIndicator color={Colors.primary} size="small" />
            ) : (
              <>
                {item.status === 'pending' && (
                  <>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: Colors.success }]}
                      onPress={() => handleApprove(item.id, item.name)}
                    >
                      <Ionicons name="checkmark" size={16} color="#FFF" />
                      <Text style={styles.actionText}>
                        {isArabic ? 'قبول' : 'Approve'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: Colors.error }]}
                      onPress={() => handleReject(item.id, item.name)}
                    >
                      <Ionicons name="close" size={16} color="#FFF" />
                      <Text style={styles.actionText}>
                        {isArabic ? 'رفض' : 'Reject'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                {item.status === 'approved' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: Colors.error }]}
                    onPress={() => handleReject(item.id, item.name)}
                  >
                    <Ionicons name="ban-outline" size={16} color="#FFF" />
                    <Text style={styles.actionText}>
                      {isArabic ? 'رفض' : 'Reject'}
                    </Text>
                  </TouchableOpacity>
                )}

                {item.status === 'rejected' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: Colors.success }]}
                    onPress={() => handleApprove(item.id, item.name)}
                  >
                    <Ionicons name="checkmark" size={16} color="#FFF" />
                    <Text style={styles.actionText}>
                      {isArabic ? 'قبول' : 'Approve'}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* تغيير الدور للسوبر أدمن فقط */}
                {isSuperAdmin && item.role !== 'super_admin' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: Colors.primary }]}
                    onPress={() => router.push(`/super-admin/manage-roles`)}
                  >
                    <Ionicons name="shield-outline" size={16} color="#FFF" />
                    <Text style={styles.actionText}>
                      {isArabic ? 'الدور' : 'Role'}
                    </Text>
                  </TouchableOpacity>
                )}
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

      {/* البحث */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder={isArabic ? 'بحث بالاسم أو البريد...' : 'Search by name or email...'}
          placeholderTextColor={Colors.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* الفلاتر */}
      <View style={styles.filterRow}>
        {[
          { key: 'all', label: isArabic ? `الكل (${users.length})` : `All (${users.length})` },
          { key: 'pending', label: isArabic ? `انتظار (${pendingCount})` : `Pending (${pendingCount})` },
          { key: 'approved', label: isArabic ? `مقبول (${approvedCount})` : `Approved (${approvedCount})` },
          { key: 'rejected', label: isArabic ? `مرفوض (${rejectedCount})` : `Rejected (${rejectedCount})` },
        ].map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, filter === f.key && styles.filterActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderUser}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchUsers(); }}
            colors={[Colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="people-outline" size={48} color={Colors.border} />
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
  container: { flex: 1, backgroundColor: Colors.background },
  center: {
    flex: 1, justifyContent: 'center',
    alignItems: 'center', backgroundColor: Colors.background,
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', margin: 12, marginBottom: 0,
    paddingHorizontal: 14, borderRadius: 12,
    height: 46, borderWidth: 1, borderColor: Colors.border, gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.textPrimary },
  filterRow: {
    flexDirection: 'row', padding: 12,
    gap: 8, backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  filterBtn: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, backgroundColor: Colors.background,
  },
  filterActive: { backgroundColor: Colors.primary },
  filterText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  filterTextActive: { color: '#FFF' },
  listContent: { padding: 16, paddingBottom: 32 },
  userCard: {
    backgroundColor: '#FFF', borderRadius: 16,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(0,33,71,0.05)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03, shadowRadius: 8, elevation: 2,
  },
  userHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 10,
  },
  userAvatar: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  avatarText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  userInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  youBadge: {
    fontSize: 10, fontWeight: '700', color: Colors.accent,
    backgroundColor: Colors.accent + '20',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  userEmail: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  userId: { fontSize: 12, color: Colors.textSecondary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },
  roleLine: {
    flexDirection: 'row', alignItems: 'center',
    gap: 4, marginBottom: 10,
  },
  roleLabel: { fontSize: 13, color: Colors.textSecondary },
  roleValue: { fontWeight: '700', color: Colors.primary },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10, gap: 4,
  },
  actionText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  emptyWrap: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: Colors.textSecondary },
});
