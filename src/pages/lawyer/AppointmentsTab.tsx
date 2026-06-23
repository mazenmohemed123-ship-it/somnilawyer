import { useEffect, useRef, useState } from 'react';
import { Check, X, CalendarClock, Loader2, History, CalendarCheck, PencilLine } from 'lucide-react';
import {
  collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, limit, getDocs,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { postSystemMessage, caseConvId } from '@/services/chat';
import { notifyUser } from '@/services/notify';
import { canManageAppointments } from '@/lib/permissions';
import type { AppointmentRequest, CaseEvent } from '@/types';

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`__timeout__:${label}`)), ms)
    ),
  ]);
}

// Convert an ISO timestamp to the value a <input type="datetime-local"> expects.
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AppointmentsTab() {
  const { profile, session } = useAuth();
  const toast = useToast();
  const [reqs, setReqs] = useState<AppointmentRequest[]>([]);
  const [events, setEvents] = useState<CaseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isInitialLoad = useRef(true);

  const ownerId = profile?.master_lawyer_id ?? profile?.id ?? '';
  const me = session?.user.id ?? null;
  const canManage = canManageAppointments(profile);

  useEffect(() => {
    if (!ownerId) return;

    // Load case events once
    (async () => {
      try {
        const snap = await withTimeout(getDocs(query(
          collection(db, 'case_events'),
          where('lawyer_id', '==', ownerId),
          where('kind', '==', 'appointment'),
          orderBy('created_at', 'desc'),
          limit(40)
        )), 12000, 'loadAppointmentEvents');
        setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CaseEvent)));
      } catch (err) {
        console.error('Failed to load appointment events:', err);
      }
    })();

    // Real-time listener for appointment requests
    const q = query(
      collection(db, 'appointments'),
      where('lawyer_id', '==', ownerId),
      orderBy('created_at', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppointmentRequest));
      if (!isInitialLoad.current) {
        snap.docChanges().forEach((change) => {
          if (change.type === 'added') {
            try { audioRef.current?.play(); } catch { /* ignore */ }
            toast('طلب موعد جديد', 'info');
          }
        });
      }
      isInitialLoad.current = false;
      setReqs(rows);
      setLoading(false);
    });
    return unsub;
    // eslint-disable-next-line
  }, [ownerId]);

  // Notify the client both in-chat and via push (best-effort).
  async function notifyClient(req: AppointmentRequest, text: string) {
    if (req.case_id && me) {
      try {
        await postSystemMessage(caseConvId(req.case_id), me, text);
      } catch (e) {
        console.warn('Could not post appointment update to chat:', e);
      }
    }
    if (req.client_id) {
      notifyUser(req.client_id, 'تحديث موعد', text, { type: 'appointment_update' });
    }
  }

  async function logEvent(req: AppointmentRequest, title: string, whenIso: string) {
    await withTimeout(addDoc(collection(db, 'case_events'), {
      case_id: req.case_id, lawyer_id: ownerId, kind: 'appointment', created_by: me,
      title,
      body: `${new Date(whenIso).toLocaleString('ar-EG')}${req.note ? ' — ' + req.note : ''}`,
      created_at: new Date().toISOString(),
    }), 12000, 'addAppointmentEvent');
    // Refresh the local history list.
    setEvents((prev) => [{
      id: `tmp-${Date.now()}`, case_id: req.case_id, lawyer_id: ownerId, kind: 'appointment',
      created_by: me, title, body: new Date(whenIso).toLocaleString('ar-EG'),
      created_at: new Date().toISOString(),
    } as CaseEvent, ...prev]);
  }

  async function decide(req: AppointmentRequest, status: 'accepted' | 'rejected') {
    try {
      await withTimeout(updateDoc(doc(db, 'appointments', req.id), { status }), 12000, 'updateAppointment');
      await logEvent(req, status === 'accepted' ? 'تم قبول موعد' : 'تم رفض موعد', req.requested_at);
      await notifyClient(req, status === 'accepted'
        ? `تم قبول موعدك بتاريخ ${new Date(req.requested_at).toLocaleString('ar-EG')}`
        : `نعتذر، تم رفض الموعد المطلوب بتاريخ ${new Date(req.requested_at).toLocaleString('ar-EG')}`);
      toast(status === 'accepted' ? 'تم القبول' : 'تم الرفض', 'success');
    } catch (err: any) {
      console.error('Decide error:', err);
      toast('حدث خطأ - حاول مجدداً', 'danger');
    }
  }

  // Reschedule: lawyer proposes a different time, appointment becomes accepted at the new time.
  async function reschedule(req: AppointmentRequest) {
    if (!editValue) { toast('اختر التاريخ والوقت الجديد', 'danger'); return; }
    try {
      const newIso = new Date(editValue).toISOString();
      await withTimeout(updateDoc(doc(db, 'appointments', req.id), {
        requested_at: newIso, status: 'accepted', reminded: false,
      }), 12000, 'rescheduleAppointment');
      await logEvent({ ...req, requested_at: newIso }, 'تم تعديل موعد', newIso);
      await notifyClient(req, `تم تعديل موعدك إلى ${new Date(newIso).toLocaleString('ar-EG')} — برجاء الالتزام بالموعد الجديد.`);
      setEditingId(null);
      setEditValue('');
      toast('تم تعديل الموعد وإشعار الموكل', 'success');
    } catch (err: any) {
      console.error('Reschedule error:', err);
      toast('حدث خطأ - حاول مجدداً', 'danger');
    }
  }

  const pending = reqs.filter((r) => r.status === 'pending');
  const accepted = reqs
    .filter((r) => r.status === 'accepted')
    .sort((a, b) => (a.requested_at ?? '').localeCompare(b.requested_at ?? ''));
  const now = Date.now();
  const upcoming = accepted.filter((r) => new Date(r.requested_at).getTime() >= now);

  return (
    <div style={{ padding: 18 }}>
      <audio ref={audioRef} src="data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=" preload="auto" />
      <h2 style={{ marginBottom: 16 }}>المواعيد</h2>

      {loading ? (
        <div className="center-screen"><Loader2 className="spin" /></div>
      ) : (
        <div className="col" style={{ gap: 20, maxWidth: 820 }}>
          {/* Pending requests */}
          <div className="card">
            <h3 className="row" style={{ gap: 8, marginBottom: 12 }}><CalendarClock size={18} /> طلبات قيد الانتظار ({pending.length})</h3>
            {pending.length === 0 ? <div className="muted">لا طلبات جديدة.</div> : (
              <div className="col" style={{ gap: 8 }}>
                {pending.map((r) => (
                  <div key={r.id} style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 10 }}>
                    <div className="spread" style={{ flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{r.client_name || 'موكل'}</div>
                        <div className="muted num" style={{ fontSize: 13 }}>{new Date(r.requested_at).toLocaleString('ar-EG')}</div>
                        {r.note && <div className="muted" style={{ fontSize: 13 }}>{r.note}</div>}
                      </div>
                      {canManage && (
                        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                          <button className="btn btn-primary btn-sm" onClick={() => decide(r, 'accepted')}><Check size={16} /> قبول</button>
                          <button className="btn btn-danger btn-sm" onClick={() => decide(r, 'rejected')}><X size={16} /> رفض</button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => { setEditingId(editingId === r.id ? null : r.id); setEditValue(toLocalInput(r.requested_at)); }}
                          >
                            <PencilLine size={16} /> تعديل
                          </button>
                        </div>
                      )}
                    </div>
                    {editingId === r.id && (
                      <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                        <input
                          type="datetime-local"
                          className="input"
                          style={{ maxWidth: 240 }}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                        />
                        <button className="btn btn-primary btn-sm" onClick={() => reschedule(r)}>
                          <CalendarCheck size={16} /> حفظ وإشعار الموكل
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setEditingId(null); setEditValue(''); }}>إلغاء</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Accepted / upcoming appointments */}
          <div className="card">
            <h3 className="row" style={{ gap: 8, marginBottom: 12 }}><CalendarCheck size={18} color="var(--success)" /> المواعيد المقبولة ({upcoming.length})</h3>
            {upcoming.length === 0 ? <div className="muted">لا مواعيد قادمة.</div> : (
              <div className="col" style={{ gap: 8 }}>
                {upcoming.map((r) => (
                  <div key={r.id} className="spread" style={{ padding: '10px 12px', background: 'rgba(30,142,90,.07)', borderRadius: 10, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.client_name || 'موكل'}</div>
                      <div className="num" style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>{new Date(r.requested_at).toLocaleString('ar-EG')}</div>
                      {r.note && <div className="muted" style={{ fontSize: 13 }}>{r.note}</div>}
                    </div>
                    {canManage && (
                      <div className="row" style={{ gap: 6 }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => { setEditingId(editingId === r.id ? null : r.id); setEditValue(toLocalInput(r.requested_at)); }}
                        >
                          <PencilLine size={16} /> تعديل
                        </button>
                      </div>
                    )}
                    {editingId === r.id && (
                      <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap', width: '100%' }}>
                        <input
                          type="datetime-local"
                          className="input"
                          style={{ maxWidth: 240 }}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                        />
                        <button className="btn btn-primary btn-sm" onClick={() => reschedule(r)}>
                          <CalendarCheck size={16} /> حفظ وإشعار الموكل
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setEditingId(null); setEditValue(''); }}>إلغاء</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* History */}
          <div className="card">
            <h3 className="row" style={{ gap: 8, marginBottom: 12 }}><History size={18} /> سجل المواعيد</h3>
            {events.length === 0 ? <div className="muted">لا سجل بعد.</div> : (
              <div className="col" style={{ gap: 6 }}>
                {events.map((e) => (
                  <div key={e.id} className="spread" style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                    <div><strong>{e.title}</strong><div className="muted" style={{ fontSize: 13 }}>{e.body}</div></div>
                    <span className="muted num" style={{ fontSize: 12 }}>{new Date(e.created_at).toLocaleDateString('ar-EG')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
