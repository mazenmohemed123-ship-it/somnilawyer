import { useRef, useState } from 'react';
import { Mic, Square, Save, Loader2, FileAudio, Wand2, Lock, Plus } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { transcribeAudio } from '@/services/ai';
import { canUseAI } from '@/lib/permissions';

const FIELD_LABELS: Record<string, string> = {
  case_number: 'رقم القضية',
  client_name: 'اسم الموكل',
  client_phone: 'الهاتف',
  case_type: 'نوع القضية',
  verdict: 'الحكم',
  fees: 'الأتعاب',
  expenses: 'المصاريف',
};

function extractFields(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const t = ' ' + text.replace(/\s+/g, ' ').trim() + ' ';

  const num = t.match(/(?:رقم\s*(?:القضي[ةه])?|قضي[ةه])\s*(?:رقم)?\s*[:\-]?\s*([0-9٠-٩][0-9٠-٩\/\-]{0,15})/);
  if (num) out.case_number = toLatinDigits(num[1]);

  const phone = t.match(/((?:\+?2)?01[0-9٠-٩]{9}|\+?[0-9٠-٩]{8,15})/);
  if (phone) out.client_phone = toLatinDigits(phone[1]);

  const name = t.match(/(?:اسم\s*الموكل|الموكل|العميل|المدّ?عي|اسم)\s*[:\-]?\s*([ء-ي][ء-ي\s]{2,28}?)(?=\s*(?:الهاتف|رقم|نوع|الأتعاب|أتعاب|المصاريف|الحكم|$))/);
  if (name) out.client_name = name[1].trim();

  const type = t.match(/(?:نوع\s*القضي[ةه]|القضي[ةه]\s*نوعها|قضي[ةه])\s*[:\-]?\s*([ء-ي][ء-ي\s]{2,24}?)(?=\s*(?:رقم|الموكل|الهاتف|الأتعاب|المصاريف|الحكم|$))/);
  if (type) out.case_type = type[1].trim();

  const verdict = t.match(/(?:الحكم|حكم)\s*[:\-]?\s*([ء-ي][ء-ي\s]{2,28}?)(?=\s*(?:رقم|الموكل|الهاتف|الأتعاب|المصاريف|نوع|$))/);
  if (verdict) out.verdict = verdict[1].trim();

  const fees = t.match(/(?:الأتعاب|أتعاب|اتعاب)\s*[:\-]?\s*([0-9٠-٩]+)/);
  if (fees) out.fees = toLatinDigits(fees[1]);

  const exp = t.match(/(?:المصاريف|مصاريف|مصروفات)\s*[:\-]?\s*([0-9٠-٩]+)/);
  if (exp) out.expenses = toLatinDigits(exp[1]);

  return out;
}

function toLatinDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

