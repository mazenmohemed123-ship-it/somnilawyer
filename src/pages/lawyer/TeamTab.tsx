import { useEffect, useState } from 'react';
import { UserPlus, Loader2, Save, Link as LinkIcon } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { roleLabel } from '@/lib/permissions';
import type { Profile, Role } from '@/types';

const STAFF_ROLES: Role[] = ['partner', 'lawyer', 'assistant', 'secretary', 'accountant'];
const PERMS: { key: keyof Profile; label: string }[] = [
  { key: 'can_view_billing', label: 'عرض الفوترة' },
  { key: 'can_manage_appointments', label: 'إدارة المواعيد' },
  { key: 'can_edit_documents', label: 'تعديل المستندات' },
  { key: 'can_reply_client_chats', label: 'الرد على الموكلين' },
];

export function TeamTab() {
  const { profile } = useAuth();
  const toast = useToast();
  const ownerId = profile?.id ?? '';
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('secretary');
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase.from('profiles').select('*').eq('master_lawyer_id', ownerId);
    setMembers((data ?? []) as Profile[]);
    setLoading(false);
  }
  useEffect(() => { if (ownerId) load(); /* eslint-disable-next-line */ }, [ownerId]);

  async function linkMember() {
    if (!email.trim()) return;
    setBusy(true);
    // Link an existing account (who already signed up) to this office by email.
    const { data: target, error: findErr } = await supabase.from('profiles').select('id').eq('email', email.trim().toLowerCase()).maybeSingle();
    if (findErr || !target) {
      toast('لم يتم العثور على حساب بهذا البريد. اطلب من العضو إنشاء حساب أولاً.', 'danger');
      setBusy(false);
      return;
    }
    const { error } = await supabase.from('profiles').update({ master_lawyer_id: ownerId, role, tier: profile?.tier ?? 'team' }).eq('id', target.id);
    setBusy(false);
    if (error) toast(error.message, 'danger');
    else { toast('تمت إضافة العضو', 'success'); setEmail(''); load(); }
  }

  async function updateMember(m: Profile, patch: Partial<Profile>) {
    await supabase.from('profiles').update(patch).eq('id', m.id);
    setMembers((prev) => prev.map((x) => x.id === m.id ? { ...x, ...patch } : x));
  }

  async function removeMember(m: Profile) {
    if (!confirm('إزالة العضو من المكتب؟')) return;
    await supabase.from('profiles').update({ master_lawyer_id: null }).eq('id', m.id);
    load();
  }

  return (
    <div style={{ padding: 18 }}>
      <h2 style={{ marginBottom: 16 }}>إدارة الفريق</h2>

      <div className="card col" style={{ maxWidth: 720, marginBottom: 20 }}>
        <h3 className="row" style={{ gap: 8 }}><UserPlus size={18} /> إضافة عضو</h3>
        <p className="muted" style={{ fontSize: 13 }}>اطلب من العضو إنشاء حساب على «مُحكَم» أولاً، ثم اربطه ببريده هنا.</p>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input className="input" style={{ flex: 1, minWidth: 200 }} dir="ltr" placeholder="staff@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select className="input" style={{ maxWidth: 160 }} value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {STAFF_ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
          </select>
          <button className="btn btn-primary" onClick={linkMember} disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : <LinkIcon size={16} />} ربط
          </button>
        </div>
      </div>

      {loading ? (
        <div className="center-screen"><Loader2 className="spin" /></div>
      ) : members.length === 0 ? (
        <div className="card muted center-screen">لا أعضاء بعد.</div>
      ) : (
        <div className="col" style={{ gap: 12, maxWidth: 820 }}>
          {members.map((m) => (
            <div key={m.id} className="card">
              <div className="spread" style={{ flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <strong>{m.full_name || m.email}</strong>
                  <div className="muted" style={{ fontSize: 13 }}>{m.email}</div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <select className="input btn-sm" value={m.role} onChange={(e) => updateMember(m, { role: e.target.value as Role })}>
                    {STAFF_ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                  </select>
                  <button className="btn btn-danger btn-sm" onClick={() => removeMember(m)}>إزالة</button>
                </div>
              </div>
              <div className="hr" />
              <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
                {PERMS.map((p) => (
                  <label key={p.key as string} className="row" style={{ gap: 6, fontSize: 13 }}>
                    <input type="checkbox" checked={Boolean(m[p.key])} onChange={(e) => updateMember(m, { [p.key]: e.target.checked } as Partial<Profile>)} />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
