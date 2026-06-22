import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Megaphone, Ticket, Users, TrendingUp, Loader2, Plus, Trash2, Snowflake, Sun, ArrowUpCircle, LogOut,
} from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { tierLabel, roleLabel } from '@/lib/permissions';
import type { Profile } from '@/types';

type Section = 'stats' | 'broadcast' | 'coupons' | 'lawyers';

export function AdminControlCenter() {
  const { signOut } = useAuth();
  const nav = useNavigate();
  const [section, setSection] = useState<Section>('stats');

  return (
    <div className="theme-admin" style={{ minHeight: '100vh', background: 'radial-gradient(1200px 600px at 80% -10%, rgba(212,175,55,.10), transparent), var(--bg)', color: 'var(--text)' }}>
      <header className="spread" style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
        <div className="row" style={{ gap: 10 }}>
          <Shield size={24} color="var(--gold-bright)" />
          <strong style={{ fontSize: 20, fontFamily: 'var(--font-head)' }}>لوحة التحكم — مُحكَم</strong>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={async () => { await signOut(); nav('/'); }}><LogOut size={16} /> خروج</button>
      </header>

      <div className="row" style={{ gap: 8, padding: '14px 20px', flexWrap: 'wrap' }}>
        {([['stats', 'الإحصائيات', <TrendingUp size={16} />], ['broadcast', 'إعلان', <Megaphone size={16} />], ['coupons', 'الكوبونات', <Ticket size={16} />], ['lawyers', 'المحامون', <Users size={16} />]] as const).map(([k, label, icon]) => (
          <button key={k} className={`btn btn-sm ${section === k ? 'btn-gold' : 'btn-ghost'}`} onClick={() => setSection(k as Section)}>{icon} {label}</button>
        ))}
      </div>

      <div style={{ padding: '0 20px 40px' }}>
        {section === 'stats' && <Stats />}
        {section === 'broadcast' && <Broadcast />}
        {section === 'coupons' && <Coupons />}
        {section === 'lawyers' && <Lawyers />}
      </div>
    </div>
  );
}

function glass(): React.CSSProperties {
  return { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, backdropFilter: 'blur(8px)' };
}

