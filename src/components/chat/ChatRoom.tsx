import { useEffect, useRef, useState } from 'react';
import {
  Send, Paperclip, Loader2, Check, CheckCheck, Reply, Trash2, FileText, ImageIcon, X,
} from 'lucide-react';
import { useChat } from './useChat';
import type { ChatMessage } from '@/types';

interface Props {
  conversationId: string | null;
  userId: string | null;
  title: string;
  subtitle?: string;
  canUpload?: boolean;
  peerId?: string | null; // to compute online status of the other party
  emptyHint?: string;
}

function fileKind(mime: string): string {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf' || mime.includes('document')) return 'document';
  return 'other';
}

export function ChatRoom({ conversationId, userId, title, subtitle, canUpload = true, peerId, emptyHint }: Props) {
  const { messages, loading, typing, online, sendText, sendAttachment, softDelete, broadcastTyping } = useChat(
    conversationId,
    userId
  );
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [uploading, setUploading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, typing.length]);

  const peerOnline = peerId ? online.has(peerId) : online.size > 1;

  async function handleSend() {
    if (!text.trim()) return;
    const t = text;
    setText('');
    const r = replyTo;
    setReplyTo(null);
    await sendText(t, r);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      await sendAttachment(file, fileKind(file.type));
    } finally {
      setUploading(false);
    }
  }

  if (!conversationId) {
    return (
      <div className="center-screen" style={{ flex: 1, color: 'var(--muted)' }}>
        {emptyHint ?? 'اختر محادثة للبدء'}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header */}
      <div className="spread" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div>
          <div style={{ fontWeight: 700 }}>{title}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {typing.length > 0 ? 'يكتب الآن…' : peerOnline ? 'متصل الآن' : subtitle ?? 'غير متصل'}
          </div>
        </div>
        <span className="badge" style={{ background: peerOnline ? 'rgba(30,142,90,.14)' : 'rgba(107,114,128,.14)', color: peerOnline ? 'var(--success)' : 'var(--muted)' }}>
          <span style={{ width: 8, height: 8, borderRadius: 8, background: peerOnline ? 'var(--success)' : 'var(--muted)', display: 'inline-block' }} />
          {peerOnline ? 'حضور' : 'غياب'}
        </span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: 'var(--bg)', minHeight: 0 }}>
        {loading ? (
          <div className="center-screen"><Loader2 className="spin" /></div>
        ) : messages.length === 0 ? (
          <div className="center-screen muted">لا توجد رسائل بعد</div>
        ) : (
          messages.map((m) => <Bubble key={m.id} m={m} mine={m.sender_id === userId} onReply={setReplyTo} onDelete={softDelete} />)
        )}
        {typing.length > 0 && (
          <div className="muted" style={{ fontSize: 13, padding: '4px 8px' }}>يكتب الآن…</div>
        )}
        <div ref={endRef} />
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div className="spread" style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={{ borderRight: '3px solid var(--gold)', paddingRight: 8, fontSize: 13 }}>
            <div className="muted" style={{ fontSize: 11 }}>رد على</div>
            {replyTo.content.slice(0, 80)}
          </div>
          <button className="btn-icon" onClick={() => setReplyTo(null)}><X size={16} /></button>
        </div>
      )}

      {/* Composer */}
      <div className="row" style={{ padding: 12, borderTop: '1px solid var(--border)', background: 'var(--surface)', gap: 8 }}>
        {canUpload && (
          <>
            <button className="btn-icon" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="إرفاق ملف">
              {uploading ? <Loader2 size={18} className="spin" /> : <Paperclip size={18} />}
            </button>
            <input ref={fileRef} type="file" hidden accept="image/*,video/*,application/pdf" onChange={handleFile} />
          </>
        )}
        <textarea
          className="input"
          rows={1}
          value={text}
          placeholder="اكتب رسالة"
          style={{ resize: 'none', flex: 1 }}
          onChange={(e) => {
            setText(e.target.value);
            broadcastTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <button className="btn btn-primary" onClick={handleSend} disabled={!text.trim()} aria-label="إرسال">
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

function Bubble({
  m,
  mine,
  onReply,
  onDelete,
}: {
  m: ChatMessage;
  mine: boolean;
  onReply: (m: ChatMessage) => void;
  onDelete: (id: string) => void;
}) {
  const deleted = !!m.deleted_at;
  if (m.type === 'system') {
    return (
      <div style={{ textAlign: 'center', margin: '10px 0' }}>
        <span className="badge" style={{ background: 'rgba(15,37,87,.06)' }}>{m.content}</span>
      </div>
    );
  }
  const time = new Date(m.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  return (
    <div style={{ display: 'flex', justifyContent: mine ? 'flex-start' : 'flex-end', marginBottom: 10 }}>
      <div
        className="chat-bubble"
        style={{
          maxWidth: '78%',
          background: mine ? 'var(--navy)' : 'var(--surface)',
          color: mine ? '#fff' : 'var(--text)',
          border: mine ? 'none' : '1px solid var(--border)',
          borderRadius: 14,
          padding: '9px 12px',
          boxShadow: 'var(--shadow-sm)',
          opacity: m._optimistic ? 0.7 : 1,
        }}
      >
        {m.reply_to_preview && (
          <div style={{ borderRight: '3px solid var(--gold)', paddingRight: 6, marginBottom: 5, fontSize: 12, opacity: 0.85 }}>
            {m.reply_to_preview}
          </div>
        )}
        {deleted ? (
          <em className="muted">تم حذف الرسالة</em>
        ) : m.type === 'attachment' && m.attachments?.length ? (
          <div className="col" style={{ gap: 6 }}>
            {m.attachments.map((a) =>
              a.file_type === 'image' ? (
                <a key={a.id} href={a.file_url} target="_blank" rel="noreferrer">
                  <img src={a.file_url} alt={a.file_name} style={{ maxWidth: 220, borderRadius: 10, display: 'block' }} />
                </a>
              ) : (
                <a key={a.id} href={a.file_url} target="_blank" rel="noreferrer" className="row" style={{ color: mine ? '#fff' : 'var(--navy)' }}>
                  <FileText size={16} />
                  <span style={{ fontSize: 13 }}>{a.file_name}</span>
                </a>
              )
            )}
          </div>
        ) : (
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.content}</div>
        )}
        <div className="row" style={{ justifyContent: 'flex-end', gap: 6, marginTop: 4, fontSize: 11, opacity: 0.75 }}>
          <span className="num">{time}</span>
          {mine && !deleted && (
            m.read_at ? <CheckCheck size={14} /> : m.status === 'pending' ? <Loader2 size={12} className="spin" /> : m.delivered_at ? <CheckCheck size={14} style={{ opacity: 0.6 }} /> : <Check size={14} />
          )}
          {!deleted && (
            <>
              <button onClick={() => onReply(m)} title="رد" style={iconBtn(mine)}><Reply size={13} /></button>
              {mine && <button onClick={() => onDelete(m.id)} title="حذف" style={iconBtn(mine)}><Trash2 size={13} /></button>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function iconBtn(mine: boolean): React.CSSProperties {
  return { background: 'transparent', border: 'none', color: mine ? '#fff' : 'var(--muted)', padding: 0, cursor: 'pointer', display: 'inline-flex' };
}
