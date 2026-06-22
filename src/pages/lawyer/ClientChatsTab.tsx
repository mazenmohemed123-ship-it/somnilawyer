import { useEffect, useState } from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import {
  collection, query, where, orderBy, getDocs, addDoc, doc, updateDoc,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/lib/auth';
import { ChatRoom } from '@/components/chat/ChatRoom';
import { ensureParticipants, directConvId } from '@/services/chat';
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

export function ClientChatsTab() {
  const { profile, session } = useAuth();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<CaseRow | null>(null);
  const [convId, setConvId] = useState<string | null>(null);

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
      const convId = directConvId(ownerId, c.id); // case-specific conv
      try {
        await withTimeout(updateDoc(doc(db, 'conversations', convId), { case_id: c.id }), 12000, 'updateConversation');
      } catch {
        // Create if doesn't exist
        await withTimeout(addDoc(collection(db, 'conversations'), {
          type: 'direct',
          case_id: c.id,
          title: c.client_name || 'موكل',
          status: 'active',
          office_id: null,
          participants: me ? [me, ownerId] : [ownerId],
          last_message_at: null,
          last_message_preview: null,
          created_by: me,
          created_at: new Date().toISOString(),
        }), 12000, 'createConversation');
      }
      if (me) await ensureParticipants(convId, [me, ownerId]);
      setConvId(convId);
    } catch (err) {
      console.error('Failed to open case:', err);
    }
  }

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <div style={{ width: 280, borderInlineEnd: '1px solid var(--border)', overflowY: 'auto', background: 'var(--surface)', flexShrink: 0 }}>
        <div style={{ padding: 14, borderBottom: '1px solid var(--border)' }}><h3>شات الموكلين</h3></div>
        {loading ? (
          <div className="center-screen"><Loader2 className="spin" /></div>
        ) : cases.length === 0 ? (
          <div className="muted" style={{ padding: 16 }}>لا توجد قضايا.</div>
        ) : (
          cases.map((c) => (
            <button
              key={c.id}
              onClick={() => openCase(c)}
              style={{ width: '100%', textAlign: 'start', padding: 12, border: 'none', borderBottom: '1px solid var(--border)', background: active?.id === c.id ? 'rgba(15,37,87,.06)' : 'transparent', display: 'flex', gap: 10, alignItems: 'center' }}
            >
              <MessageSquare size={18} color="var(--navy)" />
              <div>
                <div style={{ fontWeight: 600 }}>{c.client_name || 'موكل بدون اسم'}</div>
                <div className="muted num" style={{ fontSize: 12 }}>{c.case_number || '—'}</div>
              </div>
            </button>
          ))
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
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
    </div>
  );
}
