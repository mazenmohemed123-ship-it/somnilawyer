import { useState } from 'react';
import { Save, Loader2, Copy, Check, Bell, Link2, ShieldAlert } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/services/firebase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { enablePushNotifications } from '@/services/firebaseMessaging';
import { LANGS } from '@/lib/i18n';

const CURRENCIES = ['EGP', 'USD', 'EUR', 'SAR', 'AED', 'TRY', 'MAD', 'DZD', 'GBP', 'CAD', 'AUD'];

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`__timeout__:${label}`)), ms)
    ),
  ]);
}

export function SettingsTab() {
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [language, setLanguage] = useState(profile?.language ?? 'ar');
  const [botLanguage, setBotLanguage] = useState(profile?.bot_language ?? profile?.language ?? 'ar');
  const [voiceRecordingLang, setVoiceRecordingLang] = useState(profile?.voice_recording_language ?? 'ar-EG');
  const [currency, setCurrency] = useState(profile?.currency ?? 'EGP');
  const [emergency, setEmergency] = useState(profile?.emergency_enabled ?? true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const ownerId = profile?.master_lawyer_id ?? profile?.id ?? '';
  const officeLink = `${window.location.origin}/portal/lawyer/${ownerId}`;

  async function save() {
    setBusy(true);
    try {
      await withTimeout(updateDoc(doc(db, 'users', profile!.id), {
        full_name: fullName, bio, language, bot_language: botLanguage, voice_recording_language: voiceRecordingLang, currency, emergency_enabled: emergency,
      }), 12000, 'saveSettings');
      toast('تم الحفظ', 'success');
      refreshProfile();
    } catch (err: any) {
      console.error('Save error:', err);
      toast('حدث خطأ - حاول مجدداً', 'danger');
    } finally {
      setBusy(false);
    }
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarBusy(true);
    try {
      const path = `avatars/${profile!.id}/avatar-${Date.now()}-${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const avatarUrl = await getDownloadURL(storageRef);
      await withTimeout(updateDoc(doc(db, 'users', profile!.id), { avatar_url: avatarUrl }), 12000, 'uploadAvatar');
      refreshProfile();
      toast('تم تحديث الصورة', 'success');
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      toast(err.message?.includes('timeout') ? 'انقطع الاتصال' : err.message, 'danger');
    } finally {
      setAvatarBusy(false);
    }
  }

  async function enablePush() {
    setPushBusy(true);
    const token = await enablePushNotifications(profile!.id);
    setPushBusy(false);
    toast(token ? 'تم تفعيل الإشعارات' : 'تعذّر التفعيل (تحقق من الأذونات).', token ? 'success' : 'danger');
  }

  return (
    <div style={{ padding: 18 }}>
      <h2 style={{ marginBottom: 16 }}>الإعدادات</h2>
      <div className="card col" style={{ maxWidth: 640, gap: 14 }}>
        <div className="row" style={{ gap: 14 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--navy)', color: 'var(--gold-bright)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontSize: 24, fontWeight: 700 }}>
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (fullName[0] ?? 'م')}
          </div>
          <label className="btn btn-ghost">
            {avatarBusy ? <Loader2 size={16} className="spin" /> : null} تغيير الصورة
            <input type="file" accept="image/*" hidden onChange={uploadAvatar} />
          </label>
        </div>

        <div><label className="label">الاسم</label><input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
        <div><label className="label">نبذة</label><textarea className="input" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} /></div>
        <div className="row" style={{ gap: 12 }}>
          <div style={{ flex: 1 }}><label className="label">لغة الواجهة</label>
            <select className="input" value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}><label className="label">لغة البوت</label>
            <select className="input" value={botLanguage} onChange={(e) => setBotLanguage(e.target.value)}>
              {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
        </div>

        <div><label className="label">لغة تسجيل الصوت</label>
          <select className="input" value={voiceRecordingLang} onChange={(e) => setVoiceRecordingLang(e.target.value)}>
            <option value="ar-EG">العربية (مصر)</option>
            <option value="en-US">English (US)</option>
            <option value="en-GB">English (UK)</option>
            <option value="fr-FR">Français</option>
            <option value="de-DE">Deutsch</option>
          </select>
        </div>

        <div><label className="label">العملة</label>
          <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <label className="row" style={{ gap: 8 }}>
          <input type="checkbox" checked={emergency} onChange={(e) => setEmergency(e.target.checked)} />
          <ShieldAlert size={16} color="var(--danger)" /> استقبال تنبيهات الطوارئ من الموكلين
        </label>

        <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={save} disabled={busy}>
          {busy ? <Loader2 size={18} className="spin" /> : <Save size={18} />} حفظ
        </button>

        <div className="hr" />

        <div>
          <label className="label"><Link2 size={14} style={{ verticalAlign: 'middle' }} /> رابط المكتب (للموكلين)</label>
          <div className="row">
            <input className="input num" readOnly value={officeLink} />
            <button className="btn btn-ghost" onClick={() => { navigator.clipboard.writeText(officeLink); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
              {copied ? <Check size={16} color="var(--success)" /> : <Copy size={16} />}
            </button>
          </div>
        </div>

        <button className="btn btn-gold" style={{ alignSelf: 'flex-start' }} onClick={enablePush} disabled={pushBusy}>
          {pushBusy ? <Loader2 size={16} className="spin" /> : <Bell size={16} />} تفعيل إشعارات Push
        </button>
      </div>
    </div>
  );
}
