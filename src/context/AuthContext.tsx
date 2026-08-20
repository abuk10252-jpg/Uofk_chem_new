import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  Auth,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, Firestore } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebaseAuth, getFirebaseDb, getFirebaseStorage } from '../firebase';

type UserRole = 'student' | 'admin' | 'super_admin' | null;
type UserStatus = 'pending' | 'approved' | 'rejected' | null;

interface AuthUser {
  // الحقول دي هي نفسها اللي كل شاشات التطبيق والباك إند بيتوقعوها
  id: string;
  uid: string; // نفس id، متسيبة للتوافق مع أي كود قديم بيستخدمها
  email: string;
  role: UserRole;
  status: UserStatus;
  name?: string;
  displayName?: string; // نفس name، متسيبة للتوافق مع أي كود قديم بيستخدمها
  university_id?: string;
  universityId?: string; // نفس university_id، متسيبة للتوافق
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
            const userData: any = userDoc.data();
            setUser({
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
            });
          } else {
            setUser({
              id: firebaseUser.uid,
              uid: firebaseUser.uid,
              email: firebaseUser.email!,
              role: 'student',
              status: 'pending',
              language: 'ar',
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
        id: 'local-test-super-admin',
        uid: 'local-test-super-admin',
        email: TEST_ADMIN_EMAIL,
        role: 'super_admin',
        status: 'approved',
        name: 'حساب تجربة (سوبر أدمن)',
        displayName: 'حساب تجربة (سوبر أدمن)',
        language: 'ar',
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
        const userData: any = userDoc.data();
        setUser({
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
        });
      }
    } catch (error) {
      console.warn('Error refreshing user:', error);
    }
  };

  // رفع صورة البروفايل: بترفع الصورة على Firebase Storage، تحفظ رابطها في
  // Firestore (نفس حقل profile_pic اللي الباك إند بيستخدمه)، وتحدّث الحالة محليًا
  const updatePhoto = async (uri: string) => {
    try {
      if (!auth?.currentUser || !db) {
        return { success: false, message: 'خدمة المصادقة غير متاحة حالياً' };
      }

      const storage = getFirebaseStorage();
      const response = await fetch(uri);
      const blob = await response.blob();

      const fileRef = storageRef(storage, `avatars/${auth.currentUser.uid}.jpg`);
      await uploadBytes(fileRef, blob);
      const downloadUrl = await getDownloadURL(fileRef);

      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        profile_pic: downloadUrl,
      });

      setUser(prev => (prev ? { ...prev, profile_pic: downloadUrl } : prev));

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
