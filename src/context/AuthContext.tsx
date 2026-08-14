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

type UserRole = 'student' | 'admin' | 'super_admin' | null;
type UserStatus = 'pending' | 'approved' | 'rejected' | null;

interface AuthUser {
  uid: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  displayName?: string;
  universityId?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; message: string; needsApproval?: boolean }>;
  signUp: (email: string, password: string, displayName: string, universityId: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<{ success: boolean; message: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

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
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser && db) {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email!,
              role: userData.role || 'student',
              status: userData.status || 'pending',
              displayName: userData.displayName,
              universityId: userData.universityId,
            });
          } else {
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email!,
              role: 'student',
              status: 'pending',
            });
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        setUser(null);
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
      setUser({
        uid: 'local-test-super-admin',
        email: TEST_ADMIN_EMAIL,
        role: 'super_admin',
        status: 'approved',
        displayName: 'حساب تجربة (سوبر أدمن)',
      });
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
        email,
        displayName,
        universityId,
        role: 'student',
        status: 'pending',
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
      return { success: true, message: 'تم تسجيل الخروج بنجاح' };
    } catch (error) {
      setUser(null);
      return { success: false, message: 'حدث خطأ في تسجيل الخروج' };
    }
  };

  const refreshUser = async () => {
    try {
      if (!auth?.currentUser || !db) return;
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUser({
          uid: auth.currentUser.uid,
          email: auth.currentUser.email!,
          role: userData.role || 'student',
          status: userData.status || 'pending',
          displayName: userData.displayName,
          universityId: userData.universityId,
        });
      }
    } catch (error) {
      console.warn('Error refreshing user:', error);
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
    <AuthContext.Provider value={{ user, loading, signIn, signUp, logout, resetPassword, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
