import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { Colors } from '../src/constants/colors';

export default function LoginScreen() {
  // ملاحظة: مفيش منطق redirect هنا. app/_layout.tsx (RootLayoutNav) هو المسؤول
  // الوحيد عن التوجيه بعد تسجيل الدخول حسب دور المستخدم (role). وجود نسختين
  // من نفس المنطق كان بيسبب تعارض.
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError('رجاءً أدخل البريد وكلمة المرور');
      return;
    }
    if (!email.includes('@')) {
      setError('البريد الإلكتروني غير صحيح');
      return;
    }

    setLoading(true);
    setError('');

    const result = await signIn(email.trim().toLowerCase(), password);
    setLoading(false);

    if (!result.success) {
      setError(result.message);
      return;
    }
    // النجاح: onAuthStateChanged هيحدّث user تلقائياً، و _layout.tsx هيوجّه
    // المستخدم للشاشة الصح (pending / admin / super-admin / academic).
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.logo}>
            <Ionicons name="flask" size={48} color={Colors.accent} />
          </View>
          <Text style={styles.appName}>UofK Chem</Text>
          <Text style={styles.subtitle}>Chemical Engineering Platform</Text>
          <Text style={styles.subtitleAr}>منصة الهندسة الكيميائية</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In / تسجيل الدخول</Text>

          {error ? (
            <View style={styles.errBox}>
              <Ionicons name="alert-circle" size={16} color={Colors.error} />
              <Text style={styles.errText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={20} color={Colors.textSecondary} />
            <TextInput
              style={styles.input}
              placeholder="University Email"
              placeholderTextColor={Colors.textSecondary}
              value={email}
              onChangeText={(t) => { setEmail(t); setError(''); }}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Password"
              placeholderTextColor={Colors.textSecondary}
              value={password}
              onChangeText={(t) => { setPassword(t); setError(''); }}
              secureTextEntry={!showPw}
              editable={!loading}
              onSubmitEditing={handleLogin}
              returnKeyType="done"
            />
            <TouchableOpacity onPress={() => setShowPw(!showPw)} disabled={loading}>
              <Ionicons
                name={showPw ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={Colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Sign In / دخول</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.link}
            onPress={() => router.push('/register')}
            disabled={loading}
          >
            <Text style={styles.linkText}>
              Don't have an account?{' '}
              <Text style={styles.linkBold}>Register</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: {
    width: 80, height: 80, borderRadius: 20,
    backgroundColor: 'rgba(212,175,55,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  appName: { fontSize: 32, fontWeight: '800', color: '#FFF' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  subtitleAr: { fontSize: 14, color: 'rgba(255,255,255,0.5)' },
  card: { backgroundColor: '#FFF', borderRadius: 24, padding: 24 },
  cardTitle: { fontSize: 20, fontWeight: '700', marginBottom: 20 },
  errBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FEE2E2', padding: 12,
    borderRadius: 12, marginBottom: 16,
  },
  errText: { color: Colors.error, marginLeft: 8, fontSize: 14, flex: 1 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 16,
    marginBottom: 16, height: 56,
  },
  input: { flex: 1, fontSize: 16, color: Colors.textPrimary, marginLeft: 8 },
  btn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
  },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  link: { alignItems: 'center', marginTop: 20 },
  linkText: { fontSize: 14, color: Colors.textSecondary },
  linkBold: { color: Colors.accent, fontWeight: '700' },
});
