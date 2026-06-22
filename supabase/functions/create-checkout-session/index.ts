// Somni Lawyer — create-checkout-session edge function (Paymob)
// Creates a pending payment row and returns a checkout URL.
// The amount arrives in the BASE unit; we multiply by 100 here (never on the frontend).
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PAYMOB_API_KEY = Deno.env.get('PAYMOB_API_KEY') ?? '';
const INTEGRATION_ID = Deno.env.get('PAYMOB_INTEGRATION_ID') ?? '';
const IFRAME_ID = Deno.env.get('PAYMOB_IFRAME_ID') ?? '';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const auth = req.headers.get('Authorization') ?? '';
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { headers: { Authorization: auth } } });
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return json({ error: 'unauthorized' }, 401);

    const { kind, amount, currency, tier, case_id, coupon, months } = await req.json();
    let finalAmount = Number(amount);

    // Apply coupon (read-only here; counter is incremented by the webhook on success).
    if (coupon) {
      const { data: c } = await supabase.from('coupons').select('*').eq('code', String(coupon).toUpperCase()).maybeSingle();
      if (c && (!c.expires_at || new Date(c.expires_at) > new Date()) && c.used_count < c.max_uses) {
        finalAmount = finalAmount * (1 - c.percent / 100);
      }
    }

    // Record pending payment.
    const { data: payment, error } = await supabase.from('payments').insert({
      lawyer_id: kind === 'subscription' ? u.user.id : null,
      payer_id: u.user.id,
      case_id: case_id ?? null,
      kind, tier: tier ?? null, amount: finalAmount, currency: currency ?? 'EGP',
      coupon_code: coupon ?? null, months: months ?? 1, status: 'pending',
    }).select('*').single();
    if (error) return json({ error: error.message }, 500);

    // Sandbox fallback: if Paymob isn't configured, return an in-app stub URL.
    if (!PAYMOB_API_KEY || !INTEGRATION_ID) {
      return json({ url: `${SUPABASE_URL}/checkout/sandbox?payment=${payment.id}`, payment_id: payment.id, sandbox: true });
    }

    // 1) Auth token
    const t = await (await fetch('https://accept.paymob.com/api/auth/tokens', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: PAYMOB_API_KEY }),
    })).json();

    // 2) Order
    const order = await (await fetch('https://accept.paymob.com/api/ecommerce/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auth_token: t.token, delivery_needed: false, amount_cents: Math.round(finalAmount * 100), currency: currency ?? 'EGP', items: [] }),
    })).json();

    // 3) Payment key
    const pk = await (await fetch('https://accept.paymob.com/api/acceptance/payment_keys', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: t.token,
        amount_cents: Math.round(finalAmount * 100),
        expiration: 3600,
        order_id: order.id,
        currency: currency ?? 'EGP',
        integration_id: Number(INTEGRATION_ID),
        billing_data: {
          email: u.user.email ?? 'client@somnilawyer.app', first_name: 'Somni Lawyer', last_name: 'Client',
          phone_number: '+200000000000', apartment: 'NA', floor: 'NA', street: 'NA', building: 'NA',
          shipping_method: 'NA', postal_code: 'NA', city: 'NA', country: 'EG', state: 'NA',
        },
      }),
    })).json();

    await supabase.from('payments').update({ provider_ref: String(order.id) }).eq('id', payment.id);

    const url = `https://accept.paymob.com/api/acceptance/iframes/${IFRAME_ID}?payment_token=${pk.token}`;
    return json({ url, payment_id: payment.id });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
