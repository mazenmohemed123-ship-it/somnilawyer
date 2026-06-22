import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scale, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';

export function LawyerAuth() {
  const nav = useNavigate();
  const toast = useToast();
  const { signInLawyer, signUpLawyer } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = mode === 'login'
        ? await signInLawyer(email, password)
        : await signUpLawyer(email, password, fullName);
      if (res.error) {
        toast(res.error, 'danger');
      } else if (mode === 'signup') {
        toast('تم إنشاء الحساب. تحقق من بريدك إن لزم ثم سجّل الدخول.', 'success');
        setMode('login');
      } else {
        nav('/lawyer', { replace: true });
      }
    } finally {
      setBusy(false);
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
