import { useEffect, useRef, useState } from 'react';
import { Check, X, CalendarClock, Loader2, History } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { postSystemMessage } from '@/services/chat';
import { canManageAppointments } from '@/lib/permissions';
import type { AppointmentRequest, CaseEvent } from '@/types';

export function AppointmentsTab() {
  const { profile, session } = useAuth();
  const toast = useToast();
  const [reqs, setReqs] = useState<AppointmentRequest[]>([]);
  const [events, setEvents] = useState<CaseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const ownerId = profile?.master_lawyer_id ?? profile?.id ?? '';
  const me = session?.user.id ?? null;
  const canManage = canManageAppointments(profile);

  async function load() {
    const [{ data: r }, { data: e }] = await Promise.all([
      supabase.from('appointment_requests').select('*').eq('lawyer_id', ownerId).order('created_at', { ascending: false }),
      supabase.from('case_events').select('*').eq('lawyer_id', ownerId).eq('kind', 'appointment').order('created_at', { ascending: false }).limit(40),
    ]);
    setReqs((r ?? []) as AppointmentRequest[]);
    setEvents((e ?? []) as CaseEvent[]);
    setLoading(false);
  }

  useEffect(() => {
    if (!ownerId) return;
    load();
    const ch = supabase
      .channel(`appts:${ownerId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'appointment_requests', filter: `lawyer_id=eq.${ownerId}` }, (payload) => {
        setReqs((prev) => [payload.new as AppointmentRequest, ...prev]);
        // Audible alert for new requests.
        try { audioRef.current?.play(); } catch { /* ignore */ }
        toast('طلب موعد جديد', 'info');
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [ownerId]);

  async function decide(req: AppointmentRequest, status: 'accepted' | 'rejected') {
    // 1) update status
    await supabase.from('appointment_requests').update({ status }).eq('id', req.id);
    // 2) permanent case_event trail (never disappears)
    await supabase.from('case_events').insert({
      case_id: req.case_id, lawyer_id: ownerId, kind: 'appointment', created_by: me,
      title: status === 'accepted' ? 'تم قبول موعد' : 'تم رفض موعد',
      body: `${new Date(req.requested_at).toLocaleString('ar-EG')}${req.note ? ' — ' + req.note : ''}`,
    });
    // 3) system message in the case conversation
    if (req.case_id) {
      const { data: conv } = await supabase.from('conversations').select('id').eq('case_id', req.case_id).eq('type', 'direct').maybeSingle();
      if (conv && me) {
        await postSystemMessage(conv.id, me, status === 'accepted'
          ? `تم قبول موعدك بتاريخ ${new Date(req.requested_at).toLocaleString('ar-EG')}`
          : `نعتذر، تم رفض الموعد المطلوب بتاريخ ${new Date(req.requested_at).toLocaleString('ar-EG')}`);
      }
    }
    toast(status === 'accepted' ? 'تم القبول' : 'تم الرفض', 'success');
    load();
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
