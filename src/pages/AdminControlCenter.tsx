import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Megaphone, Ticket, Users, TrendingUp, Loader2, Plus, Trash2, Snowflake, Sun, ArrowUpCircle, LogOut, Ban, CheckCircle,
} from 'lucide-react';
import { collection, getDocs, query, where, orderBy, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { tierLabel, roleLabel } from '@/lib/permissions';
import type { Profile } from '@/types';

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`__timeout__:${label}`)), ms)
    ),
  ]);
}

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
          <strong style={{ fontSize: 20, fontFamily: 'var(--font-head)' }}>لوحة التحكم — Somni Avocate</strong>
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
      try {
        const [paysSnap, profsSnap] = await Promise.all([
          withTimeout(getDocs(query(collection(db, 'payments'), where('status', '==', 'paid'))), 12000, 'loadPayments'),
          withTimeout(getDocs(collection(db, 'users')), 12000, 'loadUsers'),
        ]);
        const revenue = paysSnap.docs.reduce((a, d) => a + Number(d.data().amount || 0), 0);
        const lawyers = profsSnap.docs.map((d) => d.data() as Profile).filter((p) => p.role !== 'client' && p.role !== 'admin');
        const tally = (t: string) => lawyers.filter((p) => p.tier === t).length;
        setS({ revenue, free: tally('free'), pro: tally('pro'), team: tally('team') });
      } catch (err) {
        console.error('Failed to load stats:', err);
      } finally {
        setLoading(false);
      }
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
    try {
      await withTimeout(addDoc(collection(db, 'announcements'), { title, body, audience, created_at: new Date().toISOString() }), 12000, 'sendAnnouncement');
      toast('تم إرسال الإعلان', 'success');
      setTitle('');
      setBody('');
    } catch (err: any) {
      console.error('Send error:', err);
      toast('حدث خطأ - حاول مجدداً', 'danger');
    } finally {
      setBusy(false);
    }
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
  async function load() {
    try {
      const snap = await withTimeout(getDocs(query(collection(db, 'coupons'), orderBy('created_at', 'desc'))), 12000, 'loadCoupons');
      setCoupons(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Failed to load coupons:', err);
    }
  }
  useEffect(() => { load(); }, []);
  async function create() {
    if (!form.code.trim()) return;
    try {
      await withTimeout(addDoc(collection(db, 'coupons'), { ...form, code: form.code.toUpperCase(), expires_at: form.expires_at || null, used_count: 0, created_at: new Date().toISOString() }), 12000, 'createCoupon');
      toast('تم إنشاء الكوبون', 'success');
      setForm({ code: '', percent: 10, max_uses: 100, tier: 'pro', expires_at: '' });
      load();
    } catch (err: any) {
      console.error('Create error:', err);
      toast('حدث خطأ - حاول مجدداً', 'danger');
    }
  }
  async function remove(id: string) {
    try {
      await withTimeout(deleteDoc(doc(db, 'coupons', id)), 12000, 'deleteCoupon');
      load();
    } catch (err) {
      console.error('Delete error:', err);
    }
  }
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
  const [filter, setFilter] = useState<'all' | 'banned' | 'frozen'>('all');

  async function load() {
    setLoading(true);
    try {
      const snap = await withTimeout(getDocs(collection(db, 'users')), 12000, 'loadLawyers');
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Profile))
        .filter((p) => p.role !== 'client' && p.role !== 'admin')
        .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
      setList(rows);
    } catch (err) {
      console.error('Failed to load lawyers:', err);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function ban(p: Profile, banned: boolean) {
    const reason = banned ? prompt('سبب الحظر (اختياري):') ?? '' : '';
    try {
      await withTimeout(updateDoc(doc(db, 'users', p.id), {
        banned,
        banned_at: banned ? new Date().toISOString() : null,
        ban_reason: banned ? reason : null,
      } as any), 12000, 'banUser');
      toast(banned ? 'تم حظر المستخدم' : 'تم رفع الحظر', banned ? 'danger' : 'success');
      load();
    } catch (err: any) {
      console.error('Ban error:', err);
      toast('حدث خطأ - حاول مجدداً', 'danger');
    }
  }

  async function freeze(p: Profile, frozen: boolean) {
    try {
      await withTimeout(updateDoc(doc(db, 'users', p.id), { frozen } as any), 12000, 'freezeUser');
      toast(frozen ? 'تم التجميد' : 'تم فك التجميد', 'success');
      load();
    } catch (err: any) {
      console.error('Freeze error:', err);
      toast('حدث خطأ - حاول مجدداً', 'danger');
    }
  }

  async function upgrade(p: Profile) {
    const days = Number(prompt('عدد أيام الترقية إلى «الفريق»؟', '30') ?? '0');
    if (!days) return;
    try {
      const expires = new Date(Date.now() + days * 86400000).toISOString();
      await withTimeout(updateDoc(doc(db, 'users', p.id), { tier: 'team', tier_expires_at: expires }), 12000, 'upgradeUser');
      toast('تمت الترقية', 'success');
      load();
    } catch (err: any) {
      console.error('Upgrade error:', err);
      toast('حدث خطأ - حاول مجدداً', 'danger');
    }
  }

  const filtered = list
    .filter((p) => !q || (p.full_name ?? '').includes(q) || (p.email ?? '').includes(q))
    .filter((p) => {
      if (filter === 'banned') return (p as any).banned;
      if (filter === 'frozen') return (p as any).frozen && !(p as any).banned;
      return true;
    });

  const bannedCount = list.filter((p) => (p as any).banned).length;
  const frozenCount = list.filter((p) => (p as any).frozen && !(p as any).banned).length;

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <input className="input" style={{ maxWidth: 280 }} placeholder="بحث بالاسم أو البريد" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="row" style={{ gap: 6 }}>
          <button className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter('all')}>الكل ({list.length})</button>
          <button className={`btn btn-sm ${filter === 'banned' ? 'btn-danger' : 'btn-ghost'}`} onClick={() => setFilter('banned')} style={{ color: filter !== 'banned' ? 'var(--danger)' : undefined }}>
            <Ban size={14} /> محظورون ({bannedCount})
          </button>
          <button className={`btn btn-sm ${filter === 'frozen' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter('frozen')}>
            <Snowflake size={14} /> مجمدون ({frozenCount})
          </button>
        </div>
      </div>

      {loading ? <div className="center-screen"><Loader2 className="spin" color="var(--gold-bright)" /></div> : (
        <div style={glass()}>
          {filtered.length === 0 && <div className="muted">لا يوجد مستخدمون.</div>}
          {filtered.map((p) => {
            const isBanned = !!(p as any).banned;
            const isFrozen = !!(p as any).frozen;
            return (
              <div key={p.id} className="spread" style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 8, opacity: isBanned ? 0.7 : 1 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <strong style={{ color: isBanned ? 'var(--danger)' : undefined }}>{p.full_name || p.email}</strong>
                    {isBanned && <span className="badge badge-danger" style={{ fontSize: 11 }}><Ban size={10} /> محظور</span>}
                    {isFrozen && !isBanned && <span className="badge" style={{ fontSize: 11, background: 'rgba(99,179,237,.15)', color: '#63b3ed' }}><Snowflake size={10} /> مجمد</span>}
                  </div>
                  <div className="muted" style={{ fontSize: 13 }}>{p.email} — {roleLabel(p.role)} — <span className="badge badge-gold">{tierLabel(p.tier)}</span></div>
                  {isBanned && (p as any).ban_reason && (
                    <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 2 }}>السبب: {(p as any).ban_reason}</div>
                  )}
                </div>
                <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                  {!isBanned && (
                    <button className="btn btn-ghost btn-sm" onClick={() => upgrade(p)}><ArrowUpCircle size={15} /> ترقية</button>
                  )}
                  {!isBanned && (
                    isFrozen ? (
                      <button className="btn btn-ghost btn-sm" onClick={() => freeze(p, false)}><Sun size={15} /> فك التجميد</button>
                    ) : (
                      <button className="btn btn-ghost btn-sm" onClick={() => freeze(p, true)}><Snowflake size={15} /> تجميد</button>
                    )
                  )}
                  {isBanned ? (
                    <button className="btn btn-sm" style={{ background: 'rgba(34,197,94,.15)', color: 'var(--success)', border: '1px solid var(--success)' }} onClick={() => ban(p, false)}>
                      <CheckCircle size={15} /> رفع الحظر
                    </button>
                  ) : (
                    <button className="btn btn-sm btn-danger" onClick={() => ban(p, true)}>
                      <Ban size={15} /> حظر
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
