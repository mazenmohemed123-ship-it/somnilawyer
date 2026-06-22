import { useRef, useState } from 'react';
import { Mic, MicOff, Save, Loader2, FileAudio, Wand2, Lock } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { transcribeAudio } from '@/services/ai';
import { canUseAI } from '@/lib/permissions';

// Naive Arabic field extractor from free text.
function extractFields(text: string) {
  const out: Record<string, string> = {};
  const num = text.match(/(?:رقم(?:\s+القضية)?|قضية)\s*[:\-]?\s*([0-9\/\-]+)/);
  if (num) out.case_number = num[1];
  const phone = text.match(/(01[0-9]{9}|\+?[0-9]{8,15})/);
  if (phone) out.client_phone = phone[1];
  const name = text.match(/(?:الموكل|اسم الموكل|العميل)\s*[:\-]?\s*([؀-ۿ\s]{3,30})/);
  if (name) out.client_name = name[1].trim();
  const type = text.match(/(?:نوع القضية|القضية)\s*[:\-]?\s*([؀-ۿ\s]{3,30})/);
  if (type) out.case_type = type[1].trim();
  const fees = text.match(/(?:الأتعاب|أتعاب)\s*[:\-]?\s*([0-9]+)/);
  if (fees) out.fees = fees[1];
  return out;
}

export function VoiceTab() {
  const { profile } = useAuth();
  const toast = useToast();
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const recogRef = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const ownerId = profile?.master_lawyer_id ?? profile?.id ?? '';
  const aiAllowed = canUseAI(profile);

  function toggleListen() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast('متصفحك لا يدعم التعرف على الكلام. استخدم التفريغ بالذكاء أو الكتابة.', 'danger'); return; }
    if (listening) { recogRef.current?.stop(); setListening(false); return; }
    const r = new SR();
    r.lang = 'ar-EG';
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e: any) => {
      let chunk = '';
      for (let i = e.resultIndex; i < e.results.length; i++) chunk += e.results[i][0].transcript;
      setText((prev) => prev + ' ' + chunk);
    };
    r.onend = () => setListening(false);
    r.start();
    recogRef.current = r;
    setListening(true);
  }

  function analyze() {
    const f = extractFields(text);
    setFields(f);
    if (Object.keys(f).length === 0) toast('لم يتم استخراج حقول. عدّلها يدوياً.', 'info');
  }

  async function whisper(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const res = await transcribeAudio(file);
      if (res.error) toast(res.error, 'danger');
      else { setText((p) => (p ? p + '\n' : '') + res.result); toast('تم التفريغ', 'success'); }
    } finally {
      setBusy(false);
    }
  }

  async function saveCase() {
    const f = Object.keys(fields).length ? fields : extractFields(text);
    setBusy(true);
    const { error } = await supabase.from('cases').insert({
      lawyer_id: ownerId,
      case_number: f.case_number ?? '',
      client_name: f.client_name ?? '',
      client_phone: f.client_phone ?? null,
      case_type: f.case_type ?? null,
      fees: f.fees ? Number(f.fees) : null,
      extra: {},
    });
    setBusy(false);
    if (error) toast(error.message, 'danger');
    else { toast('تم حفظ القضية', 'success'); setText(''); setFields({}); }
  }

  return (
    <div style={{ padding: 18 }}>
      <h2 style={{ marginBottom: 16 }}>التسجيل الصوتي وإضافة قضية</h2>
      <div className="card col" style={{ gap: 14, maxWidth: 720 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className={`btn ${listening ? 'btn-danger' : 'btn-primary'}`} onClick={toggleListen}>
            {listening ? <MicOff size={18} /> : <Mic size={18} />}
            {listening ? 'إيقاف' : 'بدء الإملاء الصوتي'}
          </button>
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={!aiAllowed || busy} title={aiAllowed ? '' : 'متاح في باقتي احترافي والفريق'}>
            {aiAllowed ? <FileAudio size={18} /> : <Lock size={18} />}
            تفريغ صوتي بالذكاء (Whisper)
          </button>
          <input ref={fileRef} type="file" accept="audio/*" hidden onChange={whisper} />
        </div>

        <textarea className="input" rows={6} placeholder="انطق أو اكتب تفاصيل القضية… مثال: رقم القضية 1234/2024 الموكل أحمد محمد الهاتف 01000000000 نوع القضية مدني الأتعاب 5000" value={text} onChange={(e) => setText(e.target.value)} />

        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-gold" onClick={analyze}><Wand2 size={18} /> تحليل النص</button>
          <button className="btn btn-primary" onClick={saveCase} disabled={busy}>
            {busy ? <Loader2 size={18} className="spin" /> : <Save size={18} />} حفظ كقضية
          </button>
        </div>

        {Object.keys(fields).length > 0 && (
          <div className="card" style={{ background: 'var(--bg)' }}>
            <strong>الحقول المستخرجة (قابلة للتعديل):</strong>
            <div className="col" style={{ marginTop: 10 }}>
              {Object.entries(fields).map(([k, v]) => (
                <div key={k} className="row">
                  <span className="muted" style={{ width: 110, fontSize: 13 }}>{k}</span>
                  <input className="input" value={v} onChange={(e) => setFields({ ...fields, [k]: e.target.value })} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
