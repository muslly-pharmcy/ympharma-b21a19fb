# إصلاح Cloudflare Worker Error 10021

**التاريخ:** 2026-10-10  
**النطاق:** إعداد بناء Worker، مع الحفاظ على أهداف Node/Docker وCapacitor القائمة.  
**حالة النشر:** مرشح إصلاح مُختبر محلياً؛ **لم يُنشر إلى الإنتاج ولم تُعدّل DNS**.

## الخلاصة

كان إعداد المشروع يوجّه بناء Nitro الافتراضي إلى `node-server`، بينما كان Wrangler يشير إلى مدخل TanStack Start على Cloudflare. هذا التعارض يطابق فرضية الخطأ المسجلة `Cloudflare 10021 / createRequire received undefined path` في مخرجات Node/Nitro، لكنه لا يثبت أن عدم توافق Node/Workers هو السبب الوحيد لكل فشل الإنتاج. جرى الانتقال إلى مسار Cloudflare Vite الرسمي، مع فصل صريح بين محوّل Workers ومحوّل Node، وإضافة تحقق Wrangler لا ينشر شيئاً.

## التغيير

- تثبيت `@cloudflare/vite-plugin` على `1.63.1` و`wrangler` على `4.149.0`، وتحديث `bun.lock` فقط بقدر التبعيات اللازمة.
- إضافة `scripts/cloudflare-target.mjs` لعزل `CLOUDFLARE_BUILD=1` وتشغيل أوامر `dev` و`build` و`preview` و`validate` عبر الأدوات المحلية، بما يتوافق مع Windows وLinux.
- في `vite.config.ts` يعمل Cloudflare Vite plugin مع `viteEnvironment: { name: "ssr" }` ويُعطّل Nitro في بناء Cloudflare فقط؛ يظل Nitro `node-server` هدفاً منفصلاً للبناء المعتاد.
- الحفاظ على إعداد TanStack Start ومدخل Worker الرسمي `@tanstack/react-start/server-entry`. يحدد plugin مخرجات Worker/الأصول وقت البناء.
- توجيه أصول PWA في بناء Cloudflare إلى `dist/client` بدلاً من مخرجات Nitro، دون تغيير هدف Node أو Capacitor.
- تحديث GitHub Actions لتثبيت Bun `1.4.3` والتحقق من TypeScript وESLint والوحدات وبناء Node و`validate:cloudflare`؛ مسار Wrangler في CI يستخدم `--dry-run` فقط.

## الأدلة المنفذة

| الفحص | النتيجة |
|---|---|
| `bun install --frozen-lockfile` | نجح دون تعديل lockfile إضافي |
| `bunx tsc --noEmit` | نجح |
| `bunx eslint . --max-warnings=-1` | 0 أخطاء؛ 5 تحذيرات قائمة في ملفات أخرى |
| `bunx vitest run` | 41 ملف اختبار ناجح وملف واحد متخطّى؛ 282 اختباراً ناجحاً و8 متخطّاة |
| `bun run build` | بناء Node/Nitro نجح بعد الفصل |
| `bun run validate:cloudflare` | بناء Worker ثم `wrangler deploy --dry-run` نجح؛ لا نشر |
| معاينة Workerd المحلية | `GET /` أعاد 200 وHTML عربي RTL؛ `GET /favicon.svg` أعاد 200 وSVG |
| فحص الشيفرة المجمّعة | لم يظهر `createRequire` في مخرجات Worker المفحوصة؛ ونجاح معاينة Workerd يؤكد بدء SSR محلياً دون الخطأ المسجل |

أبلغ Wrangler عن **605** ملفاً ثابتاً للمعاينة، وإجمالي تحميل يقارب **10,595 KiB**، وgzip يقارب **2,327 KiB** في الـdry-run. هذه أرقام بناء محلي وليست قياساً للنشر أو التشغيل على الإنتاج.

## تعليمات التشغيل

- البناء والمعاينة المخصصان لـWorkers: `bun run build:cloudflare` و`bun run preview:cloudflare`.
- التحقق المانع للنشر: `bun run validate:cloudflare`.
- لا تستخدم `bun run build` لبناء Worker؛ فهو يبقى هدف Node/Docker.
- عند اعتماد مسار Workers Builds لاحقاً، يجب أن يستدعي أمر البناء `bun run build:cloudflare` قبل `wrangler deploy`. لم يُضف أمر deploy إلى CI ولم يُنفذ `wrangler deploy` من دون `--dry-run`.

## الحدود والمتابعة

- لم يُشغّل مسار مصادقة متصل بـSupabase في المعاينة؛ استُخدمت قيم Supabase وهمية على loopback للفحص المحلي، ولم تُقرأ أو تُكتب بيانات التطبيق.
- اختبارات Workerd تثبت بدء Worker وSSR والأصول، لكنها لا تثبت أن كل RPC أو تسجيل دخول يعمل عبر الإنتاج.
- لم تُسحب سجلات Cloudflare التشغيلية لأن التحقق المطلوب للمرشح تم محلياً؛ لا يوجد هنا إثبات لنشر هذه الشيفرة.
- الحالة الحية عند التدقيق: يوجد Worker بالاسم `ympharma-b21a19fb` وإصدارات سابقة، لكن قائمة Worker routes في Zone لـ`muslly.com` فارغة، ولا توجد Worker Custom Domains ظاهرة. نطاقا `muslly.com` و`www.muslly.com` لديهما سجلات A متطابقة إلى مضيفين آخرين؛ استجاب الجذر بـ200، بينما أعاد `www` الحالة HTTP 421. لم تُغيّر هذه الإعدادات.
- يلزم فتح PR ومراجعة CI، ثم يظل النشر وتغيير النطاقات قراراً منفصلاً يحتاج موافقة مالك الإنتاج وفق التوجيه.

## مصادر Cloudflare/TanStack

- [Cloudflare: TanStack Start](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/)
- [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/)
- [TanStack Start hosting](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)
- [سجل مصادر التدقيق المحفوظ بالمستودع](./EXTERNAL-SOURCES-2026-10-10.md)
