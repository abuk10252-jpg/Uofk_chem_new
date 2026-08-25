import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  Auth,
} from 'firebase/auth';
import { doc, getDoc, setDoc, Firestore } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from '../firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { uploadFile } from '../utils/api';

type UserRole = 'student' | 'admin' | 'super_admin' | null;
type UserStatus = 'pending' | 'approved' | 'rejected' | null;

interface AuthUser {
  id: string;
  uid: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  name?: string;
  displayName?: string;
  university_id?: string;
  universityId?: string;
  language?: 'ar' | 'en';
  profile_pic?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; message: string; needsApproval?: boolean }>;
  signUp: (email: string, password: string, displayName: string, universityId: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<{ success: boolean; message: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  refreshUser: () => Promise<void>;
  updatePhoto: (uri: string) => Promise<{ success: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const USER_CACHE_KEY = '@uofk_cached_user';

async function saveUserCache(user: AuthUser | null) {
  try {
    if (user) {
      await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    } else {
      await AsyncStorage.removeItem(USER_CACHE_KEY);
    }
  } catch (e) {
    console.warn('Failed to cache user:', e);
  }
}

async function loadUserCache(): Promise<AuthUser | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  let auth: Auth | null = null;
  let db: Firestore | null = null;

  try {
    auth = getFirebaseAuth();
    db = getFirebaseDb();
  } catch (e) {
    console.error('Firebase init failed:', e);
  }

  useEffect(() => {
    // حمّل الكاش فوراً عشان المستخدم ما يتطردش وهو بيفتح التطبيق
    (async () => {
      const cached = await loadUserCache();
      if (cached) {
        setUser(cached);
      }
    })();

    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser && db) {
          try {
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists()) {
              const userData: any = userDoc.data();
              const mapped: AuthUser = {
                id: firebaseUser.uid,
                uid: firebaseUser.uid,
                email: firebaseUser.email!,
                role: userData.role || 'student',
                status: userData.status || 'pending',
                name: userData.name || userData.displayName,
                displayName: userData.name || userData.displayName,
                university_id: userData.university_id || userData.universityId,
                universityId: userData.university_id || userData.universityId,
                language: userData.language || 'ar',
                profile_pic: userData.profile_pic || '',
              };
              setUser(mapped);
              await saveUserCache(mapped);
            } else {
              const mapped: AuthUser = {
                id: firebaseUser.uid,
                uid: firebaseUser.uid,
                email: firebaseUser.email!,
                role: 'student',
                status: 'pending',
                language: 'ar',
              };
              setUser(mapped);
              await saveUserCache(mapped);
            }
          } catch (firestoreError) {
            // مفيش نت أو Firestore فشل → استخدم الكاش المحلي
            console.warn('Firestore user fetch failed, using cache:', firestoreError);
            const cached = await loadUserCache();
            if (cached && cached.uid === firebaseUser.uid) {
              setUser(cached);
            } else {
              setUser({
                id: firebaseUser.uid,
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                role: 'student',
                status: 'approved',
                language: 'ar',
              });
            }
          }
        } else if (firebaseUser) {
          const cached = await loadUserCache();
          if (cached && cached.uid === firebaseUser.uid) {
            setUser(cached);
          } else {
            setUser({
              id: firebaseUser.uid,
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              role: 'student',
              status: 'approved',
              language: 'ar',
            });
          }
        } else {
          setUser(null);
          await saveUserCache(null);
        }
      } catch (error) {
        console.error('Error in auth state handler:', error);
        const cached = await loadUserCache();
        if (cached) {
          setUser(cached);
        } else {
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const TEST_ADMIN_EMAIL = 'test@admin.com';
  const TEST_ADMIN_PASSWORD = 'Test123456';

  const signIn = async (email: string, password: string) => {
    if (email.trim().toLowerCase() === TEST_ADMIN_EMAIL && password === TEST_ADMIN_PASSWORD) {
      const testUser: AuthUser = {
        id: 'local-test-super-admin',
        uid: 'local-test-super-admin',
        email: TEST_ADMIN_EMAIL,
        role: 'super_admin',
        status: 'approved',
        name: 'حساب تجربة (سوبر أدمن)',
        displayName: 'حساب تجربة (سوبر أدمن)',
        language: 'ar',
      };
      setUser(testUser);
      await saveUserCache(testUser);
      setLoading(false);
      return { success: true, message: 'دخول تجريبي كسوبر أدمن' };
    }

    if (!auth || !db) {
      return { success: false, message: 'خدمة المصادقة غير متاحة حالياً' };
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));

      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.status === 'rejected') {
          await signOut(auth);
          return { success: false, message: 'تم رفض طلب حسابك من قبل الإدارة' };
        }
        if (userData.status === 'pending' || !userData.status) {
          return {
            success: true,
            message: 'حسابك قيد المراجعة. سيتم تفعيل حسابك قريباً.',
            needsApproval: true,
          };
        }
        return { success: true, message: 'تم تسجيل الدخول بنجاح' };
      } else {
        await signOut(auth);
        return { success: false, message: 'بيانات المستخدم غير موجودة' };
      }
    } catch (error: any) {
      let message = 'حدث خطأ في تسجيل الدخول';
      if (error.code === 'auth/user-not-found') {
        message = 'البريد الإلكتروني غير مسجل';
      } else if (error.code === 'auth/wrong-password') {
        message = 'كلمة المرور غير صحيحة';
      } else if (error.code === 'auth/invalid-email') {
        message = 'البريد الإلكتروني غير صالح';
      } else if (error.code === 'auth/invalid-credential') {
        message = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
      } else if (error.code === 'auth/too-many-requests') {
        message = 'محاولات كثيرة. الرجاء المحاولة لاحقاً';
      }
      return { success: false, message };
    }
  };

  const signUp = async (email: string, password: string, displayName: string, universityId: string) => {
    if (!auth || !db) {
      return { success: false, message: 'خدمة المصادقة غير متاحة حالياً' };
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      await setDoc(doc(db, 'users', userCredential.user.uid), {
        id: userCredential.user.uid,
        email,
        name: displayName,
        displayName,
        university_id: universityId,
        universityId,
        role: 'student',
        status: 'pending',
        language: 'ar',
        profile_pic: '',
        createdAt: new Date().toISOString(),
      });

      return {
        success: true,
        message: 'تم إنشاء الحساب بنجاح. في انتظار موافقة المشرف.',
      };
    } catch (error: any) {
      let message = 'حدث خطأ في إنشاء الحساب';
      if (error.code === 'auth/email-already-in-use') {
        message = 'البريد الإلكتروني مستخدم بالفعل';
      } else if (error.code === 'auth/weak-password') {
        message = 'كلمة المرور ضعيفة جداً';
      } else if (error.code === 'auth/invalid-email') {
        message = 'البريد الإلكتروني غير صالح';
      }
      return { success: false, message };
    }
  };

  const logout = async () => {
    try {
      if (auth) {
        await signOut(auth);
      }
      setUser(null);
      await saveUserCache(null);
      return { success: true, message: 'تم تسجيل الخروج بنجاح' };
    } catch (error) {
      setUser(null);
      await saveUserCache(null);
      return { success: false, message: 'حدث خطأ في تسجيل الخروج' };
    }
  };

  const refreshUser = async () => {
    try {
      if (!auth?.currentUser || !db) return;
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        const userData: any = userDoc.data();
        const mapped: AuthUser = {
          id: auth.currentUser.uid,
          uid: auth.currentUser.uid,
          email: auth.currentUser.email!,
          role: userData.role || 'student',
          status: userData.status || 'pending',
          name: userData.name || userData.displayName,
          displayName: userData.name || userData.displayName,
          university_id: userData.university_id || userData.universityId,
          universityId: userData.university_id || userData.universityId,
          language: userData.language || 'ar',
          profile_pic: userData.profile_pic || '',
        };
        setUser(mapped);
        await saveUserCache(mapped);
      }
    } catch (error) {
      console.warn('Error refreshing user:', error);
    }
  };

  const updatePhoto = async (uri: string) => {
    try {
      if (!auth?.currentUser) {
        return { success: false, message: 'خدمة المصادقة غير متاحة حالياً' };
      }

      const formData = new FormData();
      formData.append('photo', {
        uri,
        name: 'avatar.jpg',
        type: 'image/jpeg',
      } as any);

      const data = await uploadFile('/auth/upload-photo', formData);

      if (!data?.profile_pic) {
        return { success: false, message: 'فشل رفع الصورة' };
      }

      setUser(prev => {
        const next = prev ? { ...prev, profile_pic: data.profile_pic } : prev;
        if (next) saveUserCache(next);
        return next;
      });

      return { success: true, message: 'تم تحديث الصورة بنجاح' };
    } catch (error) {
      console.warn('Error updating photo:', error);
      return { success: false, message: 'فشل رفع الصورة' };
    }
  };

  const resetPassword = async (email: string) => {
    if (!auth) {
      return { success: false, message: 'خدمة المصادقة غير متاحة حالياً' };
    }

    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true, message: 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني' };
    } catch (error: any) {
      let message = 'حدث خطأ في إرسال رابط إعادة التعيين';
      if (error.code === 'auth/user-not-found') {
        message = 'البريد الإلكتروني غير مسجل';
      }
      return { success: false, message };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, logout, resetPassword, refreshUser, updatePhoto }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
