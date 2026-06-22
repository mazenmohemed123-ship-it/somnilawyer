# Somni Lawyer — إعداد Firebase

التطبيق يستخدم **Supabase** كقاعدة بيانات (Postgres + Auth + Realtime + Storage)،
ويستخدم **Firebase** لأمرين:
1. **Firebase Cloud Messaging (FCM):** إشعارات Push.
2. **Firebase Hosting (اختياري):** استضافة الواجهة (بديل عن Vercel).

> ملاحظة: لا يمكن إنشاء مشروع Firebase نيابةً عنك من هنا لأنه يتطلب تسجيل الدخول بحساب Google الخاص بك. اتبع الخطوات التالية لإنشائه بنفسك — كل ملفات الإعداد جاهزة في المستودع.

## 1) إنشاء مشروع Firebase باسم somni-lawyer
1. افتح https://console.firebase.google.com ثم **Add project**.
2. اسم المشروع: `somni-lawyer` (سيصبح معرّف المشروع `somni-lawyer` أو مشابهاً — حدّثه في `.firebaserc` إن اختلف).
3. أضِف تطبيق ويب (Web app) واحصل على كائن الإعداد `firebaseConfig`.

## 2) تفعيل الإشعارات (FCM)
1. من Project Settings → Cloud Messaging فعّل واجهة **HTTP v1**.
2. من Project Settings → Service accounts أنشئ مفتاح **Generate new private key** (ملف JSON).
3. ضع محتوى الـ JSON بالكامل في سرّ Supabase باسم `FCM_SERVICE_ACCOUNT`.
4. من Cloud Messaging → Web configuration أنشئ **VAPID key** وضعه في `VITE_FIREBASE_VAPID_KEY`.

## 3) متغيّرات البيئة (Frontend)
ضع قيم `firebaseConfig` في `.env` (وعلى Vercel/Hosting):
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=somni-lawyer.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=somni-lawyer
VITE_FIREBASE_STORAGE_BUCKET=somni-lawyer.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_VAPID_KEY=...
```
ثم حدّث نفس القيم داخل `public/firebase-messaging-sw.js` (الكائن `__SOMNI_FCM_CONFIG`) لأن الـ Service Worker لا يقرأ متغيّرات Vite.

## 4) النشر على Firebase Hosting (اختياري)
```bash
npm i -g firebase-tools
firebase login
firebase use somni-lawyer        # أو firebase use --add
npm run build
firebase deploy --only hosting
```
ملفات `firebase.json` و`.firebaserc` مهيّأة مسبقاً (SPA rewrites + ترويسات أمان).

## إن أردت لاحقاً نقل قاعدة البيانات كاملة إلى Firebase (Firestore)
هذا تحويل كبير (يستبدل Supabase/Postgres والـ RLS والـ Realtime والـ Edge Functions بـ Firestore وSecurity Rules وCloud Functions). أخبرني وسأنفّذه كمسار منفصل.
