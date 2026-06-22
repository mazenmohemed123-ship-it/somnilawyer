# 📥 كيفية تنزيل الفرع على جهازك

> شرح خطوة بخطوة لتنزيل الفرع `claude/sharp-allen-u8zyc9` من المشروع

---

## ✅ الطريقة 1: تنزيل الفرع الجديد مباشرة (الأسهل)

إذا كنت **لم تنسخ المشروع من قبل**:

### 1. افتح Terminal (سطر الأوامر)

```bash
cd ~/Desktop    # أو أي مجلد تريده
```

### 2. استنسخ المشروع مع الفرع الجديد

```bash
git clone --branch claude/sharp-allen-u8zyc9 https://github.com/mazenmohemed123-ship-it/somnilawyer.git
cd somnilawyer
```

### 3. ثبّت المتعلقات

```bash
npm install
```

### 4. أنشئ ملف البيئة

```bash
cp .env.example .env
```

ثم **عدّل `.env`** بقيمك الحقيقية من Supabase و Firebase.

### 5. شغّل المشروع

```bash
npm run dev
```

افتح المتصفح على: **http://localhost:5173**

---

## ✅ الطريقة 2: إذا كان لديك نسخة قديمة من المشروع

إذا كان المشروع موجود على جهازك بالفعل:

### 1. افتح المجلد

```bash
cd ~/path/to/somnilawyer
```

### 2. أضِف الفرع الجديد وسحب التحديثات

```bash
git fetch origin claude/sharp-allen-u8zyc9
git checkout claude/sharp-allen-u8zyc9
```

### 3. ثبّت المتعلقات (تحديثات جديدة قد تكون موجودة)

```bash
npm install
```

### 4. شغّل المشروع

```bash
npm run dev
```

---

## ✅ الطريقة 3: باستخدام GitHub Desktop (بدون Terminal)

إذا كنت تفضل واجهة رسومية:

### 1. حمّل GitHub Desktop

👉 https://desktop.github.com/

### 2. سجّل الدخول بحسابك

### 3. استنسخ المستودع

- اضغط **File → Clone Repository**
- ضع الرابط: `https://github.com/mazenmohemed123-ship-it/somnilawyer.git`
- اختر مجلد على جهازك
- اضغط **Clone**

### 4. اختر الفرع

- من القائمة العلوية: **Current Branch**
- ابحث عن `claude/sharp-allen-u8zyc9`
- اضغط عليه

### 5. افتح في المحرر

- اضغط **Open in Visual Studio Code** (أو محررك المفضل)

### 6. ثبّت المتعلقات وشغّل

```bash
npm install
npm run dev
```

---

## 🔍 التحقق من أنك على الفرع الصحيح

في Terminal:

```bash
git branch --show-current
```

يجب أن يظهر: **claude/sharp-allen-u8zyc9**

أو:

```bash
git status
```

يجب أن يظهر:
```
On branch claude/sharp-allen-u8zyc9
Your branch is up to date with 'origin/claude/sharp-allen-u8zyc9'.
```

---

## 📦 ما هو الجديد في هذا الفرع؟

الفرع `claude/sharp-allen-u8zyc9` يحتوي على:

✅ **دعم 8 لغات جديدة**
- العربية، الدراجة المغربية، الإنجليزية، الفرنسية
- التركية، الألمانية، الإسبانية، البرتغالية

✅ **ميزة تسجيل الصوت محسّنة**
- تحويل صوتي آلي للنص
- استخراج بيانات القضية تلقائياً

✅ **نظام الملفات متطور**
- رفع PDF و Word
- OCR للصور

✅ **نظام شات متقدم**
- شات مع الموكلين
- شات الفريق
- إشعارات فورية

---

## ⚙️ إعداد البيئة

بعد تنزيل الفرع:

### 1. أنشئ `.env` من `.env.example`

```bash
cp .env.example .env
```

### 2. امّلأ البيانات المطلوبة

ستحتاج إلى:
- **Supabase:** `VITE_SUPABASE_URL` و `VITE_SUPABASE_ANON_KEY`
- **Firebase:** جميع متغيّرات `VITE_FIREBASE_*`

👉 اتبع **FIREBASE_SETUP_AR.md** للحصول على هذه القيم

### 3. شغّل المشروع

```bash
npm run dev
```

---

## 🚀 الأوامر المهمة

```bash
# تحديث الكود من GitHub
git pull

# مشاهدة جميع الفروع
git branch -a

# الانتقال إلى فرع آخر
git checkout main

# العودة إلى فرعنا
git checkout claude/sharp-allen-u8zyc9

# إنشاء فرع جديد من هذا الفرع
git checkout -b my-feature

# دفع التغييرات
git push origin claude/sharp-allen-u8zyc9
```

---

## ❓ أسئلة شائعة

### س: لماذا هناك فرع جديد؟
**ج:** الفرع الجديد يحتوي على ميزات محسّنة ولم يتم دمجه في `main` بعد. هذا يسمح بالتطوير بشكل آمن.

### س: هل سأخسر بيانات لو استخدمت هذا الفرع؟
**ج:** لا! البيانات تُحفظ في Supabase على الخادم، لا على جهازك. فقط الكود قد يختلف.

### س: كيف أرجع إلى الإصدار القديم؟
**ج:** 
```bash
git checkout main
npm install
npm run dev
```

### س: هل يمكن استخدام هذا الفرع على الإنتاج (Production)؟
**ج:** نعم، لكن اختبره أولاً على جهازك المحلي. إذا كان كل شيء تمام:
```bash
npm run build
firebase deploy  # أو vercel deploy
```

---

## 📞 المساعدة

إذا حدثت مشكلة:

1. **خطأ "Branch not found":**
   ```bash
   git fetch origin
   git checkout claude/sharp-allen-u8zyc9
   ```

2. **مشاكل في npm install:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **المشروع لا يعمل:**
   - تحقق من `.env` (هل كل القيم موجودة؟)
   - شغّل `npm run build` للتحقق من الأخطاء
   - افتح Developer Tools (F12) وابحث عن الأخطاء

---

## ✨ بعد التنزيل مباشرة

```bash
# 1. انسخ الفرع
git clone --branch claude/sharp-allen-u8zyc9 https://github.com/mazenmohemed123-ship-it/somnilawyer.git
cd somnilawyer

# 2. ثبّت المتعلقات
npm install

# 3. أنشئ .env
cp .env.example .env

# 4. عدّل .env بقيمك (اتبع FIREBASE_SETUP_AR.md)
# استخدم محررك المفضل (VS Code, Sublime, إلخ)

# 5. شغّل المشروع
npm run dev

# 6. افتح المتصفح
# http://localhost:5173
```

---

**تم! الآن أنت جاهز لاستخدام الفرع الجديد!** 🎉

آخر تحديث: 2026-06-22
