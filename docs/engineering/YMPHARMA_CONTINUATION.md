# نقطة الاستمرار — YmPharma

**آخر تحديث:** 2026-10-10 (الرياض)  
**المستودع:** `muslly-pharmcy/ympharma-b21a19fb`  
**المسار الحالي في Sandbox:** `/home/ubuntu/ympharma`

## الحالة عند التوقف

- الفرع الذي يحمل إصلاح Cloudflare: `fix/cloudflare-10021-vite-plugin`، وPR #13 مفتوح.
- PR #14 على الفرع `fix/authz-agent-events-dlq-stats` يضيف حارس `agent_events_dlq_stats()` واختبار انحدار؛ مفتوح ولم تُطبق migration على Supabase.
- PR #15 على الفرع `fix/insurance-tenant-isolation` يضيف عزل المؤسسة في upserts التأمين واختبارات؛ مفتوح وغير مطبق على DB.
- أصل `main` عند المراجعة كان `81972f79`؛ لا يوجد تغيير على main.
- على PR #15: نجحت 287 اختبارات و8 متخطاة، وبناء Node وESLint؛ نجح GitHub CI/CodeQL، وفشل Workers Builds. فشل `tsc` المحلي بـ24 خطأ في أربع وحدات MCP غير معدلة، ولا يظهر خطأ في ملفات PR #15.
- على PR #13: CI وCodeQL وcheck `osv-scanner` الجديد نجحت؛ check خارجي منفصل `OSV-Scanner/OSV Security Scan` وWorkers Builds ما زالا فاشلين. لا تخلط check OSV الأخضر مع اكتمال كل الفحوص.
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
git commit -m "docs: refresh YmPharma audit and release evidence"
git push
gh pr checks 13 --repo muslly-pharmcy/ympharma-b21a19fb --watch
```

إذا فشل OSV v2.6.0، اقرأ سبب الفشل والـSARIF أولاً؛ افصل بين عدم توافق parser، ثغرة حقيقية، وفشل رفع artifact. لا تغيّر سياسة fail-on-vuln لمجرد تحويل check إلى أخضر.

## ترتيب المعالجة بعد الوثائق

1. راجع وادمج إصلاحات PR #13–#15 فقط بعد اكتمال المراجعات المطلوبة؛ ثم أصلح كتابة المخزون المباشرة بمسار ذري فعلي. لا تستبدل ضبط رصيد متعدد الدفعات باستدعاءات منفصلة قد تنفذ جزئياً.
2. أصلح مسار checkout والـ`po_receive` واختبرهما على قاعدة معزولة.
3. أضف حارس نطاق فرع واختبارات cross-tenant/cross-branch، واجعل اختبارات PostgreSQL تعمل في CI بدلاً من التخطي.
4. طبّق migration DLQ على Preview/اختبار فقط بعد مراجعة CI؛ لا تطبق على الإنتاج تلقائياً.
5. استكمل نموذج POS/الدفع والمحاسبة والمخزون والتأمين والوصفة ضمن عقود واضحة واختبارات قبول.
6. بعد اجتياز بوابات الإصدار، اطلب موافقة مالك الإنتاج بشكل منفصل قبل أي تغيير في إعدادات Cloudflare المدارة أو routes أو DNS أو إصدار Worker أو migrations الإنتاج.

## وثائق المتابعة

- `YMPHARMA_CURRENT_STATE.md`
- `YMPHARMA_MASTER_BACKLOG.md`
- `YMPHARMA_ARCHITECTURE.md`
- `YMPHARMA_TEST_MATRIX.md`
- `YMPHARMA_SECURITY_REPORT.md`
- `YMPHARMA_RELEASE_READINESS.md`
- `YMPHARMA_CONTINUATION.md`

هذه النقطة لا تمنح صلاحية نشر أو تغيير قواعد الإنتاج؛ تظل تلك الأفعال منفصلة عن إصلاح المستودع.
