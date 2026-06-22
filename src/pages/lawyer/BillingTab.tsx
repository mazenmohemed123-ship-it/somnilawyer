import { useState } from 'react';
import { Save, Loader2, CheckCircle2, CreditCard } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { canViewBilling, tierLabel } from '@/lib/permissions';
import { PLANS, createCheckout } from '@/services/payments';

export function BillingTab() {
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [vodafone, setVodafone] = useState(profile?.vodafone_cash ?? '');
  const [instapay, setInstapay] = useState(profile?.instapay ?? '');
  const [bank, setBank] = useState(profile?.bank_account ?? '');
  const [busy, setBusy] = useState(false);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  if (!canViewBilling(profile)) {
    return <div className="center-screen muted">لا تملك صلاحية عرض الفوترة.</div>;
  }

  async function savePaymentInfo() {
    setBusy(true);
    const { error } = await supabase.from('profiles').update({ vodafone_cash: vodafone, instapay, bank_account: bank }).eq('id', profile!.id);
    setBusy(false);
    toast(error ? error.message : 'تم حفظ بيانات الدفع', error ? 'danger' : 'success');
    if (!error) refreshProfile();
  }

  async function upgrade(tier: 'pro' | 'team', price: number) {
    setUpgrading(tier);
    const res = await createCheckout({ kind: 'subscription', tier, amount: price, currency: profile?.currency ?? 'EGP', months: 1 });
    setUpgrading(null);
    if (res.error) toast(res.error, 'danger');
    else if (res.url) window.location.href = res.url;
    else toast('تعذّر بدء الدفع.', 'danger');
  }

  return (
    <div style={{ padding: 18 }}>
      <h2 style={{ marginBottom: 16 }}>الفوترة والدفع</h2>

      <div className="card col" style={{ maxWidth: 720, marginBottom: 20 }}>
        <h3>بيانات استقبال المدفوعات (تظهر للموكل)</h3>
        <div><label className="label">فودافون كاش</label><input className="input num" dir="ltr" value={vodafone} onChange={(e) => setVodafone(e.target.value)} /></div>
        <div><label className="label">إنستاباي</label><input className="input num" dir="ltr" value={instapay} onChange={(e) => setInstapay(e.target.value)} /></div>
        <div><label className="label">حساب بنكي / IBAN</label><input className="input num" dir="ltr" value={bank} onChange={(e) => setBank(e.target.value)} /></div>
        <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={savePaymentInfo} disabled={busy}>
          {busy ? <Loader2 size={18} className="spin" /> : <Save size={18} />} حفظ
        </button>
      </div>

      <h3 style={{ marginBottom: 12 }}>الباقات</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, maxWidth: 820 }}>
        {PLANS.map((p) => {
          const current = profile?.tier === p.tier;
          return (
            <div key={p.tier} className="card col" style={{ border: current ? '2px solid var(--gold)' : undefined }}>
              <div className="spread">
                <h3>{p.name}</h3>
                {current && <span className="badge badge-gold">الحالية</span>}
              </div>
              <div className="num" style={{ fontSize: 26, fontWeight: 800 }}>{p.price === 0 ? 'مجاني' : `${p.price} ج.م`}<span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>{p.price ? ' / شهر' : ''}</span></div>
              <div className="col" style={{ gap: 6 }}>
                {p.features.map((f) => <div key={f} className="row" style={{ gap: 6, fontSize: 13 }}><CheckCircle2 size={15} color="var(--success)" /> {f}</div>)}
              </div>
              {!current && p.tier !== 'free' && (
                <button className="btn btn-gold" onClick={() => upgrade(p.tier as 'pro' | 'team', p.price)} disabled={upgrading === p.tier}>
                  {upgrading === p.tier ? <Loader2 size={16} className="spin" /> : <CreditCard size={16} />} الترقية
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>باقتك الحالية: {tierLabel(profile?.tier ?? 'free')}</p>
    </div>
  );
}
