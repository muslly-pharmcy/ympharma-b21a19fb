# نقطة الاستمرار — YmPharma

**آخر تحديث:** 2026-10-10 (الرياض)  
**المستودع:** `muslly-pharmcy/ympharma-b21a19fb`  
**المسار الحالي في Sandbox:** `/home/ubuntu/ympharma`

## الحالة عند التوقف

- الفرع الذي يحمل إصلاح Cloudflare: `fix/cloudflare-10021-vite-plugin`، وPR #13 مفتوح.
- PR #14 على الفرع `fix/authz-agent-events-dlq-stats` يضيف حارس `agent_events_dlq_stats()` واختبار انحدار؛ مفتوح ولم تُطبق migration على Supabase.
- أصل `main` عند المراجعة كان `81972f79`؛ لا يوجد تغيير على main.
- محلياً نجح: Bun frozen install، Vitest، TypeScript، ESLint، بناء Node، بناء Cloudflare، Wrangler dry-run ومعاينة Workerd.
- فشل OSV v1.9.0 لأنه لم يكتشف مصدر حزم `bun.lock`؛ تم تحديث `.github/workflows/osv-scanner.yml` محلياً إلى reusable workflow الرسمي `v2.6.0`. يجب دفع هذا التغيير ثم متابعة CI. لا تصف OSV بأنه ناجح حتى يكون هناك SARIF صحيح.
- Workers Builds الخارجي فشل. يلزم مقارنة إعداد Cloudflare Build المدَار بأمر `bun run build:cloudflare`، مع إبقاء التنفيذ في وضع التحقق وعدم النشر.
- لم يقع نشر أو تغيير DNS أو تطبيق migration خارج المستودع.

## الخطوة الأولى في الجلسة التالية

```bash
cd /home/ubuntu/ympharma
source /home/ubuntu/.user_env
git status --short --branch
git diff --check
git diff -- .github/workflows/osv-scanner.yml docs/engineering/
```

راجع أن تغييرات الوثائق وOSV فقط مقصودة. ثبّت dependencies بلا تعديل lockfile إن لزم:

```bash
/home/ubuntu/.bun/bin/bun install --frozen-lockfile
/home/ubuntu/.bun/bin/bunx vitest run
/home/ubuntu/.bun/bin/bunx tsc --noEmit
/home/ubuntu/.bun/bin/bunx eslint . --max-warnings=-1
/home/ubuntu/.bun/bin/bun run build
/home/ubuntu/.bun/bin/bun run validate:cloudflare
```

ثم احفظ التغييرات في فرع PR #13، وراقب الفحوص:

```bash
git add .github/workflows/osv-scanner.yml docs/engineering/YMPHARMA_*.md docs/deployment/EXTERNAL-SOURCES-2026-10-10.md docs/deployment/CLOUDFLARE-10021-REPAIR.md
git commit -m "docs: add YmPharma audit and release evidence"
git push
gh pr checks 13 --repo muslly-pharmcy/ympharma-b21a19fb --watch
```

إذا فشل OSV v2.6.0، اقرأ سبب الفشل والـSARIF أولاً؛ افصل بين عدم توافق parser، ثغرة حقيقية، وفشل رفع artifact. لا تغيّر سياسة fail-on-vuln لمجرد تحويل check إلى أخضر.

## ترتيب المعالجة بعد الوثائق

1. أصلح كتابة المخزون المباشرة ومسار checkout والـupserts العابرة للمؤسسات و`po_receive` وفق `YMPHARMA_MASTER_BACKLOG.md`، كل تغيير في PR مستقل مع اختبار قاعدة معزولة.
2. أضف حارس نطاق فرع واختبارات cross-tenant/cross-branch، واجعل اختبارات PostgreSQL تعمل في CI بدلاً من التخطي.
3. راجع PR #14 ونتيجة CI، ثم طبّق migration على بيئة Preview/اختبار فقط بعد التحقق. لا تطبق على الإنتاج تلقائياً.
4. استكمل نموذج POS/الدفع والمحاسبة والمخزون والتأمين والوصفة ضمن عقود واضحة واختبارات قبول.
5. بعد اجتياز بوابات الإصدار، اطلب موافقة مالك الإنتاج بشكل منفصل قبل أي تغيير في إعدادات Cloudflare المدارة أو routes أو DNS أو إصدار Worker أو migrations الإنتاج.

## وثائق المتابعة

- `YMPHARMA_CURRENT_STATE.md`
- `YMPHARMA_MASTER_BACKLOG.md`
- `YMPHARMA_ARCHITECTURE.md`
- `YMPHARMA_TEST_MATRIX.md`
- `YMPHARMA_SECURITY_REPORT.md`
- `YMPHARMA_RELEASE_READINESS.md`
- `YMPHARMA_CONTINUATION.md`

هذه النقطة لا تمنح صلاحية نشر أو تغيير قواعد الإنتاج؛ تظل تلك الأفعال منفصلة عن إصلاح المستودع.