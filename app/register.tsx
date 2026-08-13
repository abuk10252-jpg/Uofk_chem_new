import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { Colors } from '../src/constants/colors';

export default function RegisterScreen() {
  // ملاحظة: مفيش منطق redirect هنا لنفس السبب الموجود في login.tsx -
  // app/_layout.tsx هو المسؤول الوحيد عن التوجيه بعد إنشاء الحساب.
  const { signUp } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function validateInputs(): string | null {
    if (!name.trim()) return 'أدخل الاسم الكامل';
    if (!email.trim()) return 'أدخل البريد الإلكتروني';
    if (!email.includes('@')) return 'البريد الإلكتروني غير صحيح';
    if (!universityId.trim()) return 'أدخل الرقم الجامعي';
    if (!password) return 'أدخل كلمة المرور';
    if (password.length < 6) return 'كلمة المرور 6 أحرف على الأقل';
    return null;
  }

  async function handleRegister() {
    const validationError = validateInputs();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');

    const result = await signUp(
      email.trim().toLowerCase(),
      password,
      name.trim(),
      universityId.trim()
    );
    setLoading(false);

    if (!result.success) {
      setError(result.message);
      return;
    }
    // النجاح: المستخدم بيتسجل بحالة "pending" تلقائياً، و _layout.tsx
    // هيوجهه لشاشة الانتظار (pending) لوحده.
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
            <Ionicons name="flask" size={40} color={Colors.accent} />
          </View>
          <Text style={styles.appName}>UofK Chem</Text>
          <Text style={styles.subtitle}>Create your account / إنشاء حساب</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Register / تسجيل</Text>

          {error ? (
            <View style={styles.errBox}>
              <Ionicons name="alert-circle" size={16} color={Colors.error} />
              <Text style={styles.errText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.inputWrap}>
            <Ionicons name="person-outline" size={20} color={Colors.textSecondary} />
            <TextInput
              testID="register-name-input"
              style={styles.input}
              placeholder="Full Name / الاسم الكامل"
              placeholderTextColor={Colors.textSecondary}
              value={name}
              onChangeText={(t) => { setName(t); setError(''); }}
              editable={!loading}
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={20} color={Colors.textSecondary} />
            <TextInput
              testID="register-email-input"
              style={styles.input}
              placeholder="University Email / البريد الجامعي"
              placeholderTextColor={Colors.textSecondary}
              value={email}
              onChangeText={(t) => { setEmail(t); setError(''); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          <View style={styles.inputWrap}>
            <Ionicons name="card-outline" size={20} color={Colors.textSecondary} />
            <TextInput
              testID="register-uid-input"
              style={styles.input}
              placeholder="University ID / الرقم الجامعي"
              placeholderTextColor={Colors.textSecondary}
              value={universityId}
              onChangeText={(t) => { setUniversityId(t); setError(''); }}
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} />
            <TextInput
              testID="register-password-input"
              style={styles.input}
              placeholder="Password / كلمة المرور"
              placeholderTextColor={Colors.textSecondary}
              value={password}
              onChangeText={(t) => { setPassword(t); setError(''); }}
              secureTextEntry
              editable={!loading}
              onSubmitEditing={handleRegister}
              returnKeyType="done"
            />
          </View>

          <TouchableOpacity
            testID="register-submit-button"
            style={[styles.btn, loading && { opacity: 0.7 }]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Create Account / إنشاء حساب</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            testID="go-to-login"
            style={styles.link}
            onPress={() => router.push('/login')}
            disabled={loading}
          >
            <Text style={styles.linkText}>
              Already have an account?{' '}
              <Text style={styles.linkBold}>Sign In / دخول</Text>
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
  header: { alignItems: 'center', marginBottom: 24 },
  logo: {
    width: 64, height: 64, borderRadius: 16,
    backgroundColor: 'rgba(212,175,55,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  appName: { fontSize: 28, fontWeight: '800', color: '#FFF' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  card: {
    backgroundColor: '#FFF', borderRadius: 24, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1, shadowRadius: 24, elevation: 8,
  },
  cardTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: 20 },
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
    marginBottom: 14, height: 56, gap: 12,
  },
  input: { flex: 1, fontSize: 16, color: Colors.textPrimary },
  btn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  link: { alignItems: 'center', marginTop: 20 },
  linkText: { fontSize: 14, color: Colors.textSecondary },
  linkBold: { color: Colors.accent, fontWeight: '700' },
});