export function VoiceTab() {
  const { profile } = useAuth();
  const toast = useToast();
  const [text, setText] = useState('');
  const [interim, setInterim] = useState('');
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const recogRef = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const ownerId = profile?.master_lawyer_id ?? profile?.id ?? '';
  const aiAllowed = canUseAI(profile);

  function startListen() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast('متصفحك لا يدعم التعرف على الكلام.', 'danger'); return; }
    const r = new SR();
    r.lang = 'ar-EG';
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e: any) => {
      let finalChunk = '';
      let live = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalChunk += res[0].transcript;
        else live += res[0].transcript;
      }
      if (finalChunk) setText((prev) => (prev ? prev + ' ' : '') + finalChunk.trim());
      setInterim(live);
    };
    r.onerror = () => { setListening(false); setInterim(''); };
    r.onend = () => {
      setListening(false);
      setInterim('');
      setText((cur) => { const f = extractFields(cur); if (Object.keys(f).length) setFields(f); return cur; });
    };
    r.start();
    recogRef.current = r;
    setListening(true);
  }

  function stopListen() {
    recogRef.current?.stop();
    setListening(false);
  }

  function analyze() {
    const f = extractFields(text);
    setFields(f);
    if (Object.keys(f).length === 0) toast('لم يتم استخراج حقول.', 'info');
    else toast('تم تنظيم البيانات', 'success');
  }

  async function whisper(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const res = await transcribeAudio(file);
      if (res.error) toast(res.error, 'danger');
      else {
        const merged = (text ? text + '\n' : '') + res.result;
        setText(merged);
        setFields(extractFields(merged));
        toast('تم التفريغ والتنظيم', 'success');
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveCase() {
    const f = Object.keys(fields).length ? fields : extractFields(text);
    if (!f.case_number && !f.client_name && !text.trim()) { toast('لا توجد بيانات للحفظ.', 'danger'); return; }
    setBusy(true);
    try {
      await addDoc(collection(db, 'cases'), {
        lawyer_id: ownerId,
        case_number: f.case_number ?? '',
        client_name: f.client_name ?? '',
        client_phone: f.client_phone ?? null,
        case_type: f.case_type ?? null,
        verdict: f.verdict ?? null,
        fees: f.fees ? Number(f.fees) : null,
        expenses: f.expenses ? Number(f.expenses) : null,
        extra: {},
        follower_phones: [],
        archived: false,
        created_at: new Date().toISOString(),
      });
      toast('تمت إضافة القضية إلى الجدول', 'success');
      setText('');
      setInterim('');
      setFields({});
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 18 }}>
      <h2 style={{ marginBottom: 6 }}>تسجيل قضية بالصوت</h2>
      <p className="muted" style={{ marginBottom: 16, fontSize: 14 }}>
        اضغط زر المايك وانطق تفاصيل القضية، وسيتم تنظيمها وإضافتها إلى الجدول تلقائياً.
      </p>

      <div className="card col" style={{ gap: 16, maxWidth: 720 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '8px 0' }}>
          <button
            onClick={listening ? stopListen : startListen}
            aria-label={listening ? 'إيقاف التسجيل' : 'بدء التسجيل'}
            style={{
              width: 92, height: 92, borderRadius: 50, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: listening ? 'var(--danger)' : 'var(--navy)', color: '#fff',
              boxShadow: listening ? '0 0 0 8px rgba(192,57,43,.18)' : 'var(--shadow)',
              transition: 'box-shadow .2s ease',
            }}
          >
            {listening ? <Square size={34} fill="#fff" /> : <Mic size={40} />}
          </button>
          <span className="muted" style={{ fontSize: 13 }}>
            {listening ? 'جارٍ الاستماع… تحدّث الآن' : 'اضغط للتحدث'}
          </span>
          {interim && <span style={{ fontSize: 13, color: 'var(--navy)' }}>{interim}</span>}
        </div>

        <div className="row" style={{ gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={!aiAllowed || busy} title={aiAllowed ? '' : 'متاح في باقتي احترافي والفريق'}>
            {aiAllowed ? <FileAudio size={18} /> : <Lock size={18} />}
            تفريغ ملف صوتي (Whisper)
          </button>
          <input ref={fileRef} type="file" accept="audio/*" hidden onChange={whisper} />
        </div>

        <div>
          <label className="label">النص (يمكنك التعديل قبل الحفظ)</label>
          <textarea
            className="input"
            rows={5}
            placeholder="مثال: قضية رقم 1234/2024، الموكل أحمد محمد، الهاتف 01000000000، نوع القضية مدني، الأتعاب 5000، المصاريف 800"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-primary" onClick={analyze}><Wand2 size={18} /> تنظيم البيانات</button>
          <button className="btn btn-primary" onClick={saveCase} disabled={busy} style={{ marginInlineStart: 'auto' }}>
            {busy ? <Loader2 size={18} className="spin" /> : <Plus size={18} />} إضافة للجدول
          </button>
        </div>

        {Object.keys(fields).length > 0 && (
          <div className="card" style={{ background: 'var(--bg)' }}>
            <strong className="row" style={{ gap: 6 }}><Save size={16} /> الحقول المستخرجة (قابلة للتعديل):</strong>
            <div className="col" style={{ marginTop: 10 }}>
              {Object.keys(FIELD_LABELS).filter((k) => fields[k] !== undefined).map((k) => (
                <div key={k} className="row">
                  <span className="muted" style={{ width: 110, fontSize: 13 }}>{FIELD_LABELS[k]}</span>
                  <input
                    className={k === 'fees' || k === 'expenses' || k === 'client_phone' || k === 'case_number' ? 'input num' : 'input'}
                    value={fields[k]}
                    onChange={(e) => setFields({ ...fields, [k]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
