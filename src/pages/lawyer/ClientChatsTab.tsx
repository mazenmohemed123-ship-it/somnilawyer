import { useEffect, useState } from 'react';
import { Loader2, MessageSquare, ArrowRight, Users } from 'lucide-react';
import {
  collection, query, where, orderBy, getDocs,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/lib/auth';
import { ChatRoom } from '@/components/chat/ChatRoom';
import { getOrCreateDirectConversation } from '@/services/chat';
import { canUploadInChat, canReplyClientChats } from '@/lib/permissions';
import type { CaseRow } from '@/types';

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

export function ClientChatsTab() {
  const { profile, session } = useAuth();
  const isMobile = useIsMobile();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<CaseRow | null>(null);
  const [convId, setConvId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [showSidebar, setShowSidebar] = useState(true);

  const ownerId = profile?.master_lawyer_id ?? profile?.id ?? '';
  const me = session?.user.id ?? null;
  const canReply = canReplyClientChats(profile);

  useEffect(() => {
    if (!ownerId) return;
    (async () => {
      try {
        const snap = await withTimeout(getDocs(query(
          collection(db, 'cases'),
          where('lawyer_id', '==', ownerId),
          where('archived', '==', false),
          orderBy('created_at', 'desc')
        )), 12000, 'loadClientCases');
        setCases(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CaseRow)));
      } catch (err) {
        console.error('Failed to load client cases:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [ownerId]);

  async function openCase(c: CaseRow) {
    try {
      setActive(c);
      setConvId(null);
      setMobileView('chat');
      if (!me) return;
      const conv = await withTimeout(
        getOrCreateDirectConversation({ me, other: ownerId, caseId: c.id, title: c.client_name || 'موكل' }),
        12000,
        'openCaseConversation'
      );
      setConvId(conv.id);
    } catch (err) {
      console.error('Failed to open case:', err);
    }
  }

  const listPanel = (
    <div
      style={{
        width: isMobile ? '100%' : 280,
        borderInlineEnd: isMobile ? 'none' : '1px solid var(--border)',
        overflowY: 'auto',
        background: 'var(--surface)',
        flexShrink: 0,
        height: '100%',
      }}
    >
      <div className="spread" style={{ padding: 14, borderBottom: '1px solid var(--border)', gap: 8 }}>
        <h3 style={{ margin: 0 }}>شات الموكلين</h3>
        {!isMobile && (
          <button className="btn-icon" title="إخفاء القائمة" onClick={() => setShowSidebar(false)}>
            <ArrowRight size={18} />
          </button>
        )}
      </div>
      {loading ? (
        <div className="center-screen"><Loader2 className="spin" /></div>
      ) : cases.length === 0 ? (
        <div className="muted" style={{ padding: 16 }}>لا توجد قضايا.</div>
      ) : (
        cases.map((c) => (
          <button
            key={c.id}
            onClick={() => openCase(c)}
            style={{ width: '100%', textAlign: 'start', padding: 14, border: 'none', borderBottom: '1px solid var(--border)', background: active?.id === c.id ? 'rgba(15,37,87,.06)' : 'transparent', display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}
          >
            <MessageSquare size={18} color="var(--navy)" />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.client_name || 'موكل بدون اسم'}</div>
              <div className="muted num" style={{ fontSize: 12 }}>{c.case_number || '—'}</div>
            </div>
          </button>
        ))
      )}
    </div>
  );

  const chatPanel = (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {(isMobile || !showSidebar) && (
        <div className="row" style={{ gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { if (isMobile) setMobileView('list'); else setShowSidebar(true); }}
          >
            <Users size={16} /> الموكلون
          </button>
          {active && <span style={{ fontWeight: 600 }}>{active.client_name || 'موكل'}</span>}
        </div>
      )}
      {!canReply ? (
        <div className="center-screen muted">لا تملك صلاحية الرد على محادثات الموكلين.</div>
      ) : (
        <ChatRoom
          conversationId={convId}
          userId={me}
          title={active?.client_name || 'اختر قضية'}
          subtitle={active?.case_number || ''}
          canUpload={canUploadInChat(profile)}
          emptyHint="اختر قضية من القائمة لبدء المحادثة مع الموكل"
        />
      )}
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
      {showSidebar && listPanel}
      {chatPanel}
    </div>
  );
}
