import { useEffect, useState } from 'react';
import { Loader2, Users, User } from 'lucide-react';
import {
  collection, query, where, orderBy, getDocs, doc, getDoc,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/lib/auth';
import { ChatRoom } from '@/components/chat/ChatRoom';
import { getOrCreateOfficeGroup, getOrCreateDirectConversation } from '@/services/chat';
import { roleLabel, canUploadInChat } from '@/lib/permissions';
import type { Profile } from '@/types';

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`__timeout__:${label}`)), ms)
    ),
  ]);
}

function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 860);
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 860);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return mobile;
}

export function TeamChatTab() {
  const { profile, session } = useAuth();
  const isMobile = useIsMobile();
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [convId, setConvId] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string>('group');
  const [activeTitle, setActiveTitle] = useState('المجموعة');
  const [peerId, setPeerId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  const ownerId = profile?.master_lawyer_id ?? profile?.id ?? '';
  const me = session?.user.id ?? null;

  useEffect(() => {
    if (!ownerId) return;
    (async () => {
      try {
        const snap = await withTimeout(getDocs(query(
          collection(db, 'users'),
          where('master_lawyer_id', '==', ownerId)
        )), 12000, 'loadTeamMembers');
        const team = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Profile));
        const owner = await withTimeout(getDoc(doc(db, 'users', ownerId)), 12000, 'loadOwner');
        const allMembers = owner.exists() ? [{ id: ownerId, ...owner.data() } as Profile, ...team] : team;
        setMembers(allMembers);
      } catch (err) {
        console.error('Failed to load team members:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [ownerId]);

  async function openGroup() {
    if (!me) return;
    setActiveKey('group');
    setActiveTitle('مجموعة المكتب');
    setPeerId(null);
    setConvId(null);
    setMobileView('chat');
    const conv = await getOrCreateOfficeGroup({
      officeId: ownerId,
      me,
      members: members.map((m) => m.id),
      title: 'مجموعة المكتب',
    });
    setConvId(conv.id);
  }

  async function openDirect(other: Profile) {
    if (!me) return;
    setActiveKey(other.id);
    setActiveTitle(other.full_name || 'عضو');
    setPeerId(other.id);
    setConvId(null);
    setMobileView('chat');
    const conv = await getOrCreateDirectConversation({ me, other: other.id, title: other.full_name });
    setConvId(conv.id);
  }

  useEffect(() => {
    if (me && members.length && activeKey === 'group' && !convId && !isMobile) openGroup();
    // eslint-disable-next-line
  }, [me, members.length]);

  const listPanel = (
    <div style={{ width: isMobile ? '100%' : 280, borderInlineEnd: isMobile ? 'none' : '1px solid var(--border)', overflowY: 'auto', background: 'var(--surface)', flexShrink: 0, height: '100%' }}>
      <div style={{ padding: 14, borderBottom: '1px solid var(--border)' }}><h3 style={{ margin: 0 }}>شات الفريق</h3></div>
      <button onClick={openGroup} style={item(activeKey === 'group')}>
        <Users size={18} color="var(--navy)" />
        <div><div style={{ fontWeight: 600 }}>مجموعة المكتب</div><div className="muted" style={{ fontSize: 12 }}>محادثة سرية لكل الفريق</div></div>
      </button>
      <div className="muted" style={{ padding: '10px 14px 4px', fontSize: 12 }}>محادثات ثنائية</div>
      {loading ? (
        <div className="center-screen"><Loader2 className="spin" /></div>
      ) : (
        members.filter((m) => m.id !== me).map((m) => (
          <button key={m.id} onClick={() => openDirect(m)} style={item(activeKey === m.id)}>
            <User size={18} color="var(--navy)" />
            <div><div style={{ fontWeight: 600 }}>{m.full_name || 'عضو'}</div><div className="muted" style={{ fontSize: 12 }}>{roleLabel(m.role)}</div></div>
          </button>
        ))
      )}
    </div>
  );

  const chatPanel = (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {isMobile && (
        <div className="row" style={{ gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setMobileView('list')}>
            <Users size={16} /> المحادثات
          </button>
          <span style={{ fontWeight: 600 }}>{activeTitle}</span>
        </div>
      )}
      <ChatRoom conversationId={convId} userId={me} title={activeTitle} peerId={peerId} canUpload={canUploadInChat(profile)} emptyHint="اختر محادثة" />
    </div>
  );

  if (isMobile) {
    return (
      <div style={{ height: '100%', minHeight: 0 }}>
        {mobileView === 'list' ? listPanel : chatPanel}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      {listPanel}
      {chatPanel}
    </div>
  );
}

function item(active: boolean): React.CSSProperties {
  return { width: '100%', textAlign: 'start', padding: 12, border: 'none', borderBottom: '1px solid var(--border)', background: active ? 'rgba(15,37,87,.06)' : 'transparent', display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' };
}
