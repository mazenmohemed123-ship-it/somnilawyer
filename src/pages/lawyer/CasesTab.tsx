import { useEffect, useState } from 'react';
import {
  Plus, Trash2, Archive, ArchiveRestore, Users2, Loader2, Edit, Check, X,
} from 'lucide-react';
import {
  collection, query, where, orderBy, getDocs, addDoc, updateDoc, deleteDoc, doc,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { caseLimit, tierRank } from '@/lib/permissions';
import type { CaseRow } from '@/types';

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
  const [editingCase, setEditingCase] = useState<CaseRow | null>(null);
  const [isNewCase, setIsNewCase] = useState(false);

  const ownerId = profile?.master_lawyer_id ?? profile?.id ?? '';

  async function load() {
    if (!ownerId) return;
    setLoading(true);
    const q = query(
      collection(db, 'cases'),
      where('lawyer_id', '==', ownerId),
      where('archived', '==', showArchived),
      orderBy('created_at', 'desc')
    );
    const snap = await getDocs(q);
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CaseRow));
    setCases(rows);
    const keys = new Set<string>();
    rows.forEach((r) => Object.keys(r.extra ?? {}).forEach((k) => keys.add(k)));
    setExtraCols(Array.from(keys).map((k) => ({ key: k, label: k })));
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [ownerId, showArchived]);

  function openNewCaseModal() {
    const active = cases.filter((c) => !c.archived).length;
    if (tierRank(profile?.tier ?? 'free') === 0 && active >= caseLimit('free')) {
      toast('وصلت للحد الأقصى (5 قضايا) في الباقة المجانية. رقِّ باقتك.', 'danger');
      return;
    }
    setEditingCase({
      id: '',
      lawyer_id: ownerId,
      case_number: '',
      client_name: '',
      client_phone: null,
      case_type: null,
      verdict: null,
      fees: null,
      expenses: null,
      extra: {},
      follower_phones: [],
      archived: false,
      created_at: new Date().toISOString(),
    } as CaseRow);
    setIsNewCase(true);
  }

  function openEditModal(row: CaseRow) {
    setEditingCase({ ...row });
    setIsNewCase(false);
  }

  async function toggleArchive(row: CaseRow) {
    await updateDoc(doc(db, 'cases', row.id), { archived: !row.archived });
    load();
  }

  async function removeCase(row: CaseRow) {
    if (tierRank(profile?.tier ?? 'free') === 0) {
      toast('حذف القضايا متاح في الباقات المدفوعة.', 'danger');
      return;
    }
    if (!confirm('تأكيد حذف القضية نهائياً؟')) return;
    await deleteDoc(doc(db, 'cases', row.id));
    load();
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
          <button className="btn btn-primary btn-sm" onClick={openNewCaseModal}><Plus size={16} /> قضية جديدة</button>
        </div>
      </div>

      {loading ? (
        <div className="center-screen"><Loader2 className="spin" /></div>
      ) : cases.length === 0 ? (
        <div className="card center-screen muted">لا توجد قضايا {showArchived ? 'في الأرشيف' : 'بعد'}.</div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(15,37,87,.06)', borderBottom: '2px solid var(--border)' }}>
                {allCols.map((c) => <th key={c.key} style={th}>{c.label}</th>)}
                <th style={th}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((row) => (
                <tr key={row.id} style={{ borderTop: '1px solid var(--border)', transition: 'background 0.1s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(15,37,87,.02)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                  {allCols.map((c) => {
                    const isBase = BASE_COLUMNS.some((b) => b.key === c.key);
                    const val = isBase ? (row as any)[c.key] : row.extra?.[c.key];
                    const cellKey = `${row.id}:${c.key}`;
                    return (
                      <td key={cellKey} style={td}>
                        <span className={c.key === 'fees' || c.key === 'expenses' || c.key === 'client_phone' ? 'num' : ''}>
                          {val ?? <span className="muted">—</span>}
                        </span>
                      </td>
                    );
                  })}
                  <td style={td}>
                    <div className="row" style={{ gap: 4 }}>
                      <button className="btn-icon" title="تعديل" onClick={() => openEditModal(row)}><Edit size={16} color="var(--navy)" /></button>
                      <button className="btn-icon" title="متابعون" onClick={() => setFollowersFor(row)}><Users2 size={16} /></button>
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
          <div className="muted" style={{ padding: 10, fontSize: 12 }}>الإجمالي: {cases.length} قضية</div>
        </div>
      )}

      {editingCase && <CaseModal case={editingCase} isNew={isNewCase} ownerId={ownerId} onClose={() => { setEditingCase(null); load(); }} />}
      {followersFor && <FollowersModal row={followersFor} ownerId={ownerId} onClose={() => { setFollowersFor(null); load(); }} />}
    </div>
  );
}

