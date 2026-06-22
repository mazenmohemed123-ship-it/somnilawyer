import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Scale, Phone, Loader2, MessageSquare, Bot, ShieldAlert, CalendarPlus, CreditCard, ArrowLeft,
} from 'lucide-react';
import { doc, getDoc, where, query, collection, getDocs, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { ensureParticipants, postSystemMessage, directConvId } from '@/services/chat';
import { ChatRoom } from '@/components/chat/ChatRoom';
import { makeT, LANGS, Lang } from '@/lib/i18n';
import type { Profile, CaseRow } from '@/types';
import { ClientBot } from './client/ClientBot';
import { BookAppointment } from './client/BookAppointment';
import { ClientPayment } from './client/ClientPayment';

type View = 'menu' | 'bot' | 'chat' | 'book' | 'pay';

export function ClientPortal() {
  const { lawyerId } = useParams();
  const [lang, setLang] = useState<Lang>('ar');
  const t = makeT(lang);

  const [lawyer, setLawyer] = useState<Profile | null>(null);
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<'gate' | 'portal'>('gate');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<View>('menu');

  const [clientId, setClientId] = useState<string | null>(null);
  const [matchedCase, setMatchedCase] = useState<CaseRow | null>(null);
  const [convId, setConvId] = useState<string | null>(null);

  useEffect(() => {
    if (!lawyerId) return;
    getDoc(doc(db, 'users', lawyerId)).then((snap) => {
      if (snap.exists()) {
        const prof = snap.data() as Profile;
        setLawyer(prof);
        if (prof.language) setLang(prof.language as Lang);
      }
    });
  }, [lawyerId]);

  async function enter(e: React.FormEvent) {
    e.preventDefault();
    if (!lawyerId || !phone.trim()) return;
    setBusy(true);
    setError('');
    try {
      // Check if phone is allowed for this lawyer
      const q = query(collection(db, 'cases'), where('lawyer_id', '==', lawyerId));
      const snap = await getDocs(q);
      const theCase = snap.docs.find((d) => {
        const data = d.data() as CaseRow;
        return data.client_phone === phone.trim() || (data.follower_phones ?? []).includes(phone.trim());
      })?.data() as CaseRow | undefined;

      if (!theCase) { setError(t('not_registered')); setBusy(false); return; }

      // Anonymous sign-in
      const auth_result = await signInAnonymously(auth);
      const uid = auth_result.user?.uid ?? null;
      setClientId(uid);
      setMatchedCase(theCase);

      // Get or create conversation
      let convId: string | null = null;
      if (theCase?.id && uid) {
        const convDocId = directConvId(uid, lawyerId);
        const convSnap = await getDoc(doc(db, 'conversations', convDocId));
        if (!convSnap.exists()) {
          await addDoc(collection(db, 'conversations'), {
            id: convDocId,
            type: 'direct',
            case_id: theCase.id,
            title: theCase.client_name || 'موكل',
            status: 'active',
            office_id: null,
            participants: [uid, lawyerId],
            last_message_at: null,
            last_message_preview: null,
            created_by: uid,
            created_at: new Date().toISOString(),
          });
        }
        await ensureParticipants(convDocId, [uid, lawyerId]);
        convId = convDocId;
      }
      setConvId(convId);
      setStep('portal');
    } catch (err: any) {
      setError(err.message ?? 'حدث خطأ');
    } finally {
      setBusy(false);
    }
  }

  async function sendEmergency() {
    if (!convId || !clientId) { alert('المحادثة غير متاحة'); return; }
    await postSystemMessage(convId, clientId, 'طلب طوارئ عاجل من الموكل — يرجى التواصل فوراً');
    if (matchedCase?.id) {
      await addDoc(collection(db, 'case_emergencies'), {
        case_id: matchedCase.id,
        lawyer_id: lawyerId,
        client_id: clientId,
        note: 'طوارئ من البوابة',
        created_at: new Date().toISOString(),
      });
    }
    alert('تم إرسال تنبيه الطوارئ');
  }

  if (step === 'gate') {
    return (
      <div className="center-screen" style={{ minHeight: '100vh', background: 'linear-gradient(160deg, var(--navy), var(--navy-900))' }} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="card" style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ display: 'inline-flex', width: 58, height: 58, borderRadius: 16, alignItems: 'center', justifyContent: 'center', background: 'var(--navy)', marginBottom: 10 }}>
              <Scale size={28} color="var(--gold-bright)" />
            </div>
            <h2>{lawyer?.full_name ?? 'مكتب المحاماة'}</h2>
            <p className="muted">{t('enter_phone')}</p>
          </div>
          <form className="col" onSubmit={enter}>
            <div className="row" style={{ gap: 8 }}>
              <Phone size={18} color="var(--muted)" />
              <input className="input num" dir="ltr" placeholder="01xxxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
            {error && <div className="badge badge-danger" style={{ padding: '8px 12px' }}>{error}</div>}
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? <Loader2 size={18} className="spin" /> : null} {t('enter')}
            </button>
          </form>
          <div className="hr" />
          <div className="row" style={{ gap: 6, justifyContent: 'center' }}>
            {LANGS.map((l) => (
              <button key={l.code} className={`btn btn-sm ${lang === l.code ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setLang(l.code)}>{l.label}</button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <header className="spread" style={{ padding: '12px 16px', background: 'var(--navy)', color: '#fff' }}>
        <div className="row" style={{ gap: 10 }}>
          {view !== 'menu' && <button className="btn-icon" style={{ color: '#fff', borderColor: 'transparent' }} onClick={() => setView('menu')}><ArrowLeft size={18} /></button>}
          <div style={{ width: 40, height: 40, borderRadius: 12, overflow: 'hidden', background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {lawyer?.avatar_url ? <img src={lawyer.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Scale size={20} color="var(--gold-bright)" />}
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>{lawyer?.full_name ?? 'المحامي'}</div>
            {matchedCase && <div style={{ fontSize: 12, opacity: 0.8 }} className="num">{matchedCase.case_number || ''}</div>}
          </div>
        </div>
      </header>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {view === 'menu' && (
          <div style={{ padding: 16, maxWidth: 560, margin: '0 auto', width: '100%' }}>
            {lawyer?.bio && <div className="card" style={{ marginBottom: 14 }}>{lawyer.bio}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <MenuCard icon={<Bot size={26} />} label={t('assistant_bot')} onClick={() => setView('bot')} />
              <MenuCard icon={<MessageSquare size={26} />} label={t('chat_with_lawyer')} onClick={() => setView('chat')} />
              <MenuCard icon={<CalendarPlus size={26} />} label={t('book_appointment')} onClick={() => setView('book')} />
              <MenuCard icon={<CreditCard size={26} />} label={t('payment')} onClick={() => setView('pay')} />
            </div>
            <button className="btn btn-danger btn-block" style={{ marginTop: 14, padding: 14 }} onClick={sendEmergency}>
              <ShieldAlert size={20} /> {t('emergency')}
            </button>
          </div>
        )}

        {view === 'bot' && <ClientBot lawyer={lawyer} matchedCase={matchedCase} lang={lang} />}
        {view === 'chat' && (
          <ChatRoom conversationId={convId} userId={clientId} title={lawyer?.full_name ?? 'المحامي'} peerId={lawyerId} canUpload={false} emptyHint="المحادثة ستبدأ هنا" />
        )}
        {view === 'book' && <BookAppointment lawyerId={lawyerId!} clientId={clientId} caseId={matchedCase?.id ?? null} clientName={matchedCase?.client_name ?? null} />}
        {view === 'pay' && <ClientPayment lawyer={lawyer} caseId={matchedCase?.id ?? null} />}
      </div>
    </div>
  );
}

function MenuCard({ icon, label, onClick }: { icon: JSX.Element; label: string; onClick: () => void }) {
  return (
    <button className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 22, cursor: 'pointer', border: '1px solid var(--border)' }} onClick={onClick}>
      <span style={{ color: 'var(--navy)' }}>{icon}</span>
      <span style={{ fontWeight: 600 }}>{label}</span>
    </button>
  );
}
