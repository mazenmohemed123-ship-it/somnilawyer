import { useEffect, useState } from 'react';
import { Upload, Download, Trash2, Loader2, FileText, ScanText, Lock } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { dailyUploadLimit, canUseAI, canEditDocuments } from '@/lib/permissions';
import { ocrImage } from '@/services/ai';
import type { CaseRow, DocumentRow } from '@/types';

function fmtSize(n: number) {
  if (n > 1e9) return (n / 1e9).toFixed(1) + ' GB';
  if (n > 1e6) return (n / 1e6).toFixed(1) + ' MB';
  if (n > 1e3) return (n / 1e3).toFixed(1) + ' KB';
  return n + ' B';
}

export function VaultTab() {
  const { profile, session } = useAuth();
  const toast = useToast();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [caseId, setCaseId] = useState<string>('');
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [usedToday, setUsedToday] = useState(0);
  const [ocrText, setOcrText] = useState<string | null>(null);

  const ownerId = profile?.master_lawyer_id ?? profile?.id ?? '';
  const me = session?.user.id ?? null;
  const limit = dailyUploadLimit(profile?.tier ?? 'free');
  const canEdit = canEditDocuments(profile);

  useEffect(() => {
    if (!ownerId) return;
    supabase.from('cases').select('*').eq('lawyer_id', ownerId).order('created_at', { ascending: false })
      .then(({ data }) => setCases((data ?? []) as CaseRow[]));
    const today = new Date(); today.setHours(0, 0, 0, 0);
    supabase.from('documents').select('size_bytes').eq('lawyer_id', ownerId).gte('created_at', today.toISOString())
      .then(({ data }) => setUsedToday((data ?? []).reduce((s, d) => s + (d.size_bytes || 0), 0)));
  }, [ownerId]);

  async function loadDocs(cid: string) {
    setLoading(true);
    const { data } = await supabase.from('documents').select('*').eq('case_id', cid).order('created_at', { ascending: false });
    setDocs((data ?? []) as DocumentRow[]);
    setLoading(false);
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !caseId) return;
    if (usedToday + file.size > limit) { toast('تجاوزت حد الرفع اليومي لباقتك.', 'danger'); return; }
    setBusy(true);
    try {
      const path = `${ownerId}/${caseId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('documents').upload(path, file);
      if (upErr) throw upErr;
      const { error } = await supabase.from('documents').insert({
        case_id: caseId, lawyer_id: ownerId, uploader_id: me, name: file.name,
        storage_path: path, mime_type: file.type, size_bytes: file.size,
      });
      if (error) throw error;
      setUsedToday((u) => u + file.size);
      toast('تم الرفع', 'success');
      loadDocs(caseId);
    } catch (err: any) {
      toast(err.message ?? 'فشل الرفع', 'danger');
    } finally {
      setBusy(false);
    }
  }

  async function download(d: DocumentRow) {
    const { data } = await supabase.storage.from('documents').createSignedUrl(d.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  async function remove(d: DocumentRow) {
    if (!confirm('حذف الملف؟')) return;
    await supabase.storage.from('documents').remove([d.storage_path]);
    await supabase.from('documents').delete().eq('id', d.id);
    loadDocs(caseId);
  }

  async function runOcr(d: DocumentRow) {
    if (!(d.mime_type ?? '').startsWith('image/')) { toast('الـ OCR للصور فقط.', 'info'); return; }
    setBusy(true);
    setOcrText('جارٍ المعالجة…');
    try {
      const { data } = await supabase.storage.from('documents').createSignedUrl(d.storage_path, 120);
      if (!data?.signedUrl) throw new Error('تعذر جلب الصورة');
      const blob = await (await fetch(data.signedUrl)).blob();
      const file = new File([blob], d.name, { type: d.mime_type ?? 'image/png' });
      const res = await ocrImage(file);
      setOcrText(res.error ? `تعذّر: ${res.error}` : res.result);
    } catch (e: any) {
      setOcrText('تعذّر: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  const pct = limit === Infinity ? 0 : Math.min(100, (usedToday / limit) * 100);

  return (
    <div style={{ padding: 18 }}>
      <div className="spread" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <h2>المستندات</h2>
        <div className="muted" style={{ fontSize: 13 }}>
          المستخدم اليوم: <span className="num">{fmtSize(usedToday)}</span> / {limit === Infinity ? 'غير محدود' : fmtSize(limit)}
        </div>
      </div>
      {limit !== Infinity && (
        <div style={{ height: 6, background: 'var(--border)', borderRadius: 6, marginBottom: 16 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: pct > 90 ? 'var(--danger)' : 'var(--gold)', borderRadius: 6 }} />
        </div>
      )}

      <div className="card col" style={{ maxWidth: 820 }}>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <select className="input" style={{ maxWidth: 280 }} value={caseId} onChange={(e) => { setCaseId(e.target.value); if (e.target.value) loadDocs(e.target.value); }}>
            <option value="">اختر القضية</option>
            {cases.map((c) => <option key={c.id} value={c.id}>{c.client_name || 'موكل'} — {c.case_number || '—'}</option>)}
          </select>
          <label className="btn btn-primary" style={{ opacity: caseId && canEdit ? 1 : 0.5, pointerEvents: caseId && canEdit ? 'auto' : 'none' }}>
            {busy ? <Loader2 size={18} className="spin" /> : <Upload size={18} />} رفع ملف (PDF / Word / صور)
            <input type="file" hidden accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*" onChange={upload} />
          </label>
          {!canEdit && <span className="badge badge-danger"><Lock size={12} /> لا صلاحية تعديل</span>}
        </div>

        <div className="hr" />

        {!caseId ? (
          <div className="muted center-screen">اختر قضية لعرض مستنداتها.</div>
        ) : loading ? (
          <div className="center-screen"><Loader2 className="spin" /></div>
        ) : docs.length === 0 ? (
          <div className="muted center-screen">لا مستندات لهذه القضية.</div>
        ) : (
          <div className="col" style={{ gap: 6 }}>
            {docs.map((d) => (
              <div key={d.id} className="spread" style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 10 }}>
                <div className="row" style={{ gap: 10 }}>
                  <FileText size={18} color="var(--navy)" />
                  <div>
                    <div style={{ fontWeight: 600 }}>{d.name}</div>
                    <div className="muted num" style={{ fontSize: 12 }}>{fmtSize(d.size_bytes)}</div>
                  </div>
                </div>
                <div className="row" style={{ gap: 4 }}>
                  {canUseAI(profile) && (d.mime_type ?? '').startsWith('image/') && (
                    <button className="btn-icon" title="OCR" onClick={() => runOcr(d)}><ScanText size={16} /></button>
                  )}
                  <button className="btn-icon" title="تنزيل" onClick={() => download(d)}><Download size={16} /></button>
                  {canEdit && <button className="btn-icon" title="حذف" onClick={() => remove(d)}><Trash2 size={16} color="var(--danger)" /></button>}
                </div>
              </div>
            ))}
          </div>
        )}

        {ocrText && (
          <div className="card" style={{ background: 'var(--bg)', marginTop: 8, whiteSpace: 'pre-wrap' }}>
            <div className="spread"><strong>نص OCR</strong><button className="btn-icon" onClick={() => setOcrText(null)}>×</button></div>
            <div className="hr" />{ocrText}
          </div>
        )}
      </div>
    </div>
  );
}
