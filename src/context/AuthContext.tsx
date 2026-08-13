import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

// role = الصلاحية (student/admin/super_admin)
// status = حالة الموافقة (pending/approved/rejected) - منفصلة عن role
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
  signIn: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  signUp: (email: string, password: string, displayName: string, universityId: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email!,
              role: data.role || 'student',
              status: data.status || 'pending',
              displayName: data.displayName,
              universityId: data.universityId,
            });
          } else {
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email!,
              role: 'student',
              status: 'pending',
            });
          }
        } catch (e) {
          console.warn('Error loading user doc:', e);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function signIn(email: string, password: string) {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { success: true, message: 'تم تسجيل الدخول بنجاح' };
    } catch (e: any) {
      let message = 'حدث خطأ أثناء تسجيل الدخول';
      if (e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found') {
        message = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
      } else if (e.code === 'auth/invalid-email') {
        message = 'البريد الإلكتروني غير صحيح';
      } else if (e.code === 'auth/too-many-requests') {
        message = 'محاولات كتير خطأ، حاول تاني بعد شوية';
      }
      return { success: false, message };
    }
  }

  async function signUp(email: string, password: string, displayName: string, universityId: string) {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'users', cred.user.uid), {
        email,
        displayName,
        universityId,
        role: 'student',
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      return { success: true, message: 'تم إنشاء الحساب بنجاح، في انتظار الموافقة' };
    } catch (e: any) {
      let message = 'حدث خطأ أثناء إنشاء الحساب';
      if (e.code === 'auth/email-already-in-use') {
        message = 'البريد الإلكتروني مستخدم بالفعل';
      } else if (e.code === 'auth/invalid-email') {
        message = 'البريد الإلكتروني غير صحيح';
      } else if (e.code === 'auth/weak-password') {
        message = 'كلمة المرور ضعيفة، لازم تكون 6 أحرف على الأقل';
      }
      return { success: false, message };
    }
  }

  async function logout() {
    await signOut(auth);
  }

  async function refreshUser() {
    if (!auth.currentUser) return;
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUser({
          uid: auth.currentUser.uid,
          email: auth.currentUser.email!,
          role: data.role || 'student',
          status: data.status || 'pending',
          displayName: data.displayName,
          universityId: data.universityId,
        });
      }
    } catch (e) {
      console.warn('refreshUser error:', e);
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
