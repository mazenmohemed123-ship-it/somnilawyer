import { useEffect, useState } from 'react';
import { CalendarPlus, Loader2, CheckCircle2 } from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`__timeout__:${label}`)), ms)
    ),
  ]);
}

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export function BookAppointment({ lawyerId, clientId, caseId, clientName }: {
  lawyerId: string; clientId: string | null; caseId: string | null; clientName: string | null;
}) {
  const [avail, setAvail] = useState<any[]>([]);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    withTimeout(getDoc(doc(db, 'availability', lawyerId)), 12000, 'loadAvailability')
      .then((snap) => {
        if (snap.exists()) {
          const slots = snap.data().slots ?? [];
          setAvail(slots.filter((s: any) => s.enabled));
        }
      })
      .catch((e) => console.error('Failed to load availability:', e));
  }, [lawyerId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !time) return;
    setBusy(true);
    setMsg('');
    try {
      const requestedAt = new Date(`${date}T${time}`);
      const weekday = requestedAt.getDay();
      const slot = avail.find((a) => a.weekday === weekday);
      if (!slot) {
        setMsg('عذراً، المحامي غير متاح في هذا اليوم. اختر يوماً آخر.');
        setBusy(false);
        return;
      }

      // Conflict check
      const snap = await withTimeout(
        getDocs(query(
          collection(db, 'appointments'),
          where('lawyer_id', '==', lawyerId),
          where('requested_at', '==', requestedAt.toISOString()),
          where('status', '==', 'accepted')
        )),
        12000,
        'checkAppointmentConflict'
      );
      if (!snap.empty) {
        setMsg('هذا الموعد محجوز بالفعل. اختر وقت آخر.');
        setBusy(false);
        return;
      }

      const result = await withTimeout(
        addDoc(collection(db, 'appointments'), {
          lawyer_id: lawyerId,
          client_id: clientId,
          case_id: caseId,
          client_name: clientName,
          requested_at: requestedAt.toISOString(),
          note: note.trim(),
          status: 'pending',
          created_at: new Date().toISOString(),
        }),
        12000,
        'createAppointment'
      );
      if (result) setDone(true);
      else setMsg('تعذّر إرسال الطلب. حاول مرة أخرى.');
    } catch (err: any) {
      console.error('Submit error:', err);
      setMsg(err.message?.includes('timeout') ? 'انقطع الاتصال - حاول مجدداً' : 'حدث خطأ - حاول مجدداً');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="center-screen col" style={{ textAlign: 'center', gap: 12 }}>
        <CheckCircle2 size={48} color="var(--success)" />
        <h3>تم إرسال طلب الموعد</h3>
        <p className="muted">سيصلك رد المحامي بالقبول أو الرفض قريباً.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 480, margin: '0 auto', width: '100%' }}>
      <h3 className="row" style={{ gap: 8, marginBottom: 14 }}><CalendarPlus size={20} /> حجز موعد</h3>
      <div className="card" style={{ marginBottom: 14, fontSize: 13 }}>
        <strong>أيام العمل:</strong>{' '}
        {avail.length ? avail.map((a) => `${DAYS[a.weekday]} (${a.start_time?.slice(0,5)}–${a.end_time?.slice(0,5)})`).join('، ') : 'غير محددة'}
      </div>
      <form className="card col" onSubmit={submit}>
        <div><label className="label">التاريخ</label><input className="input num" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
        <div><label className="label">الوقت</label><input className="input num" type="time" value={time} onChange={(e) => setTime(e.target.value)} required /></div>
        <div><label className="label">ملاحظة (اختياري)</label><textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        {msg && <div className="badge badge-danger" style={{ padding: '8px 12px' }}>{msg}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? <Loader2 size={18} className="spin" /> : <CalendarPlus size={18} />} طلب الموعد</button>
      </form>
    </div>
  );
}