function Stats() {
  const [s, setS] = useState({ revenue: 0, free: 0, pro: 0, team: 0, debt: 0 });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const [{ data: pays }, { data: profiles }] = await Promise.all([
        supabase.from('payments').select('amount,status').eq('status', 'paid'),
        supabase.from('profiles').select('tier,role'),
      ]);
      const revenue = (pays ?? []).reduce((a, p) => a + Number(p.amount || 0), 0);
      const lawyers = (profiles ?? []).filter((p) => p.role !== 'client' && p.role !== 'admin');
      const tally = (t: string) => lawyers.filter((p) => p.tier === t).length;
      setS({ revenue, free: tally('free'), pro: tally('pro'), team: tally('team'), debt: 0 });
      setLoading(false);
    })();
  }, []);
  if (loading) return <div className="center-screen"><Loader2 className="spin" color="var(--gold-bright)" /></div>;
  const cards = [
    { label: 'الإيرادات', value: `${s.revenue.toLocaleString()} ج.م` },
    { label: 'باقة مجاني', value: s.free },
    { label: 'باقة احترافي', value: s.pro },
    { label: 'باقة الفريق', value: s.team },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 14 }}>
      {cards.map((c) => (
        <div key={c.label} style={glass()}>
          <div className="muted" style={{ fontSize: 13 }}>{c.label}</div>
          <div className="num" style={{ fontSize: 28, fontWeight: 800, color: 'var(--gold-bright)' }}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

function Broadcast() {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'all' | 'lawyers'>('all');
  const [busy, setBusy] = useState(false);
  async function send() {
    if (!title.trim() || !body.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc('post_announcement', { p_title: title, p_body: body, p_audience: audience });
    setBusy(false);
    if (error) toast(error.message, 'danger');
    else { toast('تم إرسال الإعلان', 'success'); setTitle(''); setBody(''); }
  }
  return (
    <div style={{ ...glass(), maxWidth: 560 }}>
      <h3 style={{ marginBottom: 14 }}>إرسال إعلان</h3>
      <div className="col">
        <input className="input" placeholder="العنوان" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="input" rows={4} placeholder="النص" value={body} onChange={(e) => setBody(e.target.value)} />
        <select className="input" value={audience} onChange={(e) => setAudience(e.target.value as any)}>
          <option value="all">كل المستخدمين</option>
          <option value="lawyers">المحامون فقط</option>
        </select>
        <button className="btn btn-gold" onClick={send} disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Megaphone size={16} />} إرسال</button>
      </div>
    </div>
  );
}

function Coupons() {
  const toast = useToast();
  const [coupons, setCoupons] = useState<any[]>([]);
  const [form, setForm] = useState({ code: '', percent: 10, max_uses: 100, tier: 'pro', expires_at: '' });
  async function load() { const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false }); setCoupons(data ?? []); }
  useEffect(() => { load(); }, []);
  async function create() {
    if (!form.code.trim()) return;
    const { error } = await supabase.from('coupons').insert({ ...form, code: form.code.toUpperCase(), expires_at: form.expires_at || null });
    if (error) toast(error.message, 'danger');
    else { toast('تم إنشاء الكوبون', 'success'); setForm({ code: '', percent: 10, max_uses: 100, tier: 'pro', expires_at: '' }); load(); }
  }
  async function remove(id: string) { await supabase.from('coupons').delete().eq('id', id); load(); }
  return (
    <div className="col" style={{ gap: 16, maxWidth: 720 }}>
      <div style={glass()}>
        <h3 style={{ marginBottom: 12 }}>كوبون جديد</h3>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input className="input" style={{ width: 140 }} placeholder="الكود" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <input className="input num" style={{ width: 90 }} type="number" placeholder="%" value={form.percent} onChange={(e) => setForm({ ...form, percent: Number(e.target.value) })} />
          <input className="input num" style={{ width: 110 }} type="number" placeholder="استخدامات" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: Number(e.target.value) })} />
          <select className="input" style={{ width: 120 }} value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })}>
            <option value="pro">احترافي</option><option value="team">الفريق</option>
          </select>
          <input className="input num" type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
          <button className="btn btn-gold" onClick={create}><Plus size={16} /> إنشاء</button>
        </div>
      </div>
      <div style={glass()}>
        {coupons.length === 0 ? <div className="muted">لا كوبونات.</div> : coupons.map((c) => (
          <div key={c.id} className="spread" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <div className="row" style={{ gap: 10 }}><span className="num" style={{ fontWeight: 700, color: 'var(--gold-bright)' }}>{c.code}</span><span className="muted num">{c.percent}% — {c.used_count ?? 0}/{c.max_uses}</span></div>
            <button className="btn-icon" onClick={() => remove(c.id)}><Trash2 size={16} color="var(--danger)" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Lawyers() {
  const toast = useToast();
  const [list, setList] = useState<Profile[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').neq('role', 'client').neq('role', 'admin').order('created_at', { ascending: false });
    setList((data ?? []) as Profile[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);
  async function freeze(p: Profile, frozen: boolean) {
    await supabase.from('profiles').update({ frozen } as any).eq('id', p.id);
    toast(frozen ? 'تم التجميد' : 'تم فك التجميد', 'success'); load();
  }
  async function upgrade(p: Profile) {
    const days = Number(prompt('عدد أيام الترقية إلى «الفريق»؟', '30') ?? '0');
    if (!days) return;
    const expires = new Date(Date.now() + days * 86400000).toISOString();
    await supabase.from('profiles').update({ tier: 'team', tier_expires_at: expires }).eq('id', p.id);
    toast('تمت الترقية', 'success'); load();
  }
  const filtered = list.filter((p) => !q || (p.full_name ?? '').includes(q) || (p.email ?? '').includes(q));
  return (
    <div className="col" style={{ gap: 14 }}>
      <input className="input" style={{ maxWidth: 320 }} placeholder="بحث بالاسم أو البريد" value={q} onChange={(e) => setQ(e.target.value)} />
      {loading ? <div className="center-screen"><Loader2 className="spin" color="var(--gold-bright)" /></div> : (
        <div style={glass()}>
          {filtered.map((p) => (
            <div key={p.id} className="spread" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <strong>{p.full_name || p.email}</strong>
                <div className="muted" style={{ fontSize: 13 }}>{p.email} — {roleLabel(p.role)} — <span className="badge badge-gold">{tierLabel(p.tier)}</span></div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => upgrade(p)}><ArrowUpCircle size={15} /> ترقية</button>
                {(p as any).frozen ? (
                  <button className="btn btn-ghost btn-sm" onClick={() => freeze(p, false)}><Sun size={15} /> فك</button>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={() => freeze(p, true)}><Snowflake size={15} /> تجميد</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
