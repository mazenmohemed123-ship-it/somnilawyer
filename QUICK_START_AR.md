# 🚀 البدء السريع - Somni Avocate

> الطريقة الأسرع لتشغيل المشروع

---

## 1️⃣ تنزيل الفرع (على جهازك)

```bash
git clone --branch claude/sharp-allen-u8zyc9 \
  https://github.com/mazenmohemed123-ship-it/somnilawyer.git

cd somnilawyer
npm install
```

---

## 2️⃣ إعداد Firebase (5 دقائق)

### أ. أنشئ مشروع Firebase
👉 https://console.firebase.google.com → **Add Project** → اسم: `somni-lawyer`

### ب. أضِف تطبيق ويب
👉 **Add app** → Web (`</>`) → انسخ البيانات

### ج. انسخ بيانات تسجيل الدخول الخاصة بك
من Firebase Console:
```
apiKey
authDomain
projectId
storageBucket
messagingSenderId
appId
```

---

## 3️⃣ أنشئ ملف `.env`

```bash
cp .env.example .env
```

ثم افتح `.env` وأضِف البيانات:

```env
# من Supabase (اطلب من الفريق)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx

# من Firebase (ما انسخته أعلاه)
VITE_FIREBASE_API_KEY=AIzaSyxx
VITE_FIREBASE_AUTH_DOMAIN=somni-lawyer.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=somni-lawyer
VITE_FIREBASE_STORAGE_BUCKET=somni-lawyer.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123def456
VITE_FIREBASE_VAPID_KEY=BJyJxxx
```

---

## 4️⃣ شغّل المشروع

```bash
npm run dev
```

افتح: **http://localhost:5173** 🎉

---

## 5️⃣ اختبر الميزات

### ✅ تسجيل الدخول
- كمحام: `/lawyer/auth`
- كموكل: اطلب رابط من المحام

### ✅ تسجيل القضايا بالصوت
- انتقل إلى **التسجيل الصوتي** (Mic icon)
- اضغط الزر الأزرق الكبير
- قل بيانات القضية (مثلاً: "قضية رقم 2024-123، الموكل أحمد، الأتعاب 5000")
- سيتم تحويل الصوت تلقائياً إلى نص ✅

### ✅ رفع الملفات
- انتقل إلى **المستندات** (folder icon)
- اختر قضية
- ارفع ملف PDF أو Word
- سيُحفظ تلقائياً ✅

### ✅ الشات
- انتقل إلى **شات الموكلين**
- تواصل مع العملاء مباشرة ✅

### ✅ اللغات
- في أي صفحة، ابحث عن اختيار اللغة
- اختر من: العربية، دراجة مغربية، الإنجليزية، الفرنسية، إلخ ✅

---

## 📁 هيكل المشروع

```
somni-lawyer/
├── src/
│   ├── components/
│   │   ├── CaseVoiceRecorder.tsx      ← تسجيل الصوت
│   │   ├── chat/                      ← نظام الشات
│   ├── pages/
│   │   ├── lawyer/
│   │   │   ├── VoiceTab.tsx           ← تسجيل القضايا
│   │   │   ├── VaultTab.tsx           ← الملفات
│   │   │   ├── CasesTab.tsx           ← جدول القضايا
│   ├── services/
│   │   ├── voiceRecorder.ts           ← خدمة الصوت
│   │   ├── firebaseMessaging.ts       ← الإشعارات
│   ├── lib/
│   │   ├── i18n.ts                    ← 8 لغات
├── firebase.json                       ← إعدادات Firebase
├── .firebaserc                        ← معرّف المشروع
├── FIREBASE_SETUP_AR.md               ← شرح مفصّل
├── CLONE_BRANCH_AR.md                 ← تنزيل الفرع
└── QUICK_START_AR.md                  ← هذا الملف
```

---

## 🔧 الأوامر الأساسية

```bash
# التطوير
npm run dev              # شغّل محلياً

# البناء والاختبار
npm run build            # بناء الإنتاج
npm test                 # تشغيل الاختبارات
npm run typecheck        # تحقق من النوع

# النشر
firebase login
firebase deploy --only hosting  # على Firebase
# أو vercel deploy              # على Vercel

# الفرع
git checkout claude/sharp-allen-u8zyc9  # انتقل للفرع
git branch --show-current               # شف الفرع الحالي
```

---

## ⚠️ الأخطاء الشائعة

### "Module not found"
```bash
rm -rf node_modules package-lock.json
npm install
```

### "VITE_* is undefined"
✅ تحقق من أن جميع متغيّرات `.env` موجودة وصحيحة

### "Firebase not configured"
✅ تحقق من `firebaseConfig` في `.env`

### "Speech Recognition not supported"
✅ استخدم متصفح حديث (Chrome, Edge, Firefox)
❌ لا يعمل في Safari على Mac (محدودية)

### "Microphone permission denied"
✅ أعطِ الإذن للموقع بالوصول للمايك
👉 اضغط على الـ Lock icon في شريط العنوان → اسمح بالمايك

---

## 🌍 دعم اللغات

المشروع يدعم **8 لغات**:

| اللغة | الرمز | الحالة |
|-------|------|--------|
| العربية | `ar` | ✅ |
| دراجة مغربية | `darija` | ✅ جديد |
| الإنجليزية | `en` | ✅ |
| الفرنسية | `fr` | ✅ |
| التركية | `tr` | ✅ |
| الألمانية | `de` | ✅ جديد |
| الإسبانية | `es` | ✅ جديد |
| البرتغالية | `pt` | ✅ جديد |

---

## 📞 الدعم

📖 **اقرأ أولاً:**
- `FIREBASE_SETUP_AR.md` - شرح Firebase مفصّل
- `CLONE_BRANCH_AR.md` - خطوات تنزيل الفرع
- `README.md` - النظرة العامة على المشروع

---

## ✨ ما الجديد في هذا الفرع؟

- 🎙️ تحسينات تسجيل الصوت
- 📄 دعم رفع ملفات محسّن
- 🌍 4 لغات جديدة
- 🔒 ترويسات أمان محسّنة
- 💬 نظام شات مستقر
- 🧪 اختبارات شاملة

---

## 🎯 الخطوات التالية

1. ✅ شغّل المشروع محلياً
2. ✅ اختبر الميزات
3. ✅ أنشئ حسابات تجريبية
4. ✅ اختبر التسجيل الصوتي
5. ✅ اختبر رفع الملفات
6. ✅ إذا كان كل شيء تمام، انشره على الإنتاج

```bash
npm run build
firebase deploy --only hosting
```

---

**جاهز؟ ابدأ الآن!** 🚀

```bash
git clone --branch claude/sharp-allen-u8zyc9 https://github.com/mazenmohemed123-ship-it/somnilawyer.git
cd somnilawyer
npm install
npm run dev
```

---

آخر تحديث: 2026-06-22  
الإصدار: 1.0.0
