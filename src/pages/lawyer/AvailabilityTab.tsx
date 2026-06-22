import { useEffect, useState } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

interface Slot { weekday: number; enabled: boolean; start_time: string; end_time: string; }

export function AvailabilityTab() {
  const { profile } = useAuth();
  const toast = useToast();
  const ownerId = profile?.master_lawyer_id ?? profile?.id ?? '';
  const [slots, setSlots] = useState<Slot[]>(
    DAYS.map((_, i) => ({ weekday: i, enabled: i >= 0 && i <= 4, start_time: '09:00', end_time: '17:00' }))
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ownerId) return;
    supabase.from('lawyer_availability').select('*').eq('lawyer_id', ownerId).then(({ data }) => {
      if (data && data.length) {
        setSlots((prev) => prev.map((s) => {
          const row = data.find((d: any) => d.weekday === s.weekday);
          return row ? { weekday: s.weekday, enabled: row.enabled, start_time: row.start_time?.slice(0, 5) ?? '09:00', end_time: row.end_time?.slice(0, 5) ?? '17:00' } : s;
        }));
      }
    });
  }, [ownerId]);

  async function save() {
    setBusy(true);
    const rows = slots.map((s) => ({ lawyer_id: ownerId, weekday: s.weekday, enabled: s.enabled, start_time: s.start_time, end_time: s.end_time }));
    const { error } = await supabase.from('lawyer_availability').upsert(rows, { onConflict: 'lawyer_id,weekday' });
    setBusy(false);
    toast(error ? error.message : 'تم حفظ أوقات العمل', error ? 'danger' : 'success');
  }

  return (
    <div style={{ padding: 18 }}>
      <h2 style={{ marginBottom: 16 }}>أوقات العمل والتوافر</h2>
      <div className="card col" style={{ maxWidth: 640, gap: 8 }}>
        {slots.map((s, i) => (
          <div key={s.weekday} className="spread" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
            <label className="row" style={{ gap: 8, minWidth: 120 }}>
              <input type="checkbox" checked={s.enabled} onChange={(e) => setSlots((p) => p.map((x, j) => j === i ? { ...x, enabled: e.target.checked } : x))} />
              <strong>{DAYS[s.weekday]}</strong>
            </label>
            <div className="row" style={{ gap: 8, opacity: s.enabled ? 1 : 0.5 }}>
              <input className="input num" type="time" value={s.start_time} disabled={!s.enabled} onChange={(e) => setSlots((p) => p.map((x, j) => j === i ? { ...x, start_time: e.target.value } : x))} />
              <span className="muted">إلى</span>
              <input className="input num" type="time" value={s.end_time} disabled={!s.enabled} onChange={(e) => setSlots((p) => p.map((x, j) => j === i ? { ...x, end_time: e.target.value } : x))} />
            </div>
          </div>
        ))}
        <button className="btn btn-primary" style={{ marginTop: 10, alignSelf: 'flex-start' }} onClick={save} disabled={busy}>
          {busy ? <Loader2 size={18} className="spin" /> : <Save size={18} />} حفظ
        </button>
      </div>
    </div>
  );
}
