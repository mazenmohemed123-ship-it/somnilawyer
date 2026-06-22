import { useState } from 'react';
import { Smartphone, Building2, Copy, Check, CreditCard, Loader2, Receipt } from 'lucide-react';
import { createCheckout, formatPrice } from '@/services/payments';
import type { Profile, CaseRow } from '@/types';

export function ClientPayment({ lawyer, caseId, matchedCase }: { lawyer: Profile | null; caseId: string | null; matchedCase?: CaseRow | null }) {
  const currency = lawyer?.currency ?? 'EGP';
  const fees = matchedCase?.fees ?? null;
  const expenses = matchedCase?.expenses ?? null;
  const totalDue = (fees ?? 0) + (expenses ?? 0);
  const [copied, setCopied] = useState('');

  function copy(value: string, key: string) {
    navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(''), 1500);
  }

  const hasPaymentMethods = lawyer?.vodafone_cash || lawyer?.instapay || lawyer?.bank_account || lawyer?.payment_qr_url;

  if (!hasPaymentMethods && totalDue === 0) {
    return (
      <div style={{ padding: 16, maxWidth: 480, margin: '0 auto', width: '100%' }}>
        <div className="card center-screen muted" style={{ minHeight: 300 }}>
          لم يتم تحديد طرق دفع حالياً. تواصل مع المحامي مباشرة.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 480, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h3 className="row" style={{ gap: 8 }}><Receipt size={20} color="var(--gold-bright)" /> الفاتورة</h3>

      {(fees !== null || expenses !== null || totalDue > 0) && (
        <div className="card col" style={{ gap: 10, background: 'rgba(212,175,55,.05)', borderLeft: '3px solid var(--gold-bright)' }}>
          {fees !== null && (
            <div className="spread" style={{ paddingBottom: 8 }}>
              <span className="muted">الأتعاب:</span>
              <span className="num" style={{ fontWeight: 700, fontSize: 15 }}>{formatPrice(fees, currency)}</span>
            </div>
          )}
          {expenses !== null && (
            <div className="spread" style={{ paddingBottom: 8 }}>
              <span className="muted">المصاريف:</span>
              <span className="num" style={{ fontWeight: 700, fontSize: 15 }}>{formatPrice(expenses, currency)}</span>
            </div>
          )}
          {totalDue > 0 && (
            <div className="spread" style={{ borderTop: '1px solid var(--border)', paddingTop: 10, background: 'rgba(0,0,0,.02)', padding: '10px 10px', borderRadius: 8, marginTop: 6 }}>
              <strong style={{ color: 'var(--navy)' }}>الإجمالي المستحق:</strong>
              <strong className="num" style={{ color: 'var(--gold-bright)', fontSize: 18 }}>{formatPrice(totalDue, currency)}</strong>
            </div>
          )}
        </div>
      )}

      {hasPaymentMethods && (
        <>
          <h3 className="row" style={{ gap: 8 }}><Smartphone size={20} color="var(--navy)" /> طرق الدفع</h3>
          <div className="col" style={{ gap: 10 }}>
            {lawyer?.vodafone_cash && (
              <PayRow
                icon={<Smartphone size={20} />}
                title="فودافون كاش"
                value={lawyer.vodafone_cash}
                action={<a className="btn btn-gold btn-sm" href={`tel:*9*7*${lawyer.vodafone_cash}%23`} style={{ whiteSpace: 'nowrap' }}>اتصال</a>}
                onCopy={() => copy(lawyer.vodafone_cash!, 'vf')}
                copied={copied === 'vf'}
              />
            )}
            {lawyer?.instapay && (
              <PayRow
                icon={<Smartphone size={20} />}
                title="إنستاباي"
                value={lawyer.instapay}
                action={<a className="btn btn-gold btn-sm" href={`https://ipn.eg/S/${lawyer.instapay}`} target="_blank" rel="noreferrer" style={{ whiteSpace: 'nowrap' }}>فتح</a>}
                onCopy={() => copy(lawyer.instapay!, 'ip')}
                copied={copied === 'ip'}
              />
            )}
            {lawyer?.bank_account && (
              <PayRow
                icon={<Building2 size={20} />}
                title="تحويل بنكي"
                value={lawyer.bank_account}
                onCopy={() => copy(lawyer.bank_account!, 'bank')}
                copied={copied === 'bank'}
              />
            )}
            {lawyer?.payment_qr_url && (
              <div className="card" style={{ textAlign: 'center', padding: 16 }}>
                <img src={lawyer.payment_qr_url} alt="QR" style={{ maxWidth: 180, height: 'auto' }} />
              </div>
            )}
          </div>
        </>
      )}
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
