// Somni Avocate — paymob-webhook edge function
// Verifies HMAC, updates payment status, upgrades tier / records case payment,
// and increments coupon usage on success.
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const HMAC_SECRET = Deno.env.get('PAYMOB_HMAC_SECRET') ?? '';

// Paymob HMAC = HMAC-SHA512 over a fixed-order concatenation of fields.
const HMAC_FIELDS = [
  'amount_cents', 'created_at', 'currency', 'error_occured', 'has_parent_transaction',
  'id', 'integration_id', 'is_3d_secure', 'is_auth', 'is_capture', 'is_refunded',
  'is_standalone_payment', 'is_voided', 'order.id', 'owner', 'pending',
  'source_data.pan', 'source_data.sub_type', 'source_data.type', 'success',
];

function getPath(obj: any, path: string) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

async function verifyHmac(obj: any, received: string): Promise<boolean> {
  if (!HMAC_SECRET) return true; // allow in sandbox if not configured
  const concat = HMAC_FIELDS.map((f) => String(getPath(obj, f) ?? '')).join('');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(HMAC_SECRET), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(concat));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex === received;
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const hmac = url.searchParams.get('hmac') ?? '';
    const payload = await req.json();
    const obj = payload.obj ?? payload;

    if (!(await verifyHmac(obj, hmac))) return new Response('invalid hmac', { status: 401 });

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const orderId = String(obj.order?.id ?? '');
    const success = obj.success === true || obj.success === 'true';

    const { data: payment } = await supabase.from('payments').select('*').eq('provider_ref', orderId).maybeSingle();
    if (!payment) return new Response('ok', { status: 200 });

    if (!success) {
      await supabase.from('payments').update({ status: 'failed' }).eq('id', payment.id);
      return new Response('ok', { status: 200 });
    }

    await supabase.from('payments').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', payment.id);

    if (payment.kind === 'subscription' && payment.tier) {
      const expires = new Date(Date.now() + (payment.months ?? 1) * 30 * 86400000).toISOString();
      await supabase.from('profiles').update({ tier: payment.tier, tier_expires_at: expires }).eq('id', payment.lawyer_id);
    } else if (payment.kind === 'case_payment' && payment.case_id) {
      await supabase.from('case_events').insert({
        case_id: payment.case_id, lawyer_id: payment.lawyer_id, kind: 'payment',
        title: 'دفعة مستلمة', body: `${payment.amount} ${payment.currency}`,
      });
    }

    if (payment.coupon_code) {
      await supabase.rpc('increment_coupon', { p_code: payment.coupon_code }).then(
        () => {},
        async () => {
          const { data: c } = await supabase.from('coupons').select('used_count').eq('code', payment.coupon_code).maybeSingle();
          if (c) await supabase.from('coupons').update({ used_count: (c.used_count ?? 0) + 1 }).eq('code', payment.coupon_code);
        }
      );
    }

    return new Response('ok', { status: 200 });
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
});
