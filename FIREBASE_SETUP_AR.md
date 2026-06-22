# Somni Lawyer — شرح كامل لإعداد Firebase

> منصة إدارة القضايا القانونية باللغة العربية مع دعم تسجيل الصوت والملفات

## 📋 ملخص البنية التقنية

المشروع يستخدم:
- **Supabase** ← قاعدة البيانات الأساسية (Postgres + Auth + Realtime)
- **Firebase Cloud Messaging (FCM)** ← الإشعارات الفورية (Push Notifications)
- **Firebase Hosting** ← الاستضافة (اختياري - بديل عن Vercel)

---

## ✅ الخطوة 1: إنشاء مشروع Firebase

### 1.1 افتح console Firebase
👉 **اذهب إلى:** https://console.firebase.google.com

### 1.2 إنشاء المشروع
1. اضغط **Add project** (إضافة مشروع)
2. اسم المشروع: `somni-lawyer`
3. اختر المنطقة (مثلاً: `europe-west1` أو `us-central1`)
4. اقبل شروط Firebase وخوادم Google Cloud
5. **اضغط Create Project**

### 1.3 انتظر إنشاء المشروع (دقيقة واحدة)

---

## ✅ الخطوة 2: إضافة تطبيق ويب

### 2.1 من لوحة Firebase الرئيسية:
1. اضغط أيقونة الويب `</>`
2. اسم التطبيق: `somni-lawyer-web`
3. اختر **Also set up Firebase Hosting** (إذا أردت)
4. **اضغط Register app**

### 2.2 انسخ بيانات التكوين
ستظهر لك قيمة `firebaseConfig` كاملة:

```javascript
{
  apiKey: "AIza...",
  authDomain: "somni-lawyer.firebaseapp.com",
  projectId: "somni-lawyer",
  storageBucket: "somni-lawyer.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123def456"
}
```

---

## ✅ الخطوة 3: تفعيل Cloud Messaging (FCM)

### 3.1 من القائمة اليسرى:
**Build → Cloud Messaging**

### 3.2 تفعيل HTTP v1
1. ابحث عن "Web configuration"
2. اضغط على اسم التطبيق `somni-lawyer-web`
3. قم بـ Copy الـ **VAPID Key** (مفتاح VAPID)
4. سيبدو مثل: `BJyJ-K3t...`

### 3.3 إنشاء Service Account (مفتاح الخادم)
هذا المفتاح **للاستخدام الآمن على الخادم فقط** (ليس في الكود الأمامي):

1. **Project Settings** (أعلى يسار الصفحة) → ⚙️
2. اختر **Service Accounts**
3. اختر **Firebase Admin SDK**
4. اضغط **Generate new private key**
5. سيتم تنزيل ملف JSON — **احفظه في مكان آمن**

محتوى الملف يبدو كالتالي:
```json
{
  "type": "service_account",
  "project_id": "somni-lawyer",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxx@somni-lawyer.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

---

## ✅ الخطوة 4: إعداد متغيّرات البيئة

### 4.1 على جهازك المحلي (`.env`)

أنشئ / عدّل ملف `.env` في جذر المشروع:

```bash
# Supabase (قاعدة البيانات)
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY

# Firebase Cloud Messaging
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=somni-lawyer.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=somni-lawyer
VITE_FIREBASE_STORAGE_BUCKET=somni-lawyer.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123def456
VITE_FIREBASE_VAPID_KEY=BJyJ-K3t...

