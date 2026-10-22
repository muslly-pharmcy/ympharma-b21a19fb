# أدلة تدقيق الإصدار — P0-1

التاريخ: 2026-10-23، المنطقة الزمنية Asia/Riyadh. البيئة: Windows محلي؛ Node v24.19.0 وBun 1.4.3.
المستودع: muslly-pharmcy/ympharma-b21a19fb.
قاعدة الفرع: main@7ecf324de1a1f9748b685b7e744fd543e097b8e5.
التنفيذ المفحوص: f6a368b53dd1a775a8cc93d8c473888bdab7f83b، الفرع fix/devtools-release-readiness.

## خطة PR ونطاقه

إصلاح تحميل ESM في strix-scan وctx7-check وskillui-extract، وتفويض أمر package.json إلى Strix runner واحد مثبت، وتصحيح قراءة allowedTargets، وحماية تنفيذ Docker دون shell. تجاهل مخرجات الأدوات وملفات البيئة المحلية مع الحفاظ على .env.example. لا تعديل للأعمال أو قاعدة البيانات أو سياسة OSV أو النشر.

## baseline قبل تعديل المصدر

| الأمر | النتيجة الفعلية |
|---|---|
| `bun install --frozen-lockfile` | ناجح، exit 0، 1245 حزمة مثبتة |
| `bunx vitest run` | لم ينفذ: اختصار bunx غير متاح في PATH |
| `bun x vitest run` | 281 ناجح، 1 فاشل، 8 متجاوزة؛ exit 1 |
| `bun x tsc --noEmit` | ناجح، exit 0 |
| `bun x eslint . --max-warnings=-1` | ناجح، exit 0؛ 0 أخطاء و6 تحذيرات |
| `bun run build` | ناجح، exit 0، هدف Node محلي |
| `node scripts/devtools/strix-scan.js` | فاشل، exit 1: `ReferenceError: require is not defined in ES module scope` |

استُخدم `bun x` باعتباره الصيغة المكافئة لـbunx. أخطاء عدم وجود الأمر في المحاولة الأولى تركت LASTEXITCODE بقيمة قديمة؛ لذلك لم تُحتسب تلك المحاولة نجاحاً، وأعيدت الفحوص فعلياً. عند فشل Vitest شُغلت الفحوص الباقية مستقلة للتشخيص، وليست نتيجة لسلسلة && ناجحة.

فشل tests/product-image-boundaries.test.ts بسبب مطابقة نص يحوي LF في checkout حوّله إعداد Git الموروث core.autocrlf=true إلى CRLF. ضُبط core.autocrlf=false لهذا checkout فقط، وطُبّعت ملفات العمل النصية إلى LF. لم يُخفف أي توقع ولم يتغير محتوى تطبيق الأعمال؛ git diff يقتصر على ملفات PR. إعادة المحاولة قبل التطبيع وحدها لم تحل الفشل.

## التحقق بعد التنفيذ

| الأمر | النتيجة الفعلية |
|---|---|
| `bun x vitest run tests/devtools-runners.test.ts` | 11 ناجح، 0 فاشل، 0 متجاوز؛ exit 0 |
| `bun x vitest run` | 293 ناجح، 0 فاشل، 8 متجاوزة؛ 42 ملفاً ناجحاً وملف متجاوز؛ exit 0 |
| `bun x tsc --noEmit` | ناجح، exit 0 |
| `bun x eslint . --max-warnings=-1` | ناجح، exit 0؛ 0 أخطاء و6 تحذيرات |
| `bun run build` | ناجح، exit 0؛ بناء Node، ليس نشراً |
| `node scripts/devtools/strix-scan.js --help` | ناجح، exit 0 |
| `node scripts/devtools/ctx7-check.js --help` | ناجح، exit 0 |
| `node scripts/devtools/skillui-extract.js --help` | ناجح، exit 0 |
| `git diff --check` | ناجح بعد تطبيع LF؛ لا أخطاء مسافات |

الاختبارات الجديدة تشغل entrypoints فعلياً داخل نسخة مؤقتة معزولة: تحميل ESM، رفض غياب opt-in، قبول allowedTargets، dry-run بالصورة 1.3.0 من cwd مختلف، ورفض wildcard وهدف حقن shell وتجاوز الصورة. لا تشغل Docker أو أداة خارجية. أمر Strix يستخدم argv دون shell، ويقيد المسار الحقيقي إلى داخل المستودع، ويمنع الهدف الجذر.

## حالة القبول وحدوده

