# Seedance Drama Studio V2.0 — صيغة الأوامر + توليد فيديو حقيقي

## ما سيتم بناؤه

### 1. مطابقة صيغة الأمر بدقة
تحديث `src/lib/ai/seedance-engine.ts` ليُخرج نفس القالب المطلوب حرفياً:

```text
[SEEDANCE DRAMA STUDIO V2.0 - CINEMATIC ENGINE]
[MODE: FINAL VERSION LOCK]
=== PRE-PRODUCTION & SCENE SPECS ===
TITLE / GENRE / LOGLINE
=== CHARACTER CONTINUITY MATRIX ===
=== SCENE DIRECTING & CAMERA WORK ===
[Shot 1] - Type: ... | Cam: ... | Light: ... | Duration: 5s
=== VISUAL & LIGHTING INSTRUCTIONS ===
=== SEEDANCE GENERATION PROMPT ===
/generate_video --prompt "..." --aspect_ratio 9:16 --framerate 60fps --lock_continuity true
```
مع الحفاظ على `frameLockHash` لضمان الاستمرارية.

### 2. لقطات متعددة في الواجهة
- إضافة/حذف لقطات (Shot 1، Shot 2، …) داخل `SeedanceStudio.tsx`.
- لكل لقطة: نوع اللقطة، حركة الكاميرا، الإضاءة، المدة (4/6/8 ثوان).
- إعدادات عامة: نسبة العرض (9:16 / 16:9)، أسلوب الرندر، تفعيل قفل الاستمرارية.
- شخصيات متعددة أيضاً (اسم / دور / أسلوب بصري) لملء Continuity Matrix.

### 3. زر توليد فيديو حقيقي
- زر "🎥 توليد الفيديو" يرسل نص المشهد إلى الذكاء الاصطناعي ويعرض المقطع داخل الاستوديو.
- شريط حالة أثناء التوليد (يستغرق دقيقة إلى ثلاث دقائق) + رسائل خطأ واضحة (نفاد الرصيد، الحد الأقصى للطلبات، رفض المحتوى).
- مشغّل فيديو + زر تحميل بعد الانتهاء.
- التوليد يبدأ فقط عند ضغط الزر (لا تشغيل تلقائي) لأنه مكلف بالرصيد.

## تفاصيل تقنية

- خادم: `src/lib/seedance.functions.ts` بدالتين محميتين بـ `requireSupabaseAuth`:
  - `startSeedanceVideo` — إنشاء مهمة على بوابة الذكاء الاصطناعي (`google/veo-3.1-lite`، `size` مشتق من نسبة العرض، `seconds` من مدة اللقطة الأولى محدودة بـ 4/6/8).
  - `pollSeedanceVideo` — استعلام عن الحالة، وعند الاكتمال يُنزّل الـ MP4 ويرفعه إلى تخزين خاص ثم يعيد رابطاً موقّعاً.
- ترحيل قاعدة بيانات: باكيت تخزين خاص `seedance-videos` + جدول `seedance_generations` (المالك، المعرّف، الحالة، المسار، الأمر) مع GRANTs و RLS مقصورة على `auth.uid()`.
- التوليد لا يتم إلا من ضغط زر المستخدم، وطلب واحد في كل مرة.
- المسار `/seedance-studio` ينتقل تحت `_authenticated` لأن التوليد يتطلب مستخدماً مسجلاً؛ الصيغة النصية تبقى تعمل بالكامل من دون توليد.
