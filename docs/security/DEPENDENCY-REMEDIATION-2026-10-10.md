# معالجة ثغرات الاعتماديات — 2026-10-10

## النتيجة

عالج هذا الفرع تنبيهات الاعتماديات التي أمكن تحديثها ضمن شجرة المشروع، مع إبقاء الماسح الأمني فعالاً. على `origin/main` عند commit `81972f79c1ca5fa8781aaf2e80d83e9db21527b5`، سجّل OSV-Scanner v2.6.0 عدد **91 تطابقاً أمنياً** عبر **28 نسخة حزمة مقفلة** و**26 اسماً للحزم**. بعد التحديث الانتقائي أصبح الفحص النهائي بلا نتائج غير مستثناة. توجد خمسة استثناءات ضيقة ومؤقتة تخص حزمة `xlsx`؛ تفصيلها أدناه.

لم تُدمج التغييرات ولم يُنفّذ نشر أو ترحيل لقاعدة بيانات الإنتاج.

## تغييرات الاعتماديات

- رُفعت `@capacitor/android` و`@capacitor/ios` و`@capacitor/core` و`@capacitor/cli` من 8.5.0 إلى 8.5.3. يتضمن الإصدار 8.5.3 الإصلاح الذي يبدأ في 8.5.1 لتنبيه CVE-2026-103922. [1]
- فُرضت `@modelcontextprotocol/sdk` على 1.31.0 لمعالجة CVE-2026-104850، وأُحدّثت `zod` المقفلة إلى 4.6.5 كي ينجح فحص TypeScript مع واجهات SDK المحدثة. [2]
- فُرضت `uuid` على 11.1.1 لمعالجة GHSA-w5hq-g745-h8pq. يتطلب `xcode@3.0.1` النسخة 7.x، لذا اختُبر تحميل `xcode` واستدعاء `uuid.v4()` بعد override، لكن لم يُجر بناء Android أصلي كامل. [3]
- رُفعت `shell-quote` من 1.10.0 إلى 1.12.0، متجاوزة الإصدار المصحح 1.11.0 لتنبيه GHSA-pqg4-j6r4-53mv. [4]
- حُدثت الحزم المباشرة والانتقالية المتأثرة الأخرى إلى إصدارات مصححة متوافقة مع نطاقات `package.json`. اقتصر تعديل manifest على overrides اللازمة؛ أما حل بقية النسخ فمسجل في `bun.lock`.
- حُدث مسار GitHub Actions إلى reusable workflow الرسمي لـOSV-Scanner v2، بحيث يفحص `bun.lock` مباشرة بدلاً من مسار npm غير المتوافق مع مدير الحزم المستخدم.

## تنبيه xlsx والاستثناءات

يعتمد التطبيق `xlsx` من tarball الرسمي لـSheetJS على CDN بالإصدار 0.20.3. فُحصت بيانات `package.json` داخل tarball نفسه وتأكدت النسخة 0.20.3. لكن `bun.lock` يسجل الاعتماد بعنوان URL، فيتعامل OSV-Scanner معه كأنه رقم إصدار غير قابل للمقارنة ويعيد خمسة تنبيهات.

تؤكد مصادر المورّد وNVD أن الإصدار الفعلي 0.20.3 خارج النطاق المتأثر: إصدارات 2021 المتأثرة تنتهي عند 0.16.9 أو تُصلح في 0.17.0، وثغرة CVE-2023-30533 تُصلح في 0.19.3، وثغرة CVE-2024-22363 تُصلح في 0.20.2. [5] [6] [7] [8] [9]

لذلك يحتوي `osv-scanner.toml` على استثناءات **لهذه المعرفات الخمسة فقط**:

- GHSA-3x9f-74h4-2fqr — CVE-2021-32012
- GHSA-8vcr-vxm8-293m — CVE-2021-32013
- GHSA-g973-978j-2c3p — CVE-2021-32014
- GHSA-4r6h-8v6p-xvw6 — CVE-2023-30533
- GHSA-5pgg-2g8v-p4x9 — CVE-2024-22363

تنتهي الاستثناءات في **2026-11-10**، وتتضمن كل واحدة سبباً. لا يُعطّل ذلك الفحص العام أو نتائج الحزم الأخرى. يجب إعادة تقييمها عند انتهاء المدة أو عندما يدعم الماسح تفسير إصدار الاعتماد ذي عنوان URL. تدعم وثائق OSV الرسمية استثناءات بحسب معرّف الثغرة مع سبب وتاريخ انتهاء. [10]

## التحقق

- `bun install --frozen-lockfile`: نجح.
- `osv-scanner v2.6.0 scan source --recursive`: انتهى برمز 0؛ صفر نتائج غير مستثناة، مع ترشيح المعرفات الخمسة المحددة أعلاه فقط.
- `bunx vitest run`: **282 اختباراً ناجحاً**، و8 اختبارات متروكة ضمن مجموعة اختبار متروكة؛ لا توجد إخفاقات.
- `bunx tsc --noEmit`: نجح بعد مواءمة Zod مع SDK.
- `bunx eslint . --max-warnings=-1`: صفر أخطاء، مع 5 تحذيرات lint.
- `bun run build`: نجح لبناء Node وPWA.
- اختبار توافق إضافي: حمّل Node حزمة `xcode` بنجاح مع `uuid@11.1.1`، ونُفذ `uuid.v4()` بنجاح.

لم يُنفذ بناء Android أصلي أو مزامنة منصة الهاتف. مجلد `android` موجود في المستودع، أما `ios` فغير موجود على `main`.

## المراجع

[1]: https://nvd.nist.gov/vuln/detail/CVE-2026-103922 "NVD: CVE-2026-103922 — Capacitor"
[2]: https://github.com/advisories/GHSA-6qxp-vccf-f47h "GitHub Advisory: CVE-2026-104850 — MCP TypeScript SDK"
[3]: https://github.com/advisories/GHSA-w5hq-g745-h8pq "GitHub Advisory: CVE-2026-41907 — uuid"
[4]: https://github.com/advisories/GHSA-pqg4-j6r4-53mv "GitHub Advisory: CVE-2026-102422 — shell-quote"
[5]: https://nvd.nist.gov/vuln/detail/CVE-2021-32012 "NVD: CVE-2021-32012 — SheetJS"
[6]: https://nvd.nist.gov/vuln/detail/CVE-2021-32013 "NVD: CVE-2021-32013 — SheetJS"
[7]: https://github.com/advisories/GHSA-g973-978j-2c3p "GitHub Advisory: CVE-2021-32014 — SheetJS"
[8]: https://cdn.sheetjs.com/advisories/CVE-2023-30533 "SheetJS vendor advisory: CVE-2023-30533"
[9]: https://cdn.sheetjs.com/advisories/CVE-2024-22363 "SheetJS vendor advisory: CVE-2024-22363"
[10]: https://google.github.io/osv-scanner/configuration/ "OSV-Scanner v2 configuration"