- P0-1 غير مغلق: نجاح help وdry-run لا يثبت نجاح فحص Strix، أو استخراج SkillUI، أو اتصال Context7. التنفيذ الفعلي لهذه الأدوات: غير منفذ؛ لا يُعد ناجحاً ولا ثغرة مؤكدة.
- CI على هذا الفرع: غير معلوم؛ لا توجد نتيجة خضراء موثقة.
- نشر الفرع: ناجح عبر git push دون force؛ استخدم Git اعتماد الجهاز القائم. موصل GitHub رفض create_branch بـHTTP 403: Resource not accessible by integration؛ هذا قيد الموصل وليس غياب جميع وسائل الكتابة. gh غير مسجل الدخول. لا تُطلب أسرار ولا تحفظ في الملفات.
- PRs #14 و#15 و#17: تم التحقق عبر موصل GitHub؛ جميعها open وmerged=false. تعذر تنفيذ gh pr view لغياب تسجيل الدخول؛ استُخدم الموصل للقراءة.
- P0-2..P0-4 وP1-1..P1-5: غير منفذة التزاماً ببوابة الترتيب التي تمنع الانتقال قبل إغلاق P0-1 بالدليل. لم تُطبق migrations ولم تُغير Cloudflare/DNS ولم ينفذ deploy.
- ملاحظة من القراءة فقط: ci.yml يتضمن بالفعل validate:cloudflare، فلا يصح ادعاء أن إضافة الخطوة مفقودة هي إصلاح جديد. سجل Workers Builds غير مقروء في هذه المهمة.

السجلات الكاملة محلياً في المجلد المجاور `../release-audit-evidence-20261021/`؛ تاريخ اسم المجلد هو تاريخ بدء العمل، وليس تاريخ نجاح CI. سجل baseline-strix.log يحفظ الخطأ الأصلي؛ p0-1-*.log تحفظ النتائج اللاحقة. لا ينسب شيء من هذه النتائج إلى main أو الإنتاج.

## تحديث الأدلة من GitHub — 2026-10-23

PR المسودة: https://github.com/muslly-pharmcy/ympharma-b21a19fb/pull/18 . أُنشئ عبر gh باستعمال اعتماد Git الموجود في ذاكرة العملية فقط؛ لم تُحفظ بيانات اعتماد ولم يتغير تسجيل الدخول. تعذر موصل GitHub بصلاحية 403 لا يعني تعذر الكتابة عبر Git المحلي.

النتائج التالية تخص head `993b13f1e73d1181ff3ab14921025babc9919ec8`، بيئة GitHub Actions/Ubuntu، وليست main أو الإنتاج:

| الفحص/الأمر | النتيجة الفعلية والدليل |
|---|---|
| CI: Typecheck, lint and test | ناجح: https://github.com/muslly-pharmcy/ympharma-b21a19fb/actions/runs/39863080268/job/120118403498 |
| `bunx vitest run` في CI | 293 ناجح، 0 فاشل، 8 متجاوزة؛ 42 ملفاً ناجحاً وملف متجاوز |
| `bunx tsc --noEmit` و`bunx eslint . --max-warnings=-1` و`bun run build` | ناجحة في نفس job؛ ESLint سجل 6 تحذيرات |
| `bun run validate:cloudflare` | ناجح في نفس job؛ أنشأ Worker وسجل `--dry-run: exiting now.`؛ لا نشر فعلي |
| CodeQL | ناجح |
| `osv-scanner` المستقل | ناجح: https://github.com/muslly-pharmcy/ympharma-b21a19fb/runs/120118548797 |
| OSV Security Scan / osv-scan | فاشل: https://github.com/muslly-pharmcy/ympharma-b21a19fb/actions/runs/39863080482/job/120118403313 |
| Workers Builds | فاشل بحسب check: https://github.com/muslly-pharmcy/ympharma-b21a19fb/runs/120113770242 . لم يُقرأ سجل السبب؛ P0-2 لم يبدأ |
| Supabase Preview | متجاوز؛ ليس نجاحاً أو دليلاً على تطبيق migrations |

جُلبت logs بالأمر `gh run view --repo muslly-pharmcy/ympharma-b21a19fb --job <job-id> --log`؛ exit 0 لكلا job IDs أعلاه. قرئت النتائج عبر `gh api repos/muslly-pharmcy/ympharma-b21a19fb/commits/993b13f1e73d1181ff3ab14921025babc9919ec8/check-runs`؛ exit 0.

سجل OSV نفسه يفحص package-lock.json (1341 حزمة) وbun.lock (1530 حزمة)، ثم يطبع: `Total 33 packages affected by 94 known vulnerabilities (9 Critical, 37 High, 43 Medium, 5 Low, 0 Unknown)`، و`94 vulnerabilities can be fixed.`. تظهر نتائج في الملفين، فلا يصح نسبتها إلى package-lock القديم وحده. هذه نتائج مطابقة اعتماديات من scanner وليست إثبات استغلال التطبيق. ثبات القفل لا يمنع ظهور advisories جديدة. لم يتغير fail-on-vuln أو osv-scanner.toml أو أي ملف قفل في هذا PR.

الحكم المحدث: فحص CI الأساسي ناجح على head المذكور، لكن مجموعة الفحوص الإجمالية فاشلة، وتشغيل الأدوات الخارجية الحقيقي غير منفذ. P0-1 يبقى غير مغلق؛ P0-2..P1-5 لم تبدأ وفق شرط الترتيب. معالجة الاعتماديات تتطلب نطاقاً مستقلاً ولا تُخفى داخل PR الأدوات الصغير. كل وصف سابق لـCI بأنه غير معلوم أعلاه يوثق مرحلة سابقة وتحل هذه النتائج محلّه. أي commit توثيق لاحق لا يرث نتيجة CI لهذا head تلقائياً.
