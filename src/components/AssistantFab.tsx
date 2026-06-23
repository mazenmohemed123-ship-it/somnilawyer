import { useState } from 'react';
import { Sparkles, Send, Loader2, X, Lock } from 'lucide-react';
import { legalAssistant, summarizeText } from '@/services/ai';
import { canUseAI, canUseLegalAssistant } from '@/lib/permissions';
import type { Profile } from '@/types';

// Floating AI assistant: summarize (Pro/Team) + legal assistant chat (Team, lawyers only).
export function AssistantFab({ profile }: { profile: Profile | null }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'summarize' | 'chat'>('summarize');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<{ role: string; content: string }[]>([]);

  const aiAllowed = canUseAI(profile);
  const legalAllowed = canUseLegalAssistant(profile);

  // Hide FAB on chat pages
  const isOnChatPage = typeof window !== 'undefined' && (
    window.location.pathname.includes('client-chats') ||
    window.location.pathname.includes('team-chat') ||
    window.location.pathname.includes('appointments')
  );

  if (isOnChatPage) return null;

  async function run() {
    if (!input.trim() || busy) return;
    setBusy(true);
    setOutput('');
    try {
      if (mode === 'summarize') {
        const res = await summarizeText(input);
        setOutput(res.error ? `تعذّر التنفيذ: ${res.error}` : res.result);
      } else {
        const next = [...history, { role: 'user', content: input }];
        setHistory(next);
        const res = await legalAssistant(next);
        const answer = res.error ? `تعذّر التنفيذ: ${res.error}` : res.result;
        setHistory([...next, { role: 'assistant', content: answer }]);
        setOutput(answer);
      }
      setInput('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="المساعد الذكي"
        style={{
          position: 'fixed', bottom: 20, insetInlineEnd: 20, zIndex: 1400,
          width: 56, height: 56, borderRadius: 28, border: 'none',
          background: 'linear-gradient(135deg, var(--gold-bright), var(--gold))',
          color: '#2a2008', boxShadow: 'var(--shadow-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Sparkles size={24} />
      </button>

      {open && (
        <div
          style={{
            position: 'fixed', bottom: 86, insetInlineEnd: 20, zIndex: 1400, width: 360, maxWidth: '92vw',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
          }}
        >
          <div className="spread" style={{ padding: '12px 14px', background: 'var(--navy)', color: '#fff' }}>
            <strong className="row" style={{ gap: 6 }}><Sparkles size={18} /> المساعد الذكي</strong>
            <button className="btn-icon" style={{ color: '#fff', borderColor: 'transparent' }} onClick={() => setOpen(false)}><X size={16} /></button>
          </div>

          {!aiAllowed ? (
            <div className="modal-body col" style={{ alignItems: 'center', textAlign: 'center' }}>
              <Lock size={28} color="var(--gold)" />
              <p>أدوات الذكاء الاصطناعي متاحة في باقتي «احترافي» و«الفريق».</p>
            </div>
          ) : (
            <div className="modal-body col">
              <div className="row" style={{ gap: 6 }}>
                <button className={`btn btn-sm ${mode === 'summarize' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('summarize')}>تلخيص</button>
                {legalAllowed && (
                  <button className={`btn btn-sm ${mode === 'chat' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('chat')}>مساعد قانوني</button>
                )}
              </div>
              {output && (
                <div className="card" style={{ maxHeight: 220, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 14 }}>{output}</div>
              )}
              <textarea
                className="input"
                rows={3}
                placeholder={mode === 'summarize' ? 'ألصق النص لتلخيصه…' : 'اسأل عن مسألة قانونية…'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button className="btn btn-gold btn-block" onClick={run} disabled={busy || !input.trim()}>
                {busy ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                {mode === 'summarize' ? 'تلخيص' : 'إرسال'}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
