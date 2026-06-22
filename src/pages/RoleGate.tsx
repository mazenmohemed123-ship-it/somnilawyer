import { useNavigate } from 'react-router-dom';
import { Scale, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { isLawyerSide } from '@/lib/permissions';
import { useEffect } from 'react';

// Landing screen. Only a single "Lawyer Login" entry — clients enter via the office link only.
export function RoleGate() {
  const nav = useNavigate();
  const { session, profile } = useAuth();

  useEffect(() => {
    if (session && profile && isLawyerSide(profile.role)) nav('/lawyer', { replace: true });
  }, [session, profile, nav]);

  return (
    <div className="center-screen" style={{ minHeight: '100vh', background: 'linear-gradient(160deg, var(--navy) 0%, var(--navy-900) 100%)' }}>
      <div style={{ width: '100%', maxWidth: 440, textAlign: 'center', color: '#fff' }}>
        <div style={{ display: 'inline-flex', width: 84, height: 84, borderRadius: 22, alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.18)', marginBottom: 18 }}>
          <Scale size={40} color="#fff" />
        </div>
        <h1 style={{ fontSize: 38, color: '#fff', marginBottom: 6, letterSpacing: '.5px' }}>Somni Lawyer</h1>
        <p style={{ color: 'rgba(255,255,255,.72)', marginBottom: 34 }}>منصة إدارة القضايا والتواصل بين المحامي والموكل</p>

        <button
          className="btn btn-block"
          style={{ padding: '14px', fontSize: 16, background: '#fff', color: 'var(--navy)', fontWeight: 700 }}
          onClick={() => nav('/lawyer/auth')}
        >
          <ShieldCheck size={20} /> دخول المحامي
        </button>

        <p style={{ marginTop: 22, fontSize: 13, color: 'rgba(255,255,255,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <ArrowLeft size={14} /> الموكلون يدخلون عبر «رابط المكتب» الذي يرسله المحامي
        </p>
      </div>
    </div>
  );
}
