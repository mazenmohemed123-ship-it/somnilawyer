import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
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
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState>({} as AuthState);

export function useAuth() {
  return useContext(Ctx);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [fbUser, setFbUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string) => {
    const snap = await getDoc(doc(db, 'users', uid));
    setProfile(snap.exists() ? ({ id: uid, ...snap.data() } as Profile) : null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (fbUser?.uid) await loadProfile(fbUser.uid);
  }, [fbUser, loadProfile]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFbUser(user);
      if (user && !user.isAnonymous) {
        await loadProfile(user.uid);
      } else {
        setProfile(null);
      }
      setLoading(false);
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
        : e.message ?? 'خطأ في تسجيل الدخول';
      return { error: msg };
    }
  }, []);

  const signUpLawyer = useCallback(async (email: string, password: string, fullName: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const profileData = {
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
      await setDoc(doc(db, 'users', cred.user.uid), profileData);
      return { error: null };
    } catch (e: any) {
      const msg = e.code === 'auth/email-already-in-use'
        ? 'هذا البريد الإلكتروني مسجّل بالفعل'
        : e.message ?? 'خطأ في إنشاء الحساب';
      return { error: msg };
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
    <Ctx.Provider value={{ session, profile, loading, refreshProfile, signInLawyer, signUpLawyer, signOut }}>
      {children}
    </Ctx.Provider>
  );
}
