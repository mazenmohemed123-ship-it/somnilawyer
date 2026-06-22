import { useState } from 'react';
import { Smartphone, Building2, Copy, Check, CreditCard, Loader2 } from 'lucide-react';
import { createCheckout } from '@/services/payments';
import type { Profile } from '@/types';

export function ClientPayment({ lawyer, caseId }: { lawyer: Profile | null; caseId: string | null }) {
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');

  function copy(value: string, key: string) {
    navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(''), 1500);
  }

  async function payCard() {
    const amt = Number(amount);
    if (!amt || amt <= 0) { alert('أدخل مبلغاً صحيحاً'); return; }
    setBusy(true);
    const res = await createCheckout({ kind: 'case_payment', amount: amt, currency: lawyer?.currency ?? 'EGP', case_id: caseId ?? undefined });
    setBusy(false);
    if (res.error) alert(res.error);
    else if (res.url) window.location.href = res.url;
  }

  return (
    <div style={{ padding: 16, maxWidth: 480, margin: '0 auto', width: '100%' }}>
      <h3 className="row" style={{ gap: 8, marginBottom: 14 }}><CreditCard size={20} /> الدفع</h3>

      <div className="col" style={{ gap: 12 }}>
        {lawyer?.vodafone_cash && (
          <PayRow icon={<Smartphone size={20} />} title="فودافون كاش" value={lawyer.vodafone_cash}
            action={<a className="btn btn-gold btn-sm" href={`tel:*9*7*${lawyer.vodafone_cash}%23`}>تحويل USSD</a>}
            onCopy={() => copy(lawyer.vodafone_cash!, 'vf')} copied={copied === 'vf'} />
        )}
        {lawyer?.instapay && (
          <PayRow icon={<Smartphone size={20} />} title="إنستاباي" value={lawyer.instapay}
            action={<a className="btn btn-gold btn-sm" href={`https://ipn.eg/S/${lawyer.instapay}`} target="_blank" rel="noreferrer">فتح إنستاباي</a>}
            onCopy={() => copy(lawyer.instapay!, 'ip')} copied={copied === 'ip'} />
        )}
        {lawyer?.bank_account && (
          <PayRow icon={<Building2 size={20} />} title="تحويل بنكي / IBAN" value={lawyer.bank_account}
            onCopy={() => copy(lawyer.bank_account!, 'bank')} copied={copied === 'bank'} />
        )}
        {lawyer?.payment_qr_url && (
          <div className="card" style={{ textAlign: 'center' }}>
            <img src={lawyer.payment_qr_url} alt="QR" style={{ maxWidth: 200 }} />
          </div>
        )}

        <div className="card col">
          <strong className="row" style={{ gap: 8 }}><CreditCard size={18} /> الدفع بالبطاقة</strong>
          <input className="input num" type="number" dir="ltr" placeholder="المبلغ" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <button className="btn btn-primary btn-block" onClick={payCard} disabled={busy}>
            {busy ? <Loader2 size={18} className="spin" /> : <CreditCard size={18} />} ادفع بالبطاقة
          </button>
        </div>
      </div>
    </div>
  );
}

function PayRow({ icon, title, value, action, onCopy, copied }: {
  icon: JSX.Element; title: string; value: string; action?: JSX.Element; onCopy: () => void; copied: boolean;
}) {
  return (
    <div className="card spread" style={{ flexWrap: 'wrap', gap: 8 }}>
      <div className="row" style={{ gap: 10 }}>
        <span style={{ color: 'var(--navy)' }}>{icon}</span>
        <div><div style={{ fontWeight: 600 }}>{title}</div><div className="num muted" style={{ fontSize: 13 }}>{value}</div></div>
      </div>
      <div className="row" style={{ gap: 6 }}>
        <button className="btn btn-ghost btn-sm" onClick={onCopy}>{copied ? <Check size={15} color="var(--success)" /> : <Copy size={15} />}</button>
        {action}
      </div>
    </div>
  );
}
