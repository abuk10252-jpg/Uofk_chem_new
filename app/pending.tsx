import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { Colors } from '../src/constants/colors';

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
      console.warn('refreshUser error:', e);
    } finally {
      setRefreshing(false);
    }
  }

  // ملاحظة: مفيش داعي لـ redirect هنا لو الحالة اتغيّرت - app/_layout.tsx
  // بيراقب user.status تلقائياً وهيوجّه المستخدم لوحده أول ما يتغيّر لـ approved.

  return (
    <View style={styles.container} testID="pending-screen">
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons
            name={isRejected ? 'close-circle-outline' : 'hourglass-outline'}
            size={64}
            color={isRejected ? Colors.error : Colors.accent}
          />
        </View>
        {isRejected ? (
          <>
            <Text style={styles.title}>Request Rejected</Text>
            <Text style={styles.titleAr}>تم رفض الطلب</Text>
            <Text style={styles.message}>Your account request was rejected by the administration. Please contact support if you believe this is a mistake.</Text>
            <Text style={styles.messageAr}>تم رفض طلب حسابك من قبل الإدارة. تواصل مع الدعم لو تعتقد إن ده خطأ.</Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>Pending Approval</Text>
            <Text style={styles.titleAr}>في انتظار الموافقة</Text>
            <Text style={styles.message}>Your account is awaiting admin approval. You will be notified once your account is activated.</Text>
            <Text style={styles.messageAr}>حسابك في انتظار موافقة الإدارة. سيتم إبلاغك عند تفعيل حسابك.</Text>
          </>
        )}
        <TouchableOpacity testID="refresh-status-btn" style={styles.refreshBtn} onPress={handleRefresh} disabled={refreshing}>
          {refreshing ? <ActivityIndicator color={Colors.primary} /> : (
            <><Ionicons name="refresh-outline" size={20} color={Colors.primary} /><Text style={styles.refreshText}>  Check Status / تحديث</Text></>
          )}
        </TouchableOpacity>
        <TouchableOpacity testID="pending-logout-btn" style={styles.logoutBtn} onPress={async () => { await logout(); router.replace('/login'); }}>
          <Ionicons name="log-out-outline" size={20} color="#FFF" />
          <Text style={styles.logoutText}>  Logout / خروج</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', padding: 24 },
  content: { backgroundColor: '#FFF', borderRadius: 24, padding: 32, alignItems: 'center', width: '100%', maxWidth: 400, shadowColor: '#000', shadowOffset: {width:0,height:8}, shadowOpacity: 0.1, shadowRadius: 24, elevation: 8 },
  iconWrap: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(212,175,55,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  titleAr: { fontSize: 20, fontWeight: '700', color: Colors.textSecondary, marginBottom: 16 },
  message: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 4 },
  messageAr: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24, marginBottom: 12, width: '100%', justifyContent: 'center' },
  refreshText: { fontSize: 16, fontWeight: '600', color: Colors.primary },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.error, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24, width: '100%', justifyContent: 'center' },
  logoutText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
});
