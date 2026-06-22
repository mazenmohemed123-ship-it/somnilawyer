import { useEffect, useState } from 'react';
import {
  Plus, Trash2, Archive, ArchiveRestore, Users2, Loader2, Copy, Link2, Check, X,
} from 'lucide-react';
import {
  collection, query, where, orderBy, getDocs, addDoc, updateDoc, deleteDoc, doc,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { caseLimit, tierRank } from '@/lib/permissions';
import { notifyCaseConversations } from '@/services/notify';
import type { CaseRow } from '@/types';

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`__timeout__:${label}`)), ms)
    ),
  ]);
}

const BASE_COLUMNS = [
  { key: 'case_number', label: 'رقم القضية' },
  { key: 'client_name', label: 'اسم الموكل' },
  { key: 'client_phone', label: 'الهاتف' },
  { key: 'case_type', label: 'نوع القضية' },
  { key: 'verdict', label: 'الحكم' },
  { key: 'fees', label: 'الأتعاب' },
  { key: 'expenses', label: 'المصاريف' },
];

export function CasesTab() {
  const { profile } = useAuth();
  const toast = useToast();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [extraCols, setExtraCols] = useState<{ key: string; label: string }[]>([]);
  const [followersFor, setFollowersFor] = useState<CaseRow | null>(null);
  const [editing, setEditing] = useState<{ id: string; key: string } | null>(null);

  const ownerId = profile?.master_lawyer_id ?? profile?.id ?? '';

  async function load() {
    if (!ownerId) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'cases'),
        where('lawyer_id', '==', ownerId),
        where('archived', '==', showArchived),
        orderBy('created_at', 'desc')
      );
      const snap = await withTimeout(getDocs(q), 12000, 'loadCases');
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CaseRow));
      setCases(rows);
      const keys = new Set<string>();
      rows.forEach((r) => Object.keys(r.extra ?? {}).forEach((k) => keys.add(k)));
      setExtraCols(Array.from(keys).map((k) => ({ key: k, label: k })));
    } catch (err: any) {
      console.error('Failed to load cases:', err);
      setCases([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [ownerId, showArchived]);

  async function addCase() {
    const active = cases.filter((c) => !c.archived).length;
    if (tierRank(profile?.tier ?? 'free') === 0 && active >= caseLimit('free')) {
      toast('وصلت للحد الأقصى (5 قضايا) في الباقة المجانية. رقِّ باقتك.', 'danger');
      return;
    }
    try {
      await withTimeout(addDoc(collection(db, 'cases'), {
        lawyer_id: ownerId, case_number: '', client_name: '', client_phone: '', case_type: '', verdict: '',
        fees: 0, expenses: 0, extra: {},
        follower_phones: [], archived: false, created_at: new Date().toISOString(),
      }), 12000, 'addCase');
      load();
    } catch (err: any) {
      console.error('Failed to add case:', err);
      toast(err.message?.includes('timeout') ? 'انقطع الاتصال - حاول مجدداً' : 'حدث خطأ - حاول مجدداً', 'danger');
    }
  }

  async function saveCell(row: CaseRow, key: string, value: string) {
    setEditing(null);
    try {
      let patch: Record<string, unknown> = {};
      if (BASE_COLUMNS.some((c) => c.key === key)) {
        if (key === 'fees' || key === 'expenses') patch[key] = value === '' ? 0 : Number(value);
        else patch[key] = value === '' ? '' : value;
      } else {
        patch = { extra: { ...(row.extra ?? {}), [key]: value === '' ? '' : value } };
      }
      await withTimeout(updateDoc(doc(db, 'cases', row.id), patch), 12000, 'updateCase');
      // Let the client know their case was updated (shows in their chat).
      if (profile?.id) {
        notifyCaseConversations(row.id, profile.id, 'تم تحديث بيانات قضيتك من قبل المحامي. افتح «المساعد» واكتب رقم القضية لعرض التفاصيل.');
      }
      load();
    } catch (err: any) {
      console.error('Failed to save:', err);
      toast(err.message?.includes('timeout') ? 'انقطع الاتصال - حاول مجدداً' : 'حدث خطأ - حاول مجدداً', 'danger');
    }
  }

  async function toggleArchive(row: CaseRow) {
    try {
      await withTimeout(updateDoc(doc(db, 'cases', row.id), { archived: !row.archived }), 12000, 'toggleArchive');
      load();
    } catch (err: any) {
      console.error('Failed to toggle archive:', err);
      toast('حدث خطأ - حاول مجدداً', 'danger');
    }
  }

  async function removeCase(row: CaseRow) {
    if (tierRank(profile?.tier ?? 'free') === 0) {
      toast('حذف القضايا متاح في الباقات المدفوعة.', 'danger');
      return;
    }
    if (!confirm('تأكيد حذف القضية نهائياً؟')) return;
    try {
      await withTimeout(deleteDoc(doc(db, 'cases', row.id)), 12000, 'deleteCase');
      load();
    } catch (err: any) {
      console.error('Failed to delete case:', err);
      toast('حدث خطأ - حاول مجدداً', 'danger');
    }
  }

  function addColumn() {
    const name = prompt('اسم العمود الجديد');
    if (name) setExtraCols((p) => [...p, { key: name, label: name }]);
  }

  const allCols = [...BASE_COLUMNS, ...extraCols];

  return (
    <div style={{ padding: 18, overflow: 'auto' }}>
      <div className="spread" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h2>القضايا</h2>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowArchived((s) => !s)}>
            {showArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
            {showArchived ? 'القضايا النشطة' : 'الأرشيف'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={addColumn}><Plus size={16} /> عمود</button>
          <button className="btn btn-primary btn-sm" onClick={addCase}><Plus size={16} /> قضية جديدة</button>
        </div>
      </div>

      {loading ? (
        <div className="center-screen"><Loader2 className="spin" /></div>
      ) : cases.length === 0 ? (
        <div className="card center-screen muted">لا توجد قضايا {showArchived ? 'في الأرشيف' : 'بعد'}.</div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table>
            <thead>
              <tr style={{ background: 'rgba(15,37,87,.04)' }}>
                {allCols.map((c) => <th key={c.key} style={th}>{c.label}</th>)}
                <th style={th}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((row) => (
                <tr key={row.id} style={{ borderTop: '1px solid var(--border)' }}>
                  {allCols.map((c) => {
                    const isBase = BASE_COLUMNS.some((b) => b.key === c.key);
                    const val = isBase ? (row as any)[c.key] : row.extra?.[c.key];
                    const cellKey = `${row.id}:${c.key}`;
                    const isEditing = editing?.id === row.id && editing?.key === c.key;
                    return (
                      <td key={cellKey} style={td} onDoubleClick={() => setEditing({ id: row.id, key: c.key })}>
                        {isEditing ? (
                          <input
                            autoFocus className="input" defaultValue={val ?? ''}
                            style={{ padding: '4px 6px', minWidth: 110 }}
                            onBlur={(e) => saveCell(row, c.key, e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                          />
                        ) : (
                          <span className={c.key === 'fees' || c.key === 'expenses' || c.key === 'client_phone' ? 'num' : ''}>
                            {val ?? <span className="muted">—</span>}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td style={td}>
                    <div className="row" style={{ gap: 4 }}>
                      <button className="btn-icon" title="متابعو القضية" onClick={() => setFollowersFor(row)}><Users2 size={16} /></button>
                      <button className="btn-icon" title={row.archived ? 'استرجاع' : 'أرشفة'} onClick={() => toggleArchive(row)}>
                        {row.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                      </button>
                      <button className="btn-icon" title="حذف" onClick={() => removeCase(row)}><Trash2 size={16} color="var(--danger)" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="muted" style={{ padding: 10, fontSize: 12 }}>نصيحة: انقر مرتين على أي خلية لتعديلها مباشرة.</div>
        </div>
      )}

      {followersFor && (
        <FollowersModal row={followersFor} ownerId={ownerId} onClose={() => { setFollowersFor(null); load(); }} />
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'start', fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '9px 12px', fontSize: 14, whiteSpace: 'nowrap' };

function FollowersModal({ row, ownerId, onClose }: { row: CaseRow; ownerId: string; onClose: () => void }) {
  const toast = useToast();
  const [phones, setPhones] = useState<string[]>(row.follower_phones ?? []);
  const [input, setInput] = useState('');
  const [copied, setCopied] = useState(false);
  const officeLink = `${window.location.origin}/portal/lawyer/${ownerId}`;

  function addPhone() {
    const p = input.trim();
    if (!p) return;
    if (phones.length >= 10) { toast('الحد الأقصى 10 أرقام لكل قضية.', 'danger'); return; }
    if (phones.includes(p)) { toast('الرقم مضاف بالفعل.', 'danger'); return; }
    setPhones([...phones, p]);
    setInput('');
  }

  async function save() {
    await updateDoc(doc(db, 'cases', row.id), { follower_phones: phones });
    toast('تم الحفظ', 'success');
    onClose();
  }

  return (
    <Modal title="متابعو القضية" onClose={onClose}>
      <div className="col" style={{ gap: 16 }}>
        <div>
          <label className="label"><Link2 size={14} style={{ verticalAlign: 'middle' }} /> رابط المكتب (أرسله للموكل)</label>
          <div className="row">
            <input className="input num" readOnly value={officeLink} />
            <button className="btn btn-ghost" onClick={() => { navigator.clipboard.writeText(officeLink); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
              {copied ? <Check size={16} color="var(--success)" /> : <Copy size={16} />}
            </button>
          </div>
        </div>
        <div className="hr" />
        <div>
          <label className="label">الأرقام المسموح لها (حتى 10)</label>
          <div className="row">
            <input className="input num" placeholder="01xxxxxxxxx" value={input} dir="ltr" onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPhone()} />
            <button className="btn btn-primary" onClick={addPhone}><Plus size={16} /></button>
          </div>
          <div className="col" style={{ marginTop: 10, gap: 6 }}>
            {phones.length === 0 && <span className="muted" style={{ fontSize: 13 }}>لا أرقام إضافية.</span>}
            {phones.map((p) => (
              <div key={p} className="spread" style={{ padding: '6px 10px', background: 'var(--bg)', borderRadius: 8 }}>
                <span className="num">{p}</span>
                <button className="btn-icon" onClick={() => setPhones(phones.filter((x) => x !== p))}><X size={14} /></button>
              </div>
            ))}
          </div>
        </div>
        <button className="btn btn-primary btn-block" onClick={save}>حفظ</button>
      </div>
    </Modal>
  );
}
