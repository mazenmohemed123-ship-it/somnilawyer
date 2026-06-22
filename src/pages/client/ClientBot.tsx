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
    const line = (label: string, val: string | number | null | undefined) =>
      `${label}: ${val !== null && val !== undefined && val !== '' ? val : t('not_set')}`;
    return [
      `📋 ${t('case_details')}`,
      line(t('lbl_case_number'), c.case_number),
      line(t('lbl_client_name'), c.client_name),
      line(t('lbl_case_type'), c.case_type),
      line(t('lbl_fees'), c.fees != null ? formatPrice(c.fees, currency) : null),
      line(t('lbl_expenses'), c.expenses != null ? formatPrice(c.expenses, currency) : null),
      line(t('lbl_verdict'), c.verdict),
    ].join('\n');
  }

  // Look up a case by its number within this lawyer's office.
  async function lookupCase(caseNumber: string): Promise<string> {
    if (!lawyer?.id) return t('bot_case_not_found');
    // Quick path: it's the client's own matched case.
    if (matchedCase?.case_number && matchedCase.case_number.trim() === caseNumber) {
      return formatCase(matchedCase);
    }
    try {
      const snap = await withTimeout(
        getDocs(query(
          collection(db, 'cases'),
          where('lawyer_id', '==', lawyer.id),
          where('case_number', '==', caseNumber)
        )),
        12000,
        'lookupCase'
      );
      if (snap.empty) return t('bot_case_not_found');
      return formatCase({ id: snap.docs[0].id, ...snap.docs[0].data() } as CaseRow);
    } catch (e) {
      console.error('Case lookup failed:', e);
      return t('bot_case_not_found');
    }
  }

  async function answer(q: string): Promise<string> {
    const s = q.toLowerCase().trim();
    // If it looks like a case number (mostly digits), look it up.
    const numeric = q.replace(/[\s-]/g, '');
    if (/^\d{3,}$/.test(numeric)) {
      return await lookupCase(numeric);
    }
    if (s.includes('موعد') || s.includes('appoint') || s.includes('rendez') || s.includes('termin') || s.includes('cita')) {
      return t('bot_appointment');
    }
    if (s.includes('طوارئ') || s.includes('عاجل') || s.includes('emergency') || s.includes('urgen') || s.includes('notfall')) {
      return t('bot_emergency');
    }
    if (s.includes('محام') || s.includes('lawyer') || s.includes('avocat') || s.includes('anwalt') || s.includes('abogado')) {
      return t('bot_lawyer', { name: lawyer?.full_name ?? t('not_set') });
    }
    if (s.includes('دفع') || s.includes('فلوس') || s.includes('pay') || s.includes('paie') || s.includes('zahl') || s.includes('pag')) {
      return t('bot_payment');
    }
    if (s.includes('قضي') || s.includes('case') || s.includes('dossier') || s.includes('caso')) {
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
