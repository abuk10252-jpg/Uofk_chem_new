import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';

// شاشة مؤقتة بس - هتتستبدل بالتبويبات الحقيقية (أخبار/مقررات/بروفايل) في المرحلة 3
export default function HomeScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>أهلاً {user?.displayName || ''} 👋</Text>
      <Text style={styles.subtitle}>الدور: {user?.role}</Text>
      <Text style={styles.success}>تسجيل الدخول شغال ✅ (المرحلة 2)</Text>

      <TouchableOpacity style={styles.logoutBtn} onPress={async () => { await logout(); router.replace('/login'); }}>
        <Text style={styles.logoutText}>تسجيل الخروج</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#002147', justifyContent: 'center', alignItems: 'center', padding: 30 },
  title: { fontSize: 22, fontWeight: '800', color: '#FFF', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#D4AF37', marginBottom: 20 },
  success: { fontSize: 14, color: '#4ADE80', marginBottom: 30 },
  logoutBtn: { backgroundColor: '#D4AF37', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 30 },
  logoutText: { color: '#002147', fontWeight: '700' },
});
