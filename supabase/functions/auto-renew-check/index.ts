// مُحكَم — auto-renew-check edge function
// Run on a schedule (cron). Downgrades expired tiers and clears expired admin upgrades.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const now = new Date().toISOString();

  const { data: expired } = await supabase
    .from('profiles')
    .select('id')
    .neq('tier', 'free')
    .not('tier_expires_at', 'is', null)
    .lt('tier_expires_at', now);

  let downgraded = 0;
  for (const p of expired ?? []) {
    await supabase.from('profiles').update({ tier: 'free', tier_expires_at: null }).eq('id', p.id);
    downgraded++;
  }

  return new Response(JSON.stringify({ ok: true, downgraded }), { headers: { 'Content-Type': 'application/json' } });
});