# Paymob (الدفع - اختياري)
VITE_PAYMOB_IFRAME_ID=
```

### 4.2 على Firebase Hosting / Vercel

نفس المتغيّرات أعلاه، ضعها في **Environment Variables**:
- **Firebase Hosting:** Project Settings → Environment variables
- **Vercel:** Project Settings → Environment Variables

### 4.3 تحديث Service Worker

تحديث `/public/firebase-messaging-sw.js`:

ابحث عن هذا الجزء:
```javascript
self.__SOMNI_FCM_CONFIG = self.__SOMNI_FCM_CONFIG || {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};
```

استبدله بـ:
```javascript
self.__SOMNI_FCM_CONFIG = self.__SOMNI_FCM_CONFIG || {
  apiKey: 'AIza...',
  authDomain: 'somni-lawyer.firebaseapp.com',
  projectId: 'somni-lawyer',
  storageBucket: 'somni-lawyer.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abc123def456',
};
```

> ⚠️ **ملاحظة:** هذه القيم **عامة** (يمكن رؤيتها في المتصفح)، لا تضع أسراراً هنا.

---

## ✅ الخطوة 5: اختبار الاتصال

### 5.1 شغّل المشروع محلياً

```bash
npm install
npm run dev
```

### 5.2 افتح المتصفح

https://localhost:5173

### 5.3 تسجيل الدخول

استخدم بيانات Supabase أو أنشئ حساباً جديداً.

### 5.4 تفعيل الإشعارات

عندما تفتح الحساب، سيطلب منك الإذن بـ "الإشعارات" — اقبل ✓

---

## ✅ الخطوة 6: النشر على Firebase Hosting

### 6.1 ثبّت Firebase CLI

```bash
npm install -g firebase-tools
firebase login
```

### 6.2 اختر المشروع

```bash
firebase use somni-lawyer
```

### 6.3 بناء وتعيين

```bash
npm run build
firebase deploy --only hosting
```

### 6.4 احصل على رابط الموقع

بعد الانتشار، سيظهر رابط مثل:
```
🎉 Hosting URL: https://somni-lawyer.firebaseapp.com
```

---

## 📁 ملفات الإعداد الموجودة بالفعل

```
.firebaserc              ← معرّف المشروع
firebase.json           ← إعدادات الاستضافة + ترويسات الأمان
.env.example            ← قالب متغيّرات البيئة
.env (أنشئه بنفسك)      ← متغيّرات حقيقية (لا تضعه في git!)
public/firebase-messaging-sw.js  ← خدمة الإشعارات
src/services/firebaseMessaging.ts ← كود الإشعارات
```

---

## 🔒 الأمان (Security Headers)

جميع ترويسات الأمان مُفعّلة تلقائياً في `firebase.json`:
- ✅ `X-Frame-Options: DENY` (منع التضمين)
- ✅ `X-Content-Type-Options: nosniff` (منع MIME sniffing)
- ✅ `Strict-Transport-Security` (إجبار HTTPS)
- ✅ `Content-Security-Policy` (حماية من XSS)
- ✅ `Permissions-Policy` (التحكم في الأذونات)

---

## 🎙️ الميزات المدعومة

✅ **تسجيل القضايا بالصوت**
- استخدم `VoiceTab.tsx` لتسجيل بيانات القضية
- الصوت يُحوّل تلقائياً إلى نص

✅ **رفع الملفات (PDF, Word)**
- استخدم `VaultTab.tsx` لرفع المستندات
- تخزين آمن على Supabase Storage

✅ **الإشعارات الفورية**
- Push notifications عبر Firebase
- تعمل حتى لو أغلقت التطبيق

✅ **الشات المباشر**
- شات مع الموكلين
- شات الفريق
- كل شيء مُحفوظ

✅ **دعم 8 لغات**
- العربية والدراجة المغربية
- الإنجليزية والفرنسية والتركية
- الألمانية والإسبانية والبرتغالية

---

## ❓ أسئلة شائعة

### س: هل يمكن نقل كل البيانات إلى Firebase Firestore؟
**ج:** نعم، لكن هذا تحويل كبير. حالياً نستخدم Supabase (Postgres) وهو أكثر مرونة.

### س: ما الفرق بين Supabase و Firebase؟

| الميزة | Supabase | Firebase |
|--------|----------|----------|
| قاعدة البيانات | Postgres (SQL) | Firestore (NoSQL) |
| الحماية | Row Level Security | Security Rules |
| الإشعارات | لا (نستخدم Firebase) | ✅ Firebase Messaging |
| الملفات | Storage (S3 style) | Storage |
| الوقت الفعلي | Realtime | Realtime |

### س: هل يجب استخدام Firebase Hosting؟
**ج:** لا، يمكنك استخدام Vercel أو أي hostinger آخر. Firebase Hosting اختياري فقط.

### س: كيف أرسل إشعارات من الخادم؟
**ج:** استخدم Firebase Admin SDK مع ملف `service-account-key.json`:

```typescript
import admin from 'firebase-admin';

const serviceAccount = require('./service-account-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const messaging = admin.messaging();
await messaging.send({
  token: 'FCM_TOKEN_HERE',
  notification: {
    title: 'عنوان الإشعار',
    body: 'محتوى الإشعار',
  },
});
```

---

## 📞 للمساعدة

إذا حدثت مشكلة:
1. تحقق من أن جميع المتغيّرات في `.env` صحيحة
2. افتح DevTools في المتصفح (F12) وتحقق من الأخطاء في Console
3. تأكد من تفعيل FCM من Firebase Console
4. تأكد من تفعيل الإشعارات في المتصفح (عدم حجبها)

---

## 📚 الموارد الرسمية

- 📖 Firebase Docs: https://firebase.google.com/docs
- 📖 Supabase Docs: https://supabase.com/docs
- 📖 Firebase Hosting: https://firebase.google.com/docs/hosting
- 📖 Cloud Messaging: https://firebase.google.com/docs/cloud-messaging

---

**آخر تحديث:** 2026-06-22  
**الإصدار:** Somni Lawyer 1.0.0
