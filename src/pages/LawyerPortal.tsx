import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase, Mic, MessageSquare, Users, FolderLock, CalendarClock, Clock,
  CreditCard, Settings as SettingsIcon, UsersRound, LogOut, Scale, Menu, X, Shield,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { canTeamChat, canManageTeam, isAdminEmail, tierLabel, roleLabel } from '@/lib/permissions';
import { AnnouncementBanner } from '@/components/AnnouncementBanner';
import { AssistantFab } from '@/components/AssistantFab';
import { CasesTab } from './lawyer/CasesTab';
import { VoiceTab } from './lawyer/VoiceTab';
import { ClientChatsTab } from './lawyer/ClientChatsTab';
import { TeamChatTab } from './lawyer/TeamChatTab';
import { VaultTab } from './lawyer/VaultTab';
import { AppointmentsTab } from './lawyer/AppointmentsTab';
import { AvailabilityTab } from './lawyer/AvailabilityTab';
import { BillingTab } from './lawyer/BillingTab';
import { SettingsTab } from './lawyer/SettingsTab';
import { TeamTab } from './lawyer/TeamTab';

type TabKey =
  | 'cases' | 'voice' | 'clientchats' | 'teamchat' | 'vault'
  | 'appointments' | 'availability' | 'billing' | 'settings' | 'team';

export function LawyerPortal() {
  const { profile, session, signOut } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<TabKey>('cases');
  const [navOpen, setNavOpen] = useState(false);

  const team = canTeamChat(profile);
  const manageTeam = canManageTeam(profile);
  const admin = profile?.role === 'admin' || isAdminEmail(session?.user.email);

  const items: { key: TabKey; label: string; icon: JSX.Element; show: boolean }[] = [
    { key: 'cases', label: 'القضايا', icon: <Briefcase size={18} />, show: true },
    { key: 'voice', label: 'التسجيل الصوتي', icon: <Mic size={18} />, show: true },
    { key: 'clientchats', label: 'شات الموكلين', icon: <MessageSquare size={18} />, show: true },
    { key: 'teamchat', label: 'شات الفريق', icon: <Users size={18} />, show: team },
    { key: 'vault', label: 'المستندات', icon: <FolderLock size={18} />, show: true },
    { key: 'appointments', label: 'المواعيد', icon: <CalendarClock size={18} />, show: true },
    { key: 'availability', label: 'التوافر', icon: <Clock size={18} />, show: true },
    { key: 'billing', label: 'الفوترة والدفع', icon: <CreditCard size={18} />, show: true },
    { key: 'team', label: 'إدارة الفريق', icon: <UsersRound size={18} />, show: manageTeam },
    { key: 'settings', label: 'الإعدادات', icon: <SettingsIcon size={18} />, show: true },
  ];

  const ownerId = profile?.master_lawyer_id ?? profile?.id ?? '';

  function render() {
    switch (tab) {
      case 'cases': return <CasesTab />;
      case 'voice': return <VoiceTab />;
      case 'clientchats': return <ClientChatsTab />;
      case 'teamchat': return <TeamChatTab />;
      case 'vault': return <VaultTab />;
      case 'appointments': return <AppointmentsTab />;
      case 'availability': return <AvailabilityTab />;
      case 'billing': return <BillingTab />;
      case 'team': return <TeamTab />;
      case 'settings': return <SettingsTab />;
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside
        className="lawyer-nav"
        style={{
          width: 248, background: 'var(--navy)', color: '#fff', flexShrink: 0,
          display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh',
          transform: navOpen ? 'none' : undefined,
        }}
        data-open={navOpen}
      >
        <div className="spread" style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,.1)' }}>
          <div className="row" style={{ gap: 10 }}>
            <Scale size={24} color="var(--gold-bright)" />
            <strong style={{ fontSize: 20, fontFamily: 'var(--font-head)' }}>مُحكَم</strong>
          </div>
          <button className="btn-icon mobile-only" style={{ color: '#fff', borderColor: 'transparent' }} onClick={() => setNavOpen(false)}><X size={18} /></button>
        </div>

        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
          <div style={{ fontWeight: 700 }}>{profile?.full_name ?? 'محامٍ'}</div>
          <div className="row" style={{ gap: 6, marginTop: 4 }}>
            <span className="badge badge-gold">{tierLabel(profile?.tier ?? 'free')}</span>
            <span className="badge" style={{ background: 'rgba(255,255,255,.12)', color: '#fff' }}>{roleLabel(profile?.role ?? 'lawyer')}</span>
          </div>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {items.filter((i) => i.show).map((i) => (
            <button
              key={i.key}
              onClick={() => { setTab(i.key); setNavOpen(false); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px',
                borderRadius: 10, border: 'none', marginBottom: 2, textAlign: 'start',
                background: tab === i.key ? 'rgba(212,175,55,.18)' : 'transparent',
                color: tab === i.key ? 'var(--gold-bright)' : 'rgba(255,255,255,.85)',
                fontWeight: tab === i.key ? 700 : 500, fontSize: 14,
              }}
            >
              {i.icon} {i.label}
            </button>
          ))}
          {admin && (
            <button
              onClick={() => nav('/admin-control-center')}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 10, border: '1px solid rgba(212,175,55,.3)', marginTop: 8, background: 'transparent', color: 'var(--gold-bright)', fontSize: 14 }}
            >
              <Shield size={18} /> لوحة التحكم
            </button>
          )}
        </nav>

        <button
          onClick={async () => { await signOut(); nav('/', { replace: true }); }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 16, border: 'none', background: 'transparent', color: 'rgba(255,255,255,.75)', borderTop: '1px solid rgba(255,255,255,.1)' }}
        >
          <LogOut size={18} /> تسجيل الخروج
        </button>
      </aside>

      {/* Backdrop for mobile nav */}
      {navOpen && <div className="mobile-only" onClick={() => setNavOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 90 }} />}

      {/* Main */}
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="spread mobile-only" style={{ padding: 12, background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 50 }}>
          <button className="btn-icon" onClick={() => setNavOpen(true)}><Menu size={18} /></button>
          <strong className="row" style={{ gap: 6 }}><Scale size={18} color="var(--navy)" /> مُحكَم</strong>
          <span style={{ width: 36 }} />
        </div>
        <AnnouncementBanner audience="lawyers" />
        <div style={{ flex: 1, minHeight: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>{render()}</div>
      </main>

      <AssistantFab profile={profile} />

      <style>{`
        .mobile-only { display: none; }
        @media (max-width: 860px) {
          .lawyer-nav { position: fixed !important; z-index: 100; transition: transform .2s ease; }
          .lawyer-nav[data-open="false"] { transform: translateX(110%); }
          .mobile-only { display: flex; }
        }
      `}</style>
      <input type="hidden" value={ownerId} readOnly />
    </div>
  );
}
