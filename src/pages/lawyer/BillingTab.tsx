import { useState } from 'react';
import { Save, Loader2, CheckCircle2, CreditCard, Ticket } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { canViewBilling, tierLabel } from '@/lib/permissions';
import { PLANS, createCheckout, getPlanPrice, formatPrice } from '@/services/payments';

export function BillingTab() {
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [vodafone, setVodafone] = useState(profile?.vodafone_cash ?? '');
  const [instapay, setInstapay] = useState(profile?.instapay ?? '');
  const [bank, setBank] = useState(profile?.bank_account ?? '');
  const [busy, setBusy] = useState(false);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [coupon, setCoupon] = useState('');
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);

  if (!canViewBilling(profile)) {
    return <div className="center-screen muted">لا تملك صلاحية عرض الفوترة.</div>;
  }

  const currency = profile?.currency ?? 'EGP';

  async function savePaymentInfo() {
    setBusy(true);
    await updateDoc(doc(db, 'users', profile!.id), {
      vodafone_cash: vodafone, instapay, bank_account: bank,
    });
    setBusy(false);
    toast('تم حفظ بيانات الدفع', 'success');
    refreshProfile();
  }

  async function upgrade(tier: 'pro' | 'team') {
    setUpgrading(tier);
    const price = getPlanPrice(tier, currency);
    const res = await createCheckout({ kind: 'subscription', tier, amount: price, currency, months: 1, coupon: coupon.trim() || undefined });
    setUpgrading(null);
    if (res.error) toast(res.error, 'danger');
    else if (res.url) setIframeUrl(res.url); // open Paymob iframe in a modal
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

      <div className="card row" style={{ maxWidth: 820, marginBottom: 14, gap: 8, alignItems: 'center' }}>
        <Ticket size={18} color="var(--gold)" />
        <input
          className="input"
          style={{ maxWidth: 220 }}
          placeholder="كود الخصم (اختياري)"
          value={coupon}
          onChange={(e) => setCoupon(e.target.value.toUpperCase())}
        />
        <span className="muted" style={{ fontSize: 12 }}>أدخل الكوبون قبل الضغط على «الترقية» ليُطبَّق الخصم.</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, maxWidth: 820 }}>
        {PLANS.map((p) => {
          const current = profile?.tier === p.tier;
          const localPrice = p.usdPrice > 0 ? getPlanPrice(p.tier as 'pro' | 'team', currency) : 0;
          return (
            <div key={p.tier} className="card col" style={{ border: current ? '2px solid var(--gold)' : undefined }}>
              <div className="spread">
                <h3>{p.name}</h3>
                {current && <span className="badge badge-gold">الحالية</span>}
              </div>
              <div className="num" style={{ fontSize: 26, fontWeight: 800 }}>
                {p.usdPrice === 0 ? 'مجاني' : formatPrice(localPrice, currency)}
                {p.usdPrice > 0 && <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}> / شهر</span>}
              </div>
              {p.usdPrice > 0 && (
                <div className="muted" style={{ fontSize: 12 }}>≈ ${p.usdPrice} USD / شهر</div>
              )}
              <div className="col" style={{ gap: 6 }}>
                {p.features.map((f) => <div key={f} className="row" style={{ gap: 6, fontSize: 13 }}><CheckCircle2 size={15} color="var(--success)" /> {f}</div>)}
              </div>
              {!current && p.tier !== 'free' && (
                <button className="btn btn-gold" onClick={() => upgrade(p.tier as 'pro' | 'team')} disabled={upgrading === p.tier}>
                  {upgrading === p.tier ? <Loader2 size={16} className="spin" /> : <CreditCard size={16} />} الترقية
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>باقتك الحالية: {tierLabel(profile?.tier ?? 'free')}</p>

      {iframeUrl && (
        <Modal title="إتمام الدفع" onClose={() => { setIframeUrl(null); refreshProfile(); }} maxWidth={520}>
          <iframe
            src={iframeUrl}
            title="Paymob"
            style={{ width: '100%', height: 560, border: 'none', borderRadius: 8 }}
          />
        </Modal>
      )}
    </div>
  );
}
