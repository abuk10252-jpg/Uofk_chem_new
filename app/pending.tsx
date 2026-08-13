import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';

export default function PendingScreen() {
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const isRejected = user?.status === 'rejected';

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshUser();
    } catch (e) {
      console.warn(e);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{isRejected ? '❌' : '⏳'}</Text>
      <Text style={styles.title}>{isRejected ? 'تم رفض الطلب' : 'في انتظار الموافقة'}</Text>
      <Text style={styles.message}>
        {isRejected
          ? 'تم رفض طلب حسابك من قبل الإدارة. تواصل مع الدعم لو تعتقد إن ده خطأ.'
          : 'حسابك في انتظار موافقة الإدارة. اضغط تحديث للتأكد من حالة الطلب.'}
      </Text>

      <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh} disabled={refreshing}>
        {refreshing ? <ActivityIndicator color="#002147" /> : <Text style={styles.refreshText}>تحديث الحالة</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={async () => { await logout(); router.replace('/login'); }}>
        <Text style={styles.logoutText}>تسجيل الخروج</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#002147', justifyContent: 'center', alignItems: 'center', padding: 30 },
  icon: { fontSize: 60, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#FFF', marginBottom: 10 },
  message: { fontSize: 14, color: '#CCC', textAlign: 'center', marginBottom: 30, lineHeight: 22 },
  refreshBtn: { backgroundColor: '#D4AF37', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 40, marginBottom: 14 },
  refreshText: { color: '#002147', fontWeight: '700', fontSize: 15 },
  logoutBtn: { paddingVertical: 10, paddingHorizontal: 20 },
  logoutText: { color: '#CCC', fontSize: 14, textDecorationLine: 'underline' },
});
