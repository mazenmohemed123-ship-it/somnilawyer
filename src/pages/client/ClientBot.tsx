import { useState } from 'react';
import { Send, Bot } from 'lucide-react';
import { makeT, Lang } from '@/lib/i18n';
import type { Profile, CaseRow } from '@/types';

interface Msg { from: 'bot' | 'user'; text: string; }

// 100% local assistant — no database. Answers general questions.
export function ClientBot({ lawyer, matchedCase, lang }: { lawyer: Profile | null; matchedCase: CaseRow | null; lang: Lang }) {
  const t = makeT(lang);
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: 'bot', text: 'مرحباً، أنا المساعد الآلي. كيف أساعدك؟ يمكنك السؤال عن: رقم القضية، المواعيد، الطوارئ.' },
  ]);
  const [input, setInput] = useState('');

  function answer(q: string): string {
    const s = q.toLowerCase();
    if (s.includes('رقم') || s.includes('قضية') || s.includes('case')) {
      return matchedCase?.case_number ? `رقم قضيتك: ${matchedCase.case_number}` : 'لا يتوفر رقم قضية مرتبط برقمك حالياً.';
    }
    if (s.includes('موعد') || s.includes('appoint')) {
      return 'لحجز موعد، عُد للقائمة واختر «حجز موعد». سيصلك رد المحامي بالقبول أو الرفض.';
    }
    if (s.includes('طوارئ') || s.includes('عاجل') || s.includes('emergency')) {
      return 'لإرسال طلب طوارئ، استخدم زر «الطوارئ» الأحمر في القائمة الرئيسية.';
    }
    if (s.includes('محام') || s.includes('اسم') || s.includes('lawyer')) {
      return `محاميك: ${lawyer?.full_name ?? 'غير محدد'}.`;
    }
    if (s.includes('دفع') || s.includes('فلوس') || s.includes('pay')) {
      return 'للدفع، اختر «الدفع» من القائمة. تتوفر فودافون كاش وإنستاباي وتحويل بنكي وبطاقة.';
    }
    return 'لم أفهم سؤالك تماماً. للتواصل المباشر، اختر «التواصل مع المحامي» من القائمة.';
  }

  function send() {
    if (!input.trim()) return;
    const q = input.trim();
    setMsgs((m) => [...m, { from: 'user', text: q }, { from: 'bot', text: answer(q) }]);
    setInput('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: 'var(--bg)' }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.from === 'user' ? 'flex-start' : 'flex-end', marginBottom: 10 }}>
            <div style={{ maxWidth: '80%', padding: '9px 12px', borderRadius: 14, background: m.from === 'user' ? 'var(--navy)' : 'var(--surface)', color: m.from === 'user' ? '#fff' : 'var(--text)', border: m.from === 'bot' ? '1px solid var(--border)' : 'none' }}>
              {m.from === 'bot' && <Bot size={14} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} color="var(--gold)" />}
              {m.text}
            </div>
          </div>
        ))}
      </div>
      <div className="row" style={{ padding: 12, borderTop: '1px solid var(--border)', background: 'var(--surface)', gap: 8 }}>
        <input className="input" value={input} placeholder={t('message')} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button className="btn btn-primary" onClick={send}><Send size={18} /></button>
      </div>
    </div>
  );
}
