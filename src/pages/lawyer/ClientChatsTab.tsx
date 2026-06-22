import { useEffect, useState } from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/lib/auth';
import { ChatRoom } from '@/components/chat/ChatRoom';
import { ensureParticipants } from '@/services/chat';
import { canUploadInChat, canReplyClientChats } from '@/lib/permissions';
import type { CaseRow } from '@/types';

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
    supabase
      .from('cases')
      .select('*')
      .eq('lawyer_id', ownerId)
      .eq('archived', false)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setCases((data ?? []) as CaseRow[]); setLoading(false); });
  }, [ownerId]);

  async function openCase(c: CaseRow) {
    setActive(c);
    setConvId(null);
    // Find existing case conversation; create one if needed (client joins on entry).
    let { data: conv } = await supabase
      .from('conversations')
      .select('*')
      .eq('case_id', c.id)
      .eq('type', 'direct')
      .maybeSingle();
    if (!conv && me) {
      const { data: created } = await supabase
        .from('conversations')
        .insert({ type: 'direct', case_id: c.id, title: c.client_name || 'موكل', created_by: me })
        .select('*')
        .single();
      conv = created;
    }
    if (conv && me) {
      await ensureParticipants(conv.id, [me]);
      setConvId(conv.id);
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
