import { useEffect, useState } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

interface Slot { weekday: number; enabled: boolean; start_time: string; end_time: string; }

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`__timeout__:${label}`)), ms)
    ),
  ]);
}

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
    (async () => {
      try {
        const snap = await withTimeout(getDoc(doc(db, 'availability', ownerId)), 12000, 'loadAvailability');
        if (snap.exists()) {
          const saved: Slot[] = snap.data().slots ?? [];
          setSlots((prev) => prev.map((s) => {
            const row = saved.find((r) => r.weekday === s.weekday);
            return row ? { weekday: s.weekday, enabled: row.enabled, start_time: row.start_time?.slice(0, 5) ?? '09:00', end_time: row.end_time?.slice(0, 5) ?? '17:00' } : s;
          }));
        }
      } catch (err) {
        console.error('Failed to load availability:', err);
      }
    })();
  }, [ownerId]);

  async function save() {
    setBusy(true);
    try {
      await withTimeout(setDoc(doc(db, 'availability', ownerId), { slots, lawyer_id: ownerId }), 12000, 'saveAvailability');
      toast('تم حفظ أوقات العمل', 'success');
    } catch (err: any) {
      console.error('Save error:', err);
      toast('حدث خطأ - حاول مجدداً', 'danger');
    } finally {
      setBusy(false);
    }
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
