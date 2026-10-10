# إصلاح Cloudflare Worker Error 10021

**التاريخ:** 2026-10-10
**النطاق:** إعداد بناء Worker مع الحفاظ على أهداف Node/Docker وCapacitor.
**حالة النشر:** إصلاح مختبر محلياً ومحفوظ للمراجعة؛ **لم يُنشر إلى الإنتاج ولم تُعدّل DNS**.

## الخلاصة

كان إعداد المشروع يوجّه بناء Nitro الافتراضي إلى `node-server`، بينما يشير Wrangler إلى مدخل TanStack Start على Cloudflare. هذا التعارض يطابق فرضية الخطأ المسجل `Cloudflare 10021 / createRequire received undefined path` في مخرجات Node/Nitro، لكنه لا يثبت أن عدم توافق Node/Workers هو السبب الوحيد لكل فشل الإنتاج. جرى اعتماد مسار Cloudflare Vite الرسمي، وفصل محوّل Workers عن محوّل Node، وإضافة تحقق Wrangler لا ينشر شيئاً.

## التغيير

- تثبيت `@cloudflare/vite-plugin` على `1.63.1` و`wrangler` على `4.149.0` مع تحديث `bun.lock`.
- إضافة `scripts/cloudflare-target.mjs` لعزل `CLOUDFLARE_BUILD=1` وتشغيل `dev` و`build` و`preview` و`validate` عبر الأدوات المحلية على Windows/Linux.
- في `vite.config.ts` يعمل Cloudflare Vite plugin مع `viteEnvironment: { name: "ssr" }` ويُعطّل Nitro في بناء Cloudflare فقط؛ يبقى Nitro `node-server` هدفاً منفصلاً.
- الحفاظ على TanStack Start ومدخل Worker الرسمي `@tanstack/react-start/server-entry`. يحدد plugin مخرجات Worker والأصول وقت البناء.
- توجيه أصول PWA في هدف Cloudflare إلى `dist/client`، دون تغيير هدف Node أو Capacitor.
- تحديث CI لتثبيت Bun `1.4.3` والتحقق من TypeScript وESLint والوحدات وبناء Node و`validate:cloudflare`؛ Wrangler يستخدم `--dry-run` فقط.
- كان OSV Action `v1.9.0` يفشل بـ`No package sources found` عند قراءة `bun.lock`، ثم يرفع SARIF فارغاً غير صالح؛ هذا ليس تقرير ثغرات. جرى التحويل إلى reusable workflow الرسمي `v2.6.0` الداعم لملف Bun.

## الأدلة المنفذة محلياً

| الفحص | النتيجة |
|---|---|
| `bun install --frozen-lockfile` | نجاح دون تغيير قفل غير مقصود |
| `bunx tsc --noEmit` على فرع Cloudflare | نجاح وقت الفحص الأول |
| `bunx eslint . --max-warnings=-1` | 0 أخطاء؛ 5 تحذيرات قائمة |
| `bunx vitest run` على فرع Cloudflare | 41 ملفاً ناجحاً وملف واحد متخطّى؛ 282 ناجحاً و8 متخطّاة |
| فرع PR #14 بعد اختبار DLQ | 284 ناجحاً و8 متخطّاة |
| `bun run build` | بناء Node/Nitro نجح بعد الفصل |
| `bun run build:cloudflare` | بناء Worker نجح محلياً |
| `bun run validate:cloudflare` | بناء Worker و`wrangler deploy --dry-run` نجحا؛ لا نشر |
| معاينة Workerd المحلية | `GET /` أعاد 200 وHTML عربي RTL؛ و`/favicon.svg` أعاد 200 |
| فحص bundle | لم يظهر `createRequire` في مخرجات Worker المفحوصة؛ وبدأ SSR المحلي دون الخطأ المسجل |

أبلغ Wrangler عن 605 ملفات ثابتة للمعاينة، وإجمالي تحميل يقارب 10,595 KiB، وgzip يقارب 2,327 KiB في dry-run. هذه أرقام بناء محلي وليست قياساً للنشر أو الأداء الحي.

## فحوص GitHub والحالة الخارجية

على PR #13 head `0a48c4c5` نجحت CI وCodeQL والـworkflow الجديد `osv-scanner`. ظل check منفصل باسم `OSV-Scanner/OSV Security Scan` فاشلاً، كما ظل `Workers Builds: ympharma-b21a19fb` فاشلاً. Supabase Preview متخطٍ. لا نعد منظومة OSV كلها ناجحة بسبب check واحد أخضر.

سجل OSV التاريخي على commit `186f1b5` يبيّن `No package sources found` مع `bun.lock` ثم رفع SARIF حجمه 142 بايت لم يستطع GitHub تحليله؛ هذا لا يثبت وجود ثغرة ولا خلو الشجرة منها. سبب الـcheck الخارجي المنفصل ما زال غير محسوم.

فشل Workers Builds لا يلغي نجاح البناء المحلي: إعداد البناء المدَار الذي فُحص استخدم `bun run build` (هدف Node) بدلاً من `bun run build:cloudflare`. يلزم تصحيح إعداد الفرع المدَار واختباره دون تشغيل نشر إنتاجي. لم نغير إعدادات Cloudflare الحية أو نستخدم deploy بدون `--dry-run`.

## تعليمات التشغيل

- بناء ومعاينة Workers: `bun run build:cloudflare` و`bun run preview:cloudflare`.
- تحقق مانع للنشر: `bun run validate:cloudflare`.
- لا تستخدم `bun run build` لبناء Worker؛ فهو يبقى هدف Node/Docker.
- أي تحديث مستقبلي لـWorkers Builds يجب أن يبني بـ`bun run build:cloudflare` قبل خطوة deploy. لم يُضف deploy إلى CI.

## الحدود والمتابعة

- استُخدمت قيم Supabase وهمية على loopback للمعاينة؛ لم تُقرأ أو تُكتب بيانات التطبيق.
- Workerd smoke لا يثبت عمل تسجيل الدخول أو RPC على الإنتاج.
- لم يحدث نشر جديد. يوجد Worker باسم `ympharma-b21a19fb` وإصدارات سابقة، لكن قائمة Worker routes في Zone لـ`muslly.com` فارغة ولا توجد Worker Custom Domains ظاهرة. سجلات النطاقين تشير إلى مضيفين آخرين؛ استجاب الجذر بـ200 وأعاد `www` HTTP 421 وقت القياس. لم تُغيّر هذه الإعدادات.
- التغييرات محفوظة في PR #13 للمراجعة، والنشر أو تغيير النطاقات قرار منفصل يحتاج موافقة مالك الإنتاج.

## المصادر

- [Cloudflare: TanStack Start](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/)
- [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/)
- [TanStack Start hosting](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)
- [OSV Scanner: supported files](https://google.github.io/osv-scanner/supported-languages-and-lockfiles/)
- [OSV Scanner GitHub Action](https://google.github.io/osv-scanner/github-action/)
- [سجل المصادر المحفوظ بالمستودع](./EXTERNAL-SOURCES-2026-10-10.md)
