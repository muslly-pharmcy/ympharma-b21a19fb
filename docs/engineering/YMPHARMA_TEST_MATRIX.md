# مصفوفة اختبارات YmPharma

**تاريخ القياس:** 2026-10-10. النتائج تخص نسخة المستودع التي جرى فحصها في هذه المهمة. فحوص CI التي أعيد تشغيلها بعد تحديث workflow تظل معلّقة إلى أن تنتهي.

## اختبارات محلية منفذة

| الفحص | الأمر/المصدر | النتيجة | ما يثبته وما لا يثبته |
|---|---|---|---|
| تثبيت مطابق للقفل | `bun install --frozen-lockfile` | نجاح | الاعتماديات قابلة للتثبيت بالقفل الحالي؛ لا يثبت سلامة التطبيق أو vulnerability-free. |
| اختبارات وحدة على فرع Cloudflare | `bunx vitest run` | 41 ملفاً ناجحاً وملف واحد متخطّى؛ 282 اختباراً ناجحاً و8 متخطّاة | نجاح حزمة الوحدات المتاحة، مع بقاء اختبارات قاعدة/بيئة متخطاة. |
| اختبارات بعد إصلاح DLQ على فرع PR #14 | `bunx vitest run` | 284 اختباراً ناجحاً و8 متخطّاة | يضم اختبارين جديدين لتفويض RPC؛ لا يثبت تطبيق migration على Supabase. |
| فحص TypeScript | `bunx tsc --noEmit` | نجاح | لا أخطاء TypeScript في المصدر المفحوص. |
| ESLint | `bunx eslint . --max-warnings=-1` | 0 أخطاء؛ 5 تحذيرات قائمة | التحذيرات لا تعني فشل linter، لكنها لم تُعالج ضمن إصلاح Cloudflare. |
| هدف Node | `bun run build` | نجاح | بناء Node/Nitro بعد فصل هدف Cloudflare. |
| بناء Cloudflare | `bun run build:cloudflare` | نجاح محلي | يثبت إنشاء حزمة Worker بالـplugin الرسمي محلياً. |
| تحقق Cloudflare | `bun run validate:cloudflare` | نجاح | Worker build ثم `wrangler deploy --dry-run`؛ لا نشر أو تعديل خدمة. |
| Workerd smoke | `bun run preview:cloudflare` ثم طلبات HTTP محلية | `GET /` أعاد 200 وصفحة عربية RTL؛ و`/favicon.svg` أعاد 200 | يثبت SSR والأصول في بيئة محلية بالقيم الوهمية؛ لا يثبت Auth/RPC على إنتاج. |
| تدقيق ملفات Git | `git diff --check` و`bun install --frozen-lockfile` | نجاح قبل تحديث OSV docs/workflow | لا مسافات patch معطوبة ولا انحراف lockfile آنذاك. |

**قيد مهم:** smoke المحلي استخدم عنوان Supabase وهمياً على loopback ومفتاح اختبار فقط. لم يتصل بقاعدة إنتاج أو يقرأ سجلات أعمال.

## فحوص GitHub في PRs

| الفحص | PR #13 — Cloudflare | PR #14 — DLQ authorization |
|---|---|---|
| CI typecheck/lint/unit tests | نجاح على head `0a48c4c5` بعد تعديل OSV | نجاح على commit `863ffcf` |
| CodeQL | نجاح | نجاح |
| OSV Scanner | reusable workflow الرسمي `v2.6.0` أعطى check `osv-scanner` أخضر على head `0a48c4c5`؛ check منفصل `OSV-Scanner/OSV Security Scan` ما زال فاشلاً دون تفسير محسوم | غير محدث في PR #14؛ لا نتيجة جديدة لـOSV على ذلك الفرع |
| Workers Builds | فشل في check الخارجي؛ بقي إعداد build المدَار يستخدم هدف Node في الفرع الذي فُحص | فشل؛ لا يُعد ذلك نجاحاً للبناء المحلي، ويحتاج مطابقة إعداد Cloudflare المدَار مع هدف Worker |
| Supabase Preview | متخطٍ/غير مهيأ لهذا PR | لم يثبت تطبيق migration على Preview |

وصل تحديث `.github/workflows/osv-scanner.yml` إلى PR #13؛ workflow الرسمي `v2.6.0` يستخدم scanner يدعم `bun.lock` ونجح check `osv-scanner` على head الحالي. لا تزال نتيجة OSV الإجمالية غير محسومة لأن check منفصلاً باسم `OSV-Scanner/OSV Security Scan` فشل دون تفسير موثق.


## اختبار PR #15 — عزل التأمين

على فرع `fix/insurance-tenant-isolation`، نجحت مجموعة Vitest كاملة: 43 ملفاً ناجحاً وملف واحد متخطّى، 287 اختباراً ناجحاً و8 متخطّاة. نجح بناء Node وESLint. كما نجح check `CI/Typecheck, lint and test` وCodeQL على GitHub؛ فشل Workers Builds الخارجي وتخطى Supabase Preview. فشل `tsc --noEmit` محلياً بـ24 تشخيصاً في أربع وحدات MCP غير معدلة (`ask-kernel`, `check-stock`, `clinical-check`, `search-catalog`)؛ لا يظهر تشخيص للملفات المعدلة. لم تُنفذ اختبارات Supabase DB cross-tenant.

## اختبارات وسيناريوهات لم تُنفذ

- اختبارات PostgreSQL/RLS فعلية ضد قاعدة اختبار معزولة، بما يشمل صلاحيات `SECURITY DEFINER`، cross-tenant وcross-branch، وgrant checkout و`po_receive`.
- سيناريوهات تزامن لتعديل المخزون والحجز وidempotency، والحد من الكمية السالبة أو كسر `qty_reserved`.
- رحلة E2E حقيقية للكتالوج والاستيراد وPOS/checkout والدفع والمرتجع والشراء والاستلام والتأمين والصرف السريري.
- اختبارات OCR/HITL، وربط المرفقات بالوصفة المنظمة، والامتناع عن الصرف قبل موافقة بشرية.
- اختبارات التقارير المالية ومخطط `billing_ledger` والفترة/العملة والتصدير.
- اختبارات Offline عند قطع الشبكة والعودة، واستمرار queue بعد إعادة تشغيل التطبيق، وتعارض/replay والطباعة.
- اختبارات accessibility فعلية: axe، تباين، keyboard/focus، screen reader، RTL في أحجام مختلفة.
- اختبارات عمليات Cloudflare المنشورة، DNS/routes، health check بعد النشر، cron/alerts، استعادة backup وrollback.

## قاعدة تفسير النتائج

اختبارات state machine وZod ومطابقة نصوص migration تثبت أجزاءً من العقد فقط؛ لا تثبت صلاحيات قاعدة البيانات أو نجاح رحلة واجهة. كما أن route smoke يثبت أن الصفحة تُحمّل أو تعيد توجيهاً، لا أن المستخدم يستطيع إتمام المعاملة. يجب أن تكون نتائج staging/production منفصلة عن نتائج البناء المحلي في كل تقرير لاحق.
