import { useEffect, useRef, useState } from 'react';
import { Send, Bot, Loader2 } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { makeT, Lang } from '@/lib/i18n';
import { formatPrice } from '@/services/payments';
import type { Profile, CaseRow } from '@/types';

interface Msg { from: 'bot' | 'user'; text: string; }

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`__timeout__:${label}`)), ms)
    ),
  ]);
}

// Local assistant. Looks up case data by number from Firestore on demand.
export function ClientBot({ lawyer, matchedCase, lang }: { lawyer: Profile | null; matchedCase: CaseRow | null; lang: Lang }) {
  const t = makeT(lang);
  const currency = lawyer?.currency ?? 'EGP';
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMsgs([{ from: 'bot', text: t('bot_greeting', { name: lawyer?.full_name ?? '' }) }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lawyer?.full_name, lang]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs.length, busy]);

  function formatCase(c: CaseRow): string {
    const labels = {
      case_number: t('lbl_case_number'),
      client_name: t('lbl_client_name'),
      case_type: t('lbl_case_type'),
      fees: t('lbl_fees'),
      expenses: t('lbl_expenses'),
      verdict: t('lbl_verdict'),
    };
    const line = (key: string, val: string | number | null | undefined) => {
      if (val === null || val === undefined || val === '') return null;
      const formatted = key === 'fees' || key === 'expenses'
        ? (val ? formatPrice(Number(val), currency) : t('not_set'))
        : val;
      return `${labels[key as keyof typeof labels]}: ${formatted}`;
    };
    const lines = [
      `📋 ${t('case_details')}`,
      line('case_number', c.case_number),
      line('client_name', c.client_name),
      line('case_type', c.case_type),
      line('fees', c.fees),
      line('expenses', c.expenses),
      line('verdict', c.verdict),
    ].filter(Boolean);
    return lines.join('\n');
  }

  async function lookupCase(rawNumber: string): Promise<string> {
    if (!lawyer?.id) return t('bot_case_not_found');
    const digits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '');
    const target = digits(rawNumber);
    const tailMatch = (a: string) => {
      if (!a || !target) return false;
      if (a === target) return true;
      const ta = a.slice(-9), tb = target.slice(-9);
      return ta.length >= 7 && ta === tb;
    };

    if (matchedCase) {
      if ((matchedCase.case_number ?? '').trim() === rawNumber.trim()) return formatCase(matchedCase);
      if (tailMatch(digits(matchedCase.client_phone))) return formatCase(matchedCase);
    }

    try {
      const snap = await withTimeout(
        getDocs(query(collection(db, 'cases'), where('lawyer_id', '==', lawyer.id))),
        12000,
        'lookupCase'
      );
      const match = snap.docs.find((d) => {
        const c = d.data() as CaseRow;
        if ((c.case_number ?? '').trim() === rawNumber.trim()) return true;
        if (tailMatch(digits(c.client_phone))) return true;
        return (c.follower_phones ?? []).some((fp) => tailMatch(digits(fp)));
      });
      if (!match) return t('bot_case_not_found');
      return formatCase({ id: match.id, ...match.data() } as CaseRow);
    } catch (e) {
      console.error('Case lookup failed:', e);
      return t('bot_case_not_found');
    }
  }

  async function answer(q: string): Promise<string> {
    const s = q.toLowerCase().trim();
    const numeric = q.replace(/[\s\-]/g, '');
    if (/^\d{3,}$/.test(numeric)) {
      return await lookupCase(numeric);
    }

    // Multilingual keywords (including Moroccan Arabic/Darija)
    if (s.includes('موعد') || s.includes('رانديفو') || s.includes('موعدي') || s.includes('appoint') || s.includes('rendez') || s.includes('termin') || s.includes('cita')) {
      return t('bot_appointment');
    }
    if (s.includes('طوارئ') || s.includes('عاجل') || s.includes('ستاجة') || s.includes('emergency') || s.includes('urgen') || s.includes('notfall')) {
      return t('bot_emergency');
    }
    if (s.includes('محام') || s.includes('محاميك') || s.includes('ماستاق') || s.includes('lawyer') || s.includes('avocat') || s.includes('anwalt') || s.includes('abogado')) {
      return t('bot_lawyer', { name: lawyer?.full_name ?? t('not_set') });
    }
    if (s.includes('دفع') || s.includes('فلوس') || s.includes('صرف') || s.includes('تسديد') || s.includes('pay') || s.includes('paie') || s.includes('zahl') || s.includes('pag')) {
      return t('bot_payment');
    }
    if (s.includes('قضي') || s.includes('ملف') || s.includes('قضية') || s.includes('الملف') || s.includes('case') || s.includes('dossier') || s.includes('caso')) {
      return t('bot_type_case_number');
    }
    return t('bot_fallback');
  }

  async function send() {
    if (!input.trim() || busy) return;
    const q = input.trim();
    setInput('');
    setMsgs((m) => [...m, { from: 'user', text: q }]);
    setBusy(true);
    try {
      const reply = await answer(q);
      setMsgs((m) => [...m, { from: 'bot', text: reply }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: 'var(--bg)' }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.from === 'user' ? 'flex-start' : 'flex-end', marginBottom: 10 }}>
            <div style={{ maxWidth: '82%', padding: '9px 12px', borderRadius: 14, background: m.from === 'user' ? 'var(--navy)' : 'var(--surface)', color: m.from === 'user' ? '#fff' : 'var(--text)', border: m.from === 'bot' ? '1px solid var(--border)' : 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {m.from === 'bot' && <Bot size={14} style={{ marginInlineEnd: 6, verticalAlign: 'middle' }} color="var(--gold)" />}
              {m.text}
            </div>
          </div>
        ))}
        {busy && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <div style={{ padding: '9px 12px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <Loader2 size={16} className="spin" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="row" style={{ padding: 12, borderTop: '1px solid var(--border)', background: 'var(--surface)', gap: 8 }}>
        <input className="input" value={input} placeholder={t('message')} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button className="btn btn-primary" onClick={send} disabled={busy}><Send size={18} /></button>
      </div>
    </div>
  );
}
