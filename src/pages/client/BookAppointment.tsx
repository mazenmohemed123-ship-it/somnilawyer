import { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Loader2, CheckCircle2 } from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { makeT, Lang } from '@/lib/i18n';

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`__timeout__:${label}`)), ms)
    ),
  ]);
}

interface Slot { weekday: number; enabled: boolean; start_time: string; end_time: string; }

const DAY_LABELS: Record<Lang, string[]> = {
  ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
  darija: ['الحد', 'التنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  fr: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
  tr: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'],
  de: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
  es: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  pt: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  it: ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'],
  ur: ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'],
};

// Build 30-minute time slots between start and end (e.g. "09:00" → "17:00").
function buildTimeSlots(start: string, end: string): string[] {
  const [sh, sm] = (start ?? '09:00').slice(0, 5).split(':').map(Number);
  const [eh, em] = (end ?? '17:00').slice(0, 5).split(':').map(Number);
  const slots: string[] = [];
  let cur = sh * 60 + sm;
  const last = eh * 60 + em;
  while (cur < last) {
    const h = Math.floor(cur / 60);
    const m = cur % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    cur += 30;
  }
  return slots;
}

export function BookAppointment({ lawyerId, clientId, caseId, clientName, lang = 'ar' }: {
  lawyerId: string; clientId: string | null; caseId: string | null; clientName: string | null; lang?: Lang;
}) {
  const t = makeT(lang);
  const dayNames = DAY_LABELS[lang] ?? DAY_LABELS.ar;

  const [avail, setAvail] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [taken, setTaken] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<string>(''); // YYYY-MM-DD
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState('');

  // Load lawyer availability + already-booked (accepted) appointments.
  useEffect(() => {
    (async () => {
      try {
        const snap = await withTimeout(getDoc(doc(db, 'availability', lawyerId)), 12000, 'loadAvailability');
        if (snap.exists()) {
          const slots: Slot[] = (snap.data().slots ?? []).filter((s: Slot) => s.enabled);
          setAvail(slots);
        }
        const apptSnap = await withTimeout(
          getDocs(query(
            collection(db, 'appointments'),
            where('lawyer_id', '==', lawyerId),
            where('status', '==', 'accepted')
          )),
          12000,
          'loadBookedSlots'
        );
        const set = new Set<string>();
        apptSnap.docs.forEach((d) => {
          const iso = d.data().requested_at;
          if (iso) set.add(new Date(iso).toISOString());
        });
        setTaken(set);
      } catch (e) {
        console.error('Failed to load availability:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [lawyerId]);

  // Build the list of selectable dates: next 21 days that fall on an enabled weekday.
  const dateOptions = useMemo(() => {
    const enabledDays = new Set(avail.map((a) => a.weekday));
    const out: { iso: string; label: string; sub: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 21 && out.length < 14; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      if (!enabledDays.has(d.getDay())) continue;
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayLabel = i === 0 ? t('today') : i === 1 ? t('tomorrow') : dayNames[d.getDay()];
      out.push({ iso, label: dayLabel, sub: `${d.getDate()}/${d.getMonth() + 1}` });
    }
    return out;
  }, [avail, lang]);

  // Time slots for the selected date, with booked ones flagged.
  const timeOptions = useMemo(() => {
    if (!selectedDate) return [];
    const weekday = new Date(`${selectedDate}T00:00`).getDay();
    const slot = avail.find((a) => a.weekday === weekday);
    if (!slot) return [];
    return buildTimeSlots(slot.start_time, slot.end_time).map((time) => {
      const iso = new Date(`${selectedDate}T${time}`).toISOString();
      return { time, taken: taken.has(iso) };
    });
  }, [selectedDate, avail, taken]);

  async function submit() {
    if (!selectedDate || !selectedTime) return;
    setBusy(true);
    setMsg('');
    try {
      const requestedAt = new Date(`${selectedDate}T${selectedTime}`);
      if (taken.has(requestedAt.toISOString())) {
        setMsg(t('slot_taken'));
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
          reminded: false,
          created_at: new Date().toISOString(),
        }),
        12000,
        'createAppointment'
      );
      if (result) setDone(true);
      else setMsg(t('slot_taken'));
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
        <h3>{t('booking_sent')}</h3>
        <p className="muted">{t('booking_wait')}</p>
      </div>
    );
  }

  if (loading) {
    return <div className="center-screen"><Loader2 className="spin" /></div>;
  }

  if (avail.length === 0) {
    return (
      <div style={{ padding: 16, maxWidth: 520, margin: '0 auto', width: '100%' }}>
        <div className="card center-screen muted" style={{ minHeight: 200 }}>{t('no_availability')}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 520, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <h3 className="row" style={{ gap: 8 }}><CalendarPlus size={20} /> {t('book_appointment')}</h3>

      {/* Day picker */}
      <div>
        <label className="label" style={{ marginBottom: 8, display: 'block' }}>{t('choose_day')}</label>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}>
          {dateOptions.map((d) => (
            <button
              key={d.iso}
              onClick={() => { setSelectedDate(d.iso); setSelectedTime(''); }}
              style={{
                flexShrink: 0, minWidth: 78, padding: '10px 8px', borderRadius: 12, cursor: 'pointer',
                border: selectedDate === d.iso ? '2px solid var(--gold-bright)' : '1px solid var(--border)',
                background: selectedDate === d.iso ? 'rgba(212,175,55,.12)' : 'var(--surface)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14 }}>{d.label}</div>
              <div className="muted num" style={{ fontSize: 12 }}>{d.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Time picker */}
      {selectedDate && (
        <div>
          <label className="label" style={{ marginBottom: 8, display: 'block' }}>{t('choose_time')}</label>
          {timeOptions.length === 0 ? (
            <div className="muted">{t('no_slots')}</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 8 }}>
              {timeOptions.map((slot) => (
                <button
                  key={slot.time}
                  disabled={slot.taken}
                  onClick={() => setSelectedTime(slot.time)}
                  className="num"
                  style={{
                    padding: '10px 4px', borderRadius: 10, cursor: slot.taken ? 'not-allowed' : 'pointer',
                    border: selectedTime === slot.time ? '2px solid var(--gold-bright)' : '1px solid var(--border)',
                    background: slot.taken ? 'rgba(107,114,128,.12)' : selectedTime === slot.time ? 'rgba(212,175,55,.12)' : 'var(--surface)',
                    color: slot.taken ? 'var(--muted)' : 'var(--text)',
                    textDecoration: slot.taken ? 'line-through' : 'none',
                    fontWeight: 600, fontSize: 14,
                  }}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Note + confirm */}
      {selectedTime && (
        <div className="col" style={{ gap: 10 }}>
          <div>
            <label className="label">{t('note_optional')}</label>
            <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {msg && <div className="badge badge-danger" style={{ padding: '8px 12px' }}>{msg}</div>}
          <button className="btn btn-primary btn-block" onClick={submit} disabled={busy}>
            {busy ? <Loader2 size={18} className="spin" /> : <CalendarPlus size={18} />} {t('confirm_booking')}
          </button>
        </div>
      )}
    </div>
  );
}
