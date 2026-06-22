import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from './lib/auth';
import { isLawyerSide, isAdminEmail } from './lib/permissions';
import { RoleGate } from './pages/RoleGate';
import { LawyerAuth } from './pages/LawyerAuth';
import { LawyerPortal } from './pages/LawyerPortal';
import { ClientPortal } from './pages/ClientPortal';
import { AdminControlCenter } from './pages/AdminControlCenter';
import { InstallPrompt } from './components/InstallPrompt';

function FullLoader() {
  return (
    <div className="center-screen" style={{ minHeight: '100vh' }}>
      <Loader2 className="spin" size={32} color="var(--navy)" />
    </div>
  );
}

export default function App() {
  const { loading } = useAuth();
  if (loading) return <FullLoader />;

  return (
    <>
      <Routes>
        <Route path="/" element={<RoleGate />} />
        <Route path="/lawyer/auth" element={<LawyerAuth />} />
        <Route path="/lawyer" element={<RequireLawyer><LawyerPortal /></RequireLawyer>} />
        <Route path="/portal/lawyer/:lawyerId" element={<ClientPortal />} />
        <Route path="/admin-control-center" element={<RequireAdmin><AdminControlCenter /></RequireAdmin>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <InstallPrompt />
    </>
  );
}

function RequireLawyer({ children }: { children: JSX.Element }) {
  const { session, profile } = useAuth();
  if (!session) return <Navigate to="/lawyer/auth" replace />;
  if (profile && !isLawyerSide(profile.role) && profile.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return children;
}

function RequireAdmin({ children }: { children: JSX.Element }) {
  const { session, profile } = useAuth();
  if (!session) return <Navigate to="/lawyer/auth" replace />;
  const ok = profile?.role === 'admin' || isAdminEmail(session.user.email);
  if (!ok) return <Navigate to="/" replace />;
  return children;
}
