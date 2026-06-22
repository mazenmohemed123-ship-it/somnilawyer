import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scale, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';

export function LawyerAuth() {
  const nav = useNavigate();
  const toast = useToast();
  const { signInLawyer, signUpLawyer, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = mode === 'login'
        ? await signInLawyer(email, password)
        : await signUpLawyer(email, password, fullName);
      if (res.error) {
        toast(res.error, 'danger');
      } else {
        // Both sign-in and sign-up leave the user authenticated → go straight in.
        if (mode === 'signup') toast('تم إنشاء الحساب بنجاح', 'success');
        nav('/lawyer', { replace: true });
      }
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setGoogleBusy(true);
    try {
      const res = await signInWithGoogle();
      if (res.error) toast(res.error, 'danger');
      else nav('/lawyer', { replace: true });
    } finally {
      setGoogleBusy(false);
    }
  }

  return (
    <div className="center-screen" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div className="card" style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ display: 'inline-flex', width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', background: 'var(--navy)', marginBottom: 10 }}>
            <Scale size={30} color="#fff" />
          </div>
          <h2>{mode === 'login' ? 'دخول المحامي' : 'إنشاء حساب محامٍ'}</h2>
        </div>

        <button className="btn btn-ghost btn-block" onClick={google} disabled={googleBusy} style={{ gap: 10, border: '1px solid var(--border)' }}>
          {googleBusy ? <Loader2 size={18} className="spin" /> : <GoogleIcon />}
          المتابعة باستخدام جوجل
        </button>

        <div className="row" style={{ alignItems: 'center', gap: 10, margin: '14px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span className="muted" style={{ fontSize: 12 }}>أو</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <form className="col" onSubmit={submit}>
          {mode === 'signup' && (
            <div>
              <label className="label">الاسم الكامل</label>
              <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
          )}
          <div>
            <label className="label">البريد الإلكتروني</label>
            <input className="input" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">كلمة المرور</label>
            <input className="input" type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          <button className="btn btn-primary btn-block" disabled={busy} style={{ marginTop: 4 }}>
            {busy ? <Loader2 size={18} className="spin" /> : <ArrowRight size={18} />}
            {mode === 'login' ? 'دخول' : 'إنشاء الحساب'}
          </button>
        </form>

        <div className="hr" />
        <button className="btn btn-ghost btn-block" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'ليس لديك حساب؟ أنشئ حساباً' : 'لديك حساب؟ سجّل الدخول'}
        </button>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5h-1.9V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.6 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.6 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 43.5c5.5 0 10.3-1.9 13.9-5.1l-6.4-5.4C29.5 34.5 26.9 35.5 24 35.5c-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39 16.2 43.5 24 43.5z" />
      <path fill="#1976D2" d="M43.6 20.5h-1.9V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.4l6.4 5.4C41 35.5 43.5 30.3 43.5 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}
