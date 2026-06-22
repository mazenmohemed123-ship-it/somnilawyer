// Somni Lawyer — ai-tools edge function
// HF token stays server-side. Daily caps per user via ai_usage_daily.
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const HF_TOKEN = Deno.env.get('HF_TOKEN') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MODELS = {
  asr: 'openai/whisper-large-v3',
  summarize: 'csebuetnlp/mT5_multilingual_XLSum',
  chat: 'mistralai/Mistral-7B-Instruct-v0.3',
  ocr: 'microsoft/trocr-large-printed',
};

const DAILY_LIMITS: Record<string, number> = { chat: 40, summarize: 40, asr: 20, ocr: 30 };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return json({ error: 'unauthorized' }, 401);

    const body = await req.json();
    const task = body.task as keyof typeof MODELS;
    if (!MODELS[task]) return json({ error: 'unknown task' }, 400);

    // Tier gate.
    const { data: profile } = await supabase.from('profiles').select('tier, role').eq('id', user.id).single();
    const tier = profile?.tier ?? 'free';
    if (tier === 'free') return json({ error: 'الذكاء الاصطناعي متاح في باقتي احترافي والفريق' }, 403);
    if (task === 'chat' && !(tier === 'team' && ['owner', 'lawyer', 'partner'].includes(profile?.role))) {
      return json({ error: 'المساعد القانوني متاح لباقة الفريق (المحامون فقط)' }, 403);
    }

    // Daily cap.
    const today = new Date().toISOString().slice(0, 10);
    const { data: usage } = await supabase.from('ai_usage_daily').select('count').eq('user_id', user.id).eq('day', today).eq('task', task).maybeSingle();
    const used = usage?.count ?? 0;
    if (used >= (DAILY_LIMITS[task] ?? 20)) return json({ error: 'تجاوزت الحد اليومي لهذه الأداة' }, 429);

    if (!HF_TOKEN) return json({ error: 'HF_TOKEN غير مضبوط على السيرفر' }, 500);

    let result = '';
    if (task === 'asr' || task === 'ocr') {
      const b64 = task === 'asr' ? body.audio : body.image;
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const res = await fetch(`https://api-inference.huggingface.co/models/${MODELS[task]}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${HF_TOKEN}`, 'Content-Type': body.mime || 'application/octet-stream' },
        body: bytes,
      });
      const out = await res.json();
      result = out.text ?? (Array.isArray(out) ? out[0]?.generated_text : '') ?? JSON.stringify(out);
    } else if (task === 'summarize') {
      const res = await fetch(`https://api-inference.huggingface.co/models/${MODELS.summarize}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: body.text, parameters: { max_length: 220 } }),
      });
      const out = await res.json();
      result = Array.isArray(out) ? (out[0]?.summary_text ?? out[0]?.generated_text ?? '') : (out.summary_text ?? JSON.stringify(out));
    } else if (task === 'chat') {
      const messages = body.messages ?? [];
      const prompt = '[INST] أنت مساعد قانوني عربي محترف. أجب بدقة وإيجاز.\n\n' +
        messages.map((m: any) => `${m.role === 'user' ? 'سؤال' : 'إجابة'}: ${m.content}`).join('\n') + ' [/INST]';
      const res = await fetch(`https://api-inference.huggingface.co/models/${MODELS.chat}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 512, return_full_text: false } }),
      });
      const out = await res.json();
      result = Array.isArray(out) ? (out[0]?.generated_text ?? '') : (out.generated_text ?? JSON.stringify(out));
    }

    // Increment usage.
    await supabase.from('ai_usage_daily').upsert(
      { user_id: user.id, day: today, task, count: used + 1 },
      { onConflict: 'user_id,day,task' }
    );

    return json({ result, remaining: (DAILY_LIMITS[task] ?? 20) - used - 1 });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
