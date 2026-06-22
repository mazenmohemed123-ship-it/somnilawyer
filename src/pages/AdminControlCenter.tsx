import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Megaphone, Ticket, Users, TrendingUp, Loader2, Plus, Trash2, Snowflake, Sun, ArrowUpCircle, LogOut,
} from 'lucide-react';
import { collection, getDocs, query, where, orderBy, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
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
          <strong style={{ fontSize: 20, fontFamily: 'var(--font-head)' }}>لوحة التحكم — Somni Lawyer</strong>
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
  const [s, setS] = useState({ revenue: 0, free: 0, pro: 0, team: 0 });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const [paysSnap, profsSnap] = await Promise.all([
        getDocs(query(collection(db, 'payments'), where('status', '==', 'paid'))),
        getDocs(collection(db, 'users')),
      ]);
      const revenue = paysSnap.docs.reduce((a, d) => a + Number(d.data().amount || 0), 0);
      const lawyers = profsSnap.docs.map((d) => d.data() as Profile).filter((p) => p.role !== 'client' && p.role !== 'admin');
      const tally = (t: string) => lawyers.filter((p) => p.tier === t).length;
      setS({ revenue, free: tally('free'), pro: tally('pro'), team: tally('team') });
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
    await addDoc(collection(db, 'announcements'), { title, body, audience, created_at: new Date().toISOString() });
    setBusy(false);
    toast('تم إرسال الإعلان', 'success');
    setTitle('');
    setBody('');
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
  const [form, setForm] = useState({ code: '', percent: 20, max_uses: 50, tier: 'pro', expires_at: '' });
  async function load() {
    const snap = await getDocs(query(collection(db, 'coupons'), orderBy('created_at', 'desc')));
    setCoupons(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }
  useEffect(() => { load(); }, []);
  async function create() {
    if (!form.code.trim() || form.percent <= 0) return;
    await addDoc(collection(db, 'coupons'), { ...form, code: form.code.toUpperCase(), expires_at: form.expires_at || null, used_count: 0, created_at: new Date().toISOString() });
    toast('تم إنشاء الكوبون', 'success');
    setForm({ code: '', percent: 20, max_uses: 50, tier: 'pro', expires_at: '' });
    load();
  }
  async function remove(id: string) {
    await deleteDoc(doc(db, 'coupons', id));
    load();
  }
  return (
    <div className="col" style={{ gap: 14, maxWidth: 700 }}>
      <div style={glass()}>
        <h3 style={{ marginBottom: 10 }}>كوبون جديد</h3>
        <div className="col" style={{ gap: 10 }}>
          <div className="row" style={{ gap: 10 }}>
            <input className="input" style={{ flex: 1 }} placeholder="كود الكوبون (مثال: SUMMER20)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            <input className="input num" style={{ width: 80 }} type="number" min="1" max="100" placeholder="خصم %" value={form.percent} onChange={(e) => setForm({ ...form, percent: Number(e.target.value) })} />
          </div>
          <div className="row" style={{ gap: 10 }}>
            <select className="input" style={{ flex: 1 }} value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })}>
              <option value="pro">باقة احترافي ($20)</option>
              <option value="team">باقة الفريق ($50)</option>
            </select>
            <input className="input num" style={{ flex: 1 }} type="number" min="1" placeholder="حد أقصى استخدام" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: Number(e.target.value) })} />
          </div>
          <input className="input num" type="date" placeholder="تاريخ انتهاء (اختياري)" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
          <button className="btn btn-gold btn-block" onClick={create}><Plus size={16} /> إنشاء كوبون</button>
        </div>
      </div>

      <div style={glass()}>
        <h3 style={{ marginBottom: 10 }}>الكوبونات النشطة</h3>
        {coupons.length === 0 ? (
          <div className="muted" style={{ fontSize: 13 }}>لا توجد كوبونات حالياً</div>
        ) : (
          <div className="col" style={{ gap: 8 }}>
            {coupons.map((c) => {
              const used = c.used_count ?? 0;
              const percentage = Math.round((used / c.max_uses) * 100);
              return (
                <div key={c.id} style={{ padding: 10, background: 'var(--bg)', borderRadius: 8, borderLeft: '3px solid var(--gold-bright)' }}>
                  <div className="spread" style={{ marginBottom: 6 }}>
                    <span className="num" style={{ fontWeight: 700, fontSize: 14, color: 'var(--gold-bright)' }}>{c.code}</span>
                    <span className="num" style={{ fontSize: 12, color: 'var(--muted)' }}>{c.percent}% خصم</span>
                  </div>
                  <div className="spread" style={{ marginBottom: 6, fontSize: 12 }}>
                    <span className="muted">الاستخدامات: {used}/{c.max_uses}</span>
                    {c.expires_at && <span className="muted">{new Date(c.expires_at).toLocaleDateString('ar')}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ flex: 1, height: 6, background: 'rgba(212,175,55,.2)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${percentage}%`, background: 'var(--gold-bright)', transition: 'width 0.2s' }} />
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 30 }}>{percentage}%</span>
                  </div>
                  <button className="btn-icon" style={{ alignSelf: 'flex-end' }} onClick={() => remove(c.id)}><Trash2 size={14} color="var(--danger)" /></button>
                </div>
              );
            })}
          </div>
        )}
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
    // Firestore allows only a single "!=" per query, so fetch all and filter client-side.
    const snap = await getDocs(collection(db, 'users'));
    const rows = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Profile))
      .filter((p) => p.role !== 'client' && p.role !== 'admin')
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
    setList(rows);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);
  async function freeze(p: Profile, frozen: boolean) {
    await updateDoc(doc(db, 'users', p.id), { frozen } as any);
    toast(frozen ? 'تم التجميد' : 'تم فك التجميد', 'success');
    load();
  }
  async function upgrade(p: Profile) {
    const days = Number(prompt('عدد أيام الترقية إلى «الفريق»؟', '30') ?? '0');
    if (!days) return;
    const expires = new Date(Date.now() + days * 86400000).toISOString();
    await updateDoc(doc(db, 'users', p.id), { tier: 'team', tier_expires_at: expires });
    toast('تمت الترقية', 'success');
    load();
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
