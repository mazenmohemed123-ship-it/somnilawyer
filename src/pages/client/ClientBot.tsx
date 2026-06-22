import { useState, useEffect } from 'react';
import { Send, Bot } from 'lucide-react';
import { makeT, Lang } from '@/lib/i18n';
import type { Profile, CaseRow } from '@/types';

interface Msg { from: 'bot' | 'user'; text: string; }

export function ClientBot({ lawyer, matchedCase, lang }: { lawyer: Profile | null; matchedCase: CaseRow | null; lang: Lang }) {
  const t = makeT(lang);
  const lawyerName = lawyer?.full_name || 'المحامي';

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    setMsgs([
      { from: 'bot', text: `مرحباً، أنا مساعد الأستاذ ${lawyerName}. 👋\n\nيمكنك السؤال عن:\n✅ بيانات قضيتك\n📅 حجز مواعيد\n💳 الدفع\n🚨 طلب طوارئ\n\nكيف أساعدك؟` },
    ]);
  }, [lawyerName]);

  function formatCaseDetails(): string {
    if (!matchedCase) return 'لا توجد قضية مرتبطة برقمك حالياً.';

    const lines = [
      `📋 **بيانات القضية الخاصة بك:**`,
      ``,
      `رقم القضية: ${matchedCase.case_number || '—'}`,
      matchedCase.client_name ? `اسم الموكل: ${matchedCase.client_name}` : null,
      matchedCase.case_type ? `النوع: ${matchedCase.case_type}` : null,
      matchedCase.fees ? `الأتعاب: ${matchedCase.fees}` : null,
      matchedCase.expenses ? `المصاريف: ${matchedCase.expenses}` : null,
      matchedCase.verdict ? `الحكم: ${matchedCase.verdict}` : null,
    ].filter(Boolean).join('\n');

    return lines;
  }

  function answer(q: string): string {
    const s = q.toLowerCase();

    if (s.includes('رقم') || s.includes('قضية') || s.includes('بيانات') || s.includes('case') || s.includes('details')) {
      return formatCaseDetails();
    }
    if (s.includes('أتعاب') || s.includes('رسوم') || s.includes('fees') || s.includes('كام')) {
      return matchedCase?.fees ? `الأتعاب المستحقة: **${matchedCase.fees}** ج.م` : 'لم يتم تحديد أتعاب لقضيتك حالياً.';
    }
    if (s.includes('مصاريف') || s.includes('expenses')) {
      return matchedCase?.expenses ? `المصاريف: **${matchedCase.expenses}** ج.م` : 'لم يتم تحديد مصاريف.';
    }
    if (s.includes('موعد') || s.includes('appointment') || s.includes('حجز')) {
      return '📅 **لحجز موعد:**\nاختر «حجز موعد» من القائمة الرئيسية ثم اختر التاريخ والوقت. سيصلك رد الأستاذ ' + lawyerName + ' بالقبول أو الرفض.';
    }
    if (s.includes('طوارئ') || s.includes('عاجل') || s.includes('emergency') || s.includes('ضروري')) {
      return '🚨 **للطوارئ:**\nاضغط على زر «الطوارئ» الأحمر في الصفحة الرئيسية لإرسال تنبيه فوري للأستاذ ' + lawyerName + '.';
    }
    if (s.includes('محام') || s.includes('اسم') || s.includes('lawyer') || s.includes('أستاذ')) {
      return `محاميك الخاص: **${lawyerName}** ⚖️`;
    }
    if (s.includes('دفع') || s.includes('فلوس') || s.includes('pay') || s.includes('حساب')) {
      return '💳 **الدفع:**\nاختر «الدفع» من القائمة الرئيسية واختر طريقة الدفع:\n• فودافون كاش\n• إنستاباي\n• تحويل بنكي\n• بطاقة ائتمان';
    }
    if (s.includes('تواصل') || s.includes('مراسلة') || s.includes('chat')) {
      return '💬 **التواصل المباشر:**\nاختر «التواصل مع ' + lawyerName + '» من القائمة الرئيسية للمراسلة المباشرة.';
    }

    return '❓ لم أفهم سؤالك تماماً.\n\nللتواصل المباشر مع ' + lawyerName + '، اختر «التواصل» من القائمة الرئيسية.';
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
          <div key={i} style={{ display: 'flex', justifyContent: m.from === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
            <div style={{ maxWidth: '85%', padding: '10px 14px', borderRadius: 14, background: m.from === 'user' ? 'var(--navy)' : 'var(--surface)', color: m.from === 'user' ? '#fff' : 'var(--text)', border: m.from === 'bot' ? '1px solid var(--border)' : 'none', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
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
