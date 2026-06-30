# Somni Avocate (Somni Avocate)

منصة عربية (RTL) لإدارة القضايا القانونية والتواصل بين المحامي ↔ الموكل وبين أعضاء المكتب.
بدون أي إيموجيز في الواجهة — أيقونات `lucide-react` فقط. هوية كحلي/ذهبي، خطوط Cairo/Tajawal، PWA قابل للتثبيت.

## التقنيات
- **Frontend:** React 18 + TypeScript + Vite (SPA)، أنماط inline + متغيّرات CSS.
- **Backend:** Supabase (Postgres + Auth + Realtime + Storage + Edge Functions).
- **الشات:** مخطّط `somni-chat` (محادثات/مشاركون/رسائل/مرفقات/تفاعلات/حضور) مع ربط `case_id` / `office_id`، عميل Supabase واحد (singleton).
- **الدفع:** Paymob. **الإشعارات:** FCM HTTP v1. **الذكاء:** Hugging Face عبر Edge Function.

## التشغيل محلياً
```bash
npm install
cp .env.example .env      # املأ VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY
npm run dev
npm run build             # يبني بنجاح بدون أخطاء
```

## خطوات النشر (Supabase + Vercel)

1. **قاعدة البيانات:** افتح Supabase → SQL Editor والصق محتوى `supabase_setup.sql` ثم Run (مرة واحدة على مشروع فارغ). يبني كل الجداول، الدوال، الـ RLS، الـ realtime، وbuckets التخزين (`documents`, `chat-attachments`).
2. **Anonymous sign-ins:** فعّلها من Authentication → Providers → Anonymous (إلزامي لدخول الموكلين).
3. **Leaked Password Protection:** فعّلها من Authentication → Policies.
4. **Edge Functions:** انشرها:
   ```bash
   supabase functions deploy ai-tools send-notification create-checkout-session paymob-webhook auto-renew-check send-email
   ```
5. **الأسرار (Supabase → Edge Functions → Secrets):**
   `HF_TOKEN`, `FCM_SERVICE_ACCOUNT` (JSON كامل), `PAYMOB_API_KEY`, `PAYMOB_HMAC_SECRET`, `PAYMOB_INTEGRATION_ID`, `PAYMOB_IFRAME_ID`, واختيارياً `RESEND_API_KEY` / `EMAIL_FROM`.
   - اضبط webhook الدفع في Paymob على: `.../functions/v1/paymob-webhook?hmac=...`.
   - (اختياري) جدوِل `auto-renew-check` يومياً عبر `pg_cron` أو Scheduled Functions.
6. **متغيّرات Vercel (Frontend):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PAYMOB_IFRAME_ID`, `VITE_FIREBASE_*`, `VITE_FIREBASE_VAPID_KEY`.
   - حدّث قيم Firebase داخل `public/firebase-messaging-sw.js` (تكوين الويب العام).
   - `vercel.json` يضبط الـ SPA rewrites و security headers.
7. **اجعل نفسك أدمن:**
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
   ثم ادخل عبر `/admin-control-center` (الإيميل ضمن allowlist في `src/lib/permissions.ts` و دالة `post_announcement`).

## المسارات
- `/` بوابة الدخول — زر «دخول المحامي» فقط.
- `/lawyer/auth` و `/lawyer` بوابة المحامي وموظفي المكتب.
- `/portal/lawyer/:lawyerId` **رابط المكتب** — بوابة الموكل (دخول برقم الهاتف فقط إن كان مسجّلاً عبر `check_office_access`).
- `/admin-control-center` لوحة الأدمن.

## كيف يدخل الموكل
المحامي يرسل **رابط المكتب** الثابت (من تبويب الإعدادات أو زر «متابعو القضية»). الموكل يفتح الرابط ويُدخل رقمه؛ يُسمح له فقط إذا كان رقمه = `client_phone` لقضية في هذا المكتب أو ضمن `follower_phones` (حتى 10 أرقام لكل قضية). التحقق عبر `check_office_access` (SECURITY DEFINER، متاحة لـ anon)، ثم Anonymous sign-in وإنشاء/ربط محادثة القضية.

## الشات (somni-chat)
- إرسال متفائل + **dedupe عبر `client_id`** (لا تكرار للرسائل).
- علامات القراءة (sent/delivered/read عبر `read_at`) — تُحدَّث عبر RPC آمن `mark_conversation_read`.
- مؤشّر «يكتب الآن» (broadcast، يُمسح بعد 3 ثوانٍ)، الحضور (presence) في رأس المحادثة، مرفقات (صور/فيديو/PDF)، soft-delete.
- خرائط الغرف: الموكل↔المحامي = `direct` مربوطة بـ `case_id`؛ مجموعة المكتب = `group` مربوطة بـ `office_id`؛ الثنائي بين الموظفين = `direct`.

## ملاحظات
- مكتبة `@sominix/chat-core` غير مستخدمة كاعتماد لضمان نجاح البناء؛ نُفّذ الشات مباشرةً على نفس مخطّط somni-chat فوق Supabase Realtime (نفس الجداول والسلوك). يمكن استبدال طبقة الـ hooks بالمكتبة لاحقاً دون تغيير قاعدة البيانات.
- أيقونات PWA مولّدة في `public/icons`. استبدلها بشعارك إن رغبت.
