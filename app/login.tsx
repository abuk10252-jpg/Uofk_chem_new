import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError('رجاءً أدخل البريد وكلمة المرور');
      return;
    }
    setLoading(true);
    setError('');
    const result = await signIn(email.trim().toLowerCase(), password);
    setLoading(false);
    if (!result.success) {
      setError(result.message);
    }
    // النجاح: app/_layout.tsx بيراقب حالة user ويوجه المستخدم لوحده
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.appName}>UofK Chem</Text>
        <Text style={styles.subtitle}>تسجيل الدخول</Text>

        <View style={styles.card}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TextInput
            style={styles.input}
            placeholder="البريد الإلكتروني"
            placeholderTextColor="#888"
            value={email}
            onChangeText={t => { setEmail(t); setError(''); }}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="كلمة المرور"
            placeholderTextColor="#888"
            value={password}
            onChangeText={t => { setPassword(t); setError(''); }}
            secureTextEntry
            editable={!loading}
            onSubmitEditing={handleLogin}
          />

          <TouchableOpacity style={[styles.btn, loading && { opacity: 0.7 }]} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>دخول</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.link} onPress={() => router.push('/register')} disabled={loading}>
            <Text style={styles.linkText}>مفيش حساب؟ <Text style={styles.linkBold}>سجل دلوقتي</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#002147' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  appName: { fontSize: 32, fontWeight: '800', color: '#FFF', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 15, color: '#D4AF37', textAlign: 'center', marginBottom: 28 },
  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 22 },
  error: { color: '#DC2626', backgroundColor: '#FEE2E2', padding: 10, borderRadius: 8, marginBottom: 14, textAlign: 'center' },
  input: {
    backgroundColor: '#F5F5F5', borderRadius: 10, paddingHorizontal: 16,
    height: 50, fontSize: 15, marginBottom: 12, color: '#111',
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  btn: { backgroundColor: '#002147', borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 6 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  link: { alignItems: 'center', marginTop: 18 },
  linkText: { color: '#555', fontSize: 14 },
  linkBold: { color: '#002147', fontWeight: '700' },
});
