import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as fbSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { isAdminEmail } from '@/lib/permissions';
import type { Profile } from '@/types';

// Compat session — keeps the same shape that all pages expect.
interface CompatSession {
  user: { id: string; email: string | null };
}

interface AuthState {
  session: CompatSession | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signInLawyer: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpLawyer: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState>({} as AuthState);

export function useAuth() {
  return useContext(Ctx);
}

// Reject a hanging promise after `ms` so the UI never freezes forever
// (e.g. when Firestore is unreachable / not yet enabled in the console).
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`__timeout__:${label}`)), ms)
    ),
  ]);
}

// Build a default profile object for a freshly-registered user.
function buildProfile(email: string | null, fullName: string): Omit<Profile, 'id'> {
  return {
    role: 'owner',
    tier: 'free',
    full_name: fullName,
    avatar_url: null,
    bio: null,
    phone: null,
    email,
    language: 'ar',
    currency: 'EGP',
    master_lawyer_id: null,
    can_view_billing: false,
    can_manage_appointments: false,
    can_edit_documents: false,
    can_reply_client_chats: false,
    fcm_token: null,
    emergency_enabled: true,
    tier_expires_at: null,
    vodafone_cash: null,
    instapay: null,
    bank_account: null,
    payment_qr_url: null,
    created_at: new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [fbUser, setFbUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string) => {
    try {
      const snap = await withTimeout(getDoc(doc(db, 'users', uid)), 12000, 'loadProfile');
      setProfile(snap.exists() ? ({ id: uid, ...snap.data() } as Profile) : null);
    } catch (e) {
      // Firestore unreachable / rules issue — don't freeze the app.
      console.error('loadProfile failed:', e);
      setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (fbUser?.uid) await loadProfile(fbUser.uid);
  }, [fbUser, loadProfile]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFbUser(user);
      try {
        if (user && !user.isAnonymous) {
          await loadProfile(user.uid);
        } else {
          setProfile(null);
        }
      } finally {
        // Always release the app loader, even if profile load failed.
        setLoading(false);
      }
    });
    return unsub;
  }, [loadProfile]);

  const signInLawyer = useCallback(async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { error: null };
    } catch (e: any) {
      const msg = e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password'
        ? 'بريد إلكتروني أو كلمة مرور غير صحيحة'
        : authErrorMessage(e);
      return { error: msg };
    }
  }, []);

  const signUpLawyer = useCallback(async (email: string, password: string, fullName: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const profileData = buildProfile(email, fullName);
      // Timeout so a misconfigured/unreachable Firestore surfaces a clear
      // error instead of an endless spinner.
      await withTimeout(setDoc(doc(db, 'users', cred.user.uid), profileData), 12000, 'setDoc');
      setProfile({ id: cred.user.uid, ...profileData });
      return { error: null };
    } catch (e: any) {
      if (typeof e.message === 'string' && e.message.startsWith('__timeout__')) {
        return {
          error: 'تم إنشاء الحساب لكن تعذّر حفظ الملف الشخصي. تأكد من تفعيل قاعدة بيانات Firestore في مشروع Firebase ثم سجّل الدخول.',
        };
      }
      const msg = e.code === 'auth/email-already-in-use'
        ? 'هذا البريد الإلكتروني مسجّل بالفعل'
        : authErrorMessage(e);
      return { error: msg };
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const ref = doc(db, 'users', cred.user.uid);
      const snap = await withTimeout(getDoc(ref), 12000, 'googleProfile');
      if (!snap.exists()) {
        const profileData = buildProfile(cred.user.email, cred.user.displayName ?? 'محامٍ');
        await withTimeout(setDoc(ref, profileData), 12000, 'googleSetDoc');
        setProfile({ id: cred.user.uid, ...profileData });
      } else {
        setProfile({ id: cred.user.uid, ...snap.data() } as Profile);
      }
      return { error: null };
    } catch (e: any) {
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
        return { error: null };
      }
      if (typeof e.message === 'string' && e.message.startsWith('__timeout__')) {
        return { error: 'تعذّر الاتصال بقاعدة البيانات. تأكد من تفعيل Firestore في مشروع Firebase.' };
      }
      return { error: authErrorMessage(e) };
    }
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(auth);
    setFbUser(null);
    setProfile(null);
  }, []);

  const session: CompatSession | null = fbUser && !fbUser.isAnonymous
    ? { user: { id: fbUser.uid, email: fbUser.email } }
    : null;

  return (
    <Ctx.Provider value={{ session, profile, loading, refreshProfile, signInLawyer, signUpLawyer, signInWithGoogle, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

// Friendlier Arabic messages for the most common Firebase Auth errors.
function authErrorMessage(e: any): string {
  switch (e?.code) {
    case 'auth/operation-not-allowed':
      return 'طريقة تسجيل الدخول غير مفعّلة. فعّل البريد/كلمة المرور (أو جوجل) من Firebase → Authentication.';
    case 'auth/unauthorized-domain':
      return 'هذا النطاق غير مُصرّح به. أضِفه في Firebase → Authentication → Settings → Authorized domains.';
    case 'auth/network-request-failed':
      return 'فشل الاتصال بالشبكة. تحقّق من الإنترنت وحاول مجدداً.';
    case 'auth/weak-password':
      return 'كلمة المرور ضعيفة (6 أحرف على الأقل).';
    case 'auth/invalid-email':
      return 'صيغة البريد الإلكتروني غير صحيحة.';
    default:
      return e?.message ?? 'حدث خطأ غير متوقع.';
  }
}

export { isAdminEmail };