const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'start', fontSize: 13, fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '9px 12px', fontSize: 14, whiteSpace: 'nowrap', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' };

function CaseModal({ case: c, isNew, ownerId, onClose }: { case: CaseRow; isNew: boolean; ownerId: string; onClose: () => void }) {
  const toast = useToast();
  const [data, setData] = useState(c);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      if (isNew) {
        await addDoc(collection(db, 'cases'), {
          lawyer_id: ownerId,
          case_number: data.case_number,
          client_name: data.client_name,
          client_phone: data.client_phone,
          case_type: data.case_type,
          verdict: data.verdict,
          fees: data.fees ? Number(data.fees) : null,
          expenses: data.expenses ? Number(data.expenses) : null,
          extra: data.extra,
          follower_phones: [],
          archived: false,
          created_at: new Date().toISOString(),
        });
        toast('تمت إضافة القضية', 'success');
      } else {
        await updateDoc(doc(db, 'cases', data.id), {
          case_number: data.case_number,
          client_name: data.client_name,
          client_phone: data.client_phone,
          case_type: data.case_type,
          verdict: data.verdict,
          fees: data.fees ? Number(data.fees) : null,
          expenses: data.expenses ? Number(data.expenses) : null,
          extra: data.extra,
        });
        toast('تم تحديث القضية', 'success');
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={isNew ? '✨ قضية جديدة' : '✏️ تعديل القضية'} onClose={onClose}>
      <div className="col" style={{ gap: 12 }}>
        <div className="row" style={{ gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="label">رقم القضية</label>
            <input className="input" value={data.case_number ?? ''} onChange={(e) => setData({ ...data, case_number: e.target.value })} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">اسم الموكل</label>
            <input className="input" value={data.client_name ?? ''} onChange={(e) => setData({ ...data, client_name: e.target.value })} />
          </div>
        </div>

        <div className="row" style={{ gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="label">الهاتف</label>
            <input className="input num" dir="ltr" value={data.client_phone ?? ''} onChange={(e) => setData({ ...data, client_phone: e.target.value || null })} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">نوع القضية</label>
            <input className="input" value={data.case_type ?? ''} onChange={(e) => setData({ ...data, case_type: e.target.value || null })} />
          </div>
        </div>

        <div>
          <label className="label">الحكم</label>
          <textarea className="input" rows={2} value={data.verdict ?? ''} onChange={(e) => setData({ ...data, verdict: e.target.value || null })} />
        </div>

        <div className="row" style={{ gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="label">الأتعاب</label>
            <input className="input num" type="number" value={data.fees ?? ''} onChange={(e) => setData({ ...data, fees: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">المصاريف</label>
            <input className="input num" type="number" value={data.expenses ?? ''} onChange={(e) => setData({ ...data, expenses: e.target.value ? Number(e.target.value) : null })} />
          </div>
        </div>

        <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}><X size={16} /> إلغاء</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Check size={16} />} {isNew ? 'إنشاء' : 'تحديث'}</button>
        </div>
      </div>
    </Modal>
  );
}

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
          <label className="label">رابط المكتب (أرسله للموكل)</label>
          <div className="row">
            <input className="input num" readOnly value={officeLink} />
            <button className="btn btn-ghost" onClick={() => { navigator.clipboard.writeText(officeLink); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
              {copied ? <Check size={16} color="var(--success)" /> : '📋'}
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
