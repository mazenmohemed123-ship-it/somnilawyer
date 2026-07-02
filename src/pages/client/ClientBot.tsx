import { useEffect, useRef, useState } from 'react';
import { Send, Bot } from 'lucide-react';
import { makeT, Lang } from '@/lib/i18n';
import { formatPrice } from '@/services/payments';
import type { Profile, CaseRow } from '@/types';

interface Msg { from: 'bot' | 'user'; text: string; }

// Local assistant. Looks up case data by number among the cases the client
// was already granted access to at login (their own case + any followed
// cases) — Firestore rules never allow a client to browse other cases, so
// the bot must not (and does not need to) query Firestore itself.
export function ClientBot({ lawyer, matchedCase, cases, lang }: { lawyer: Profile | null; matchedCase: CaseRow | null; cases: CaseRow[]; lang: Lang }) {
  const t = makeT(lang);
  const currency = lawyer?.currency ?? 'EGP';
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMsgs([{ from: 'bot', text: t('bot_greeting', { name: lawyer?.full_name ?? '' }) }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lawyer?.full_name, lang]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs.length]);

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

  function lookupCase(rawNumber: string): string {
    const pool = cases.length > 0 ? cases : (matchedCase ? [matchedCase] : []);
    if (pool.length === 0) return t('bot_case_not_found');

    const digits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '');
    const target = digits(rawNumber);
    const targetTrimmed = rawNumber.trim();

    const tailMatch = (a: string) => {
      if (!a || !target) return false;
      if (a === target) return true;
      const ta = a.slice(-9), tb = target.slice(-9);
      return ta.length >= 7 && ta === tb;
    };

    const match = pool.find((c) => {
      const cNum = (c.case_number ?? '').trim();
      if (cNum === targetTrimmed || cNum === target || digits(cNum) === target) return true;
      if (tailMatch(digits(c.client_phone))) return true;
      if ((c.follower_phones ?? []).some((fp) => tailMatch(digits(fp)))) return true;
      return false;
    });

    return match ? formatCase(match) : t('bot_case_not_found');
  }

  function answer(q: string): string {
    const s = q.toLowerCase().trim();
    const numeric = q.replace(/[\s\-]/g, '');
    if (/^\d{3,}$/.test(numeric)) {
      return lookupCase(numeric);
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

  function send() {
    if (!input.trim()) return;
    const q = input.trim();
    setInput('');
    setMsgs((m) => [...m, { from: 'user', text: q }, { from: 'bot', text: answer(q) }]);
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
        <div ref={endRef} />
      </div>
      <div className="row" style={{ padding: 12, borderTop: '1px solid var(--border)', background: 'var(--surface)', gap: 8 }}>
        <input className="input" value={input} placeholder={t('message')} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button className="btn btn-primary" onClick={send}><Send size={18} /></button>
      </div>
    </div>
  );
}
