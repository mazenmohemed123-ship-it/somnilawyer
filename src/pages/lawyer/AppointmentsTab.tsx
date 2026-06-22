import { useEffect, useRef, useState } from 'react';
import { Check, X, CalendarClock, Loader2, History } from 'lucide-react';
import {
  collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, limit, getDocs,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { postSystemMessage } from '@/services/chat';
import { caseConvId } from '@/services/chat';
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

export function AppointmentsTab() {
  const { profile, session } = useAuth();
  const toast = useToast();
  const [reqs, setReqs] = useState<AppointmentRequest[]>([]);
  const [events, setEvents] = useState<CaseEvent[]>([]);
  const [loading, setLoading] = useState(true);
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

  async function decide(req: AppointmentRequest, status: 'accepted' | 'rejected') {
    try {
      await withTimeout(updateDoc(doc(db, 'appointments', req.id), { status }), 12000, 'updateAppointment');

      await withTimeout(addDoc(collection(db, 'case_events'), {
        case_id: req.case_id, lawyer_id: ownerId, kind: 'appointment', created_by: me,
        title: status === 'accepted' ? 'تم قبول موعد' : 'تم رفض موعد',
        body: `${new Date(req.requested_at).toLocaleString('ar-EG')}${req.note ? ' — ' + req.note : ''}`,
        created_at: new Date().toISOString(),
      }), 12000, 'addAppointmentEvent');

      if (req.case_id && me) {
        // Best-effort chat notification to the client — never block the decision.
        try {
          const convId = caseConvId(req.case_id);
          await postSystemMessage(convId, me, status === 'accepted'
            ? `تم قبول موعدك بتاريخ ${new Date(req.requested_at).toLocaleString('ar-EG')}`
            : `نعتذر، تم رفض الموعد المطلوب بتاريخ ${new Date(req.requested_at).toLocaleString('ar-EG')}`);
        } catch (e) {
          console.warn('Could not post appointment decision to chat:', e);
        }
      }

      toast(status === 'accepted' ? 'تم القبول' : 'تم الرفض', 'success');
    } catch (err: any) {
      console.error('Decide error:', err);
      toast('حدث خطأ - حاول مجدداً', 'danger');
    }
  }

  const pending = reqs.filter((r) => r.status === 'pending');

  return (
    <div style={{ padding: 18 }}>
      <audio ref={audioRef} src="data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=" preload="auto" />
      <h2 style={{ marginBottom: 16 }}>المواعيد</h2>

      {loading ? (
        <div className="center-screen"><Loader2 className="spin" /></div>
      ) : (
        <div className="col" style={{ gap: 20, maxWidth: 820 }}>
          <div className="card">
            <h3 className="row" style={{ gap: 8, marginBottom: 12 }}><CalendarClock size={18} /> طلبات قيد الانتظار ({pending.length})</h3>
            {pending.length === 0 ? <div className="muted">لا طلبات جديدة.</div> : (
              <div className="col" style={{ gap: 8 }}>
                {pending.map((r) => (
                  <div key={r.id} className="spread" style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 10, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.client_name || 'موكل'}</div>
                      <div className="muted num" style={{ fontSize: 13 }}>{new Date(r.requested_at).toLocaleString('ar-EG')}</div>
                      {r.note && <div className="muted" style={{ fontSize: 13 }}>{r.note}</div>}
                    </div>
                    {canManage && (
                      <div className="row" style={{ gap: 6 }}>
                        <button className="btn btn-primary btn-sm" onClick={() => decide(r, 'accepted')}><Check size={16} /> قبول</button>
                        <button className="btn btn-danger btn-sm" onClick={() => decide(r, 'rejected')}><X size={16} /> رفض</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

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
