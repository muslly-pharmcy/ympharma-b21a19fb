# مصادر التحقق الخارجية — 2026-10-10

## Cloudflare وTanStack Start

- Cloudflare TanStack Start Workers guide: https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/
- Cloudflare Vite plugin reference: https://developers.cloudflare.com/workers/vite-plugin/
- TanStack Start hosting guide: https://tanstack.com/start/latest/docs/framework/react/guide/hosting
- Vite build environments: https://vite.dev/guide/api-environment

## OSV Scanner وbun.lock

- قائمة ملفات القفل المدعومة: https://google.github.io/osv-scanner/supported-languages-and-lockfiles/
- وثائق GitHub Action الرسمية وإصدار reusable workflow الحالي v2.6.0: https://google.github.io/osv-scanner/github-action/
- سجل تغييرات OSV Scanner الرسمي؛ يذكر إضافة دعم `bun.lock` في v2.0.0: https://github.com/google/osv-scanner/blob/main/CHANGELOG.md
- طلب دعم Bun lockfile ومناقشة extractor وتاريخه: https://github.com/google/osv-scanner/issues/1405

**أثر التحقق:** تشغيل OSV Action v1.9.0 في CI على commit `186f1b5` أعاد `No package sources found` عند فحص `./`، ثم رفع SARIF فارغاً لم يستطع GitHub تحليله. لذلك غُيّر workflow محلياً إلى reusable workflow v2.6.0 المبني على scanner أحدث يدعم `bun.lock`. يلزم انتظار CI بعد الدفع؛ التوثيق أو التغيير وحده لا يثبت أن المسح نجح أو أن شجرة الاعتماد خالية من الثغرات.
