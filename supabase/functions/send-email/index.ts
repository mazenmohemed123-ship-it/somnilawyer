// مُحكَم — send-email edge function
// Thin wrapper over Resend (set RESEND_API_KEY). Graceful if unconfigured.
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM = Deno.env.get('EMAIL_FROM') ?? 'Mohkam <no-reply@mohkam.app>';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    if (!RESEND_API_KEY) return json({ ok: false, reason: 'RESEND_API_KEY غير مضبوط' });
    const { to, subject, html } = await req.json();
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    return json({ ok: res.ok, status: res.status });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
